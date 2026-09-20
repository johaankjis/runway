import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import test from "node:test";

import { createDocumentWorkflow } from "../apps/web/lib/document-workflow.ts";

function bridge(t, ...args) {
  const child = spawn(process.env.RUNWAY_TEST_PYTHON ?? ".venv/bin/python", ["tests/document_workflow_bridge.py", ...args], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  t.after(() => child.stdin.end());
  const waiting = [];
  createInterface({ input: child.stdout }).on("line", (line) => {
    const result = JSON.parse(line);
    const { resolve, reject } = waiting.shift();
    if (result.status >= 400) reject(new Error(result.body.detail));
    else resolve(result.body);
  });
  child.on("exit", (code) => {
    for (const { reject } of waiting.splice(0)) reject(new Error(`Bridge exited: ${code}`));
  });
  const send = (request) => new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    child.stdin.write(`${JSON.stringify(request)}\n`);
  });
  let extractions = 0;
  return {
    get extractions() { return extractions; },
    request: (method, path) => send({ method, path }),
    uploadDocument: async (file) => send({
      operation: "upload", name: file.name, mime: file.type,
      content: Buffer.from(await file.arrayBuffer()).toString("base64"),
    }),
    extractDocument: (id) => {
      extractions++;
      return send({ method: "POST", path: `/api/documents/${id}/extract` });
    },
  };
}

const freshfields = async () => new File(
  [await readFile("data/demo-uploads/freshfields-surcharge.pdf")],
  "freshfields-surcharge.pdf", { type: "application/pdf" },
);

const metrics = (state) => [
  state.current_cash_cents, state.expected_inflows_cents, state.expected_outflows_cents,
  state.projected_ending_cash_cents, state.projected_shortfall_cents, state.cash_runway_days,
];

test("one upload action automatically analyzes, incorporates, refreshes, deduplicates and resets", async (t) => {
  const api = bridge(t);
  const baseline = await api.request("GET", "/api/financial-state");
  let published;
  const workflow = createDocumentWorkflow(api, (result) => { published = result; });
  const phases = [];
  let unsubscribe = workflow.subscribe(() => {
    phases.push(Object.values(workflow.getSnapshot()).at(-1).status);
  });
  // The caller performs only upload: no separate analyze action.
  const result = await workflow.upload(await freshfields(), (doc) => {
    assert.equal(workflow.getSnapshot()[doc.id].status, "analyzing");
    // Navigating away during analysis unsubscribes; request still completes.
    unsubscribe();
  });
  assert.equal(api.extractions, 1);
  assert.equal(result.run.status, "success");
  assert.equal(result.run.response.application_status, "incorporated");
  assert.equal(result.run.response.signal.extraction.provider.mode, "fixture");
  assert.equal(result.run.response.signal.extraction.provider.failure_reason, null);
  assert.equal(result.run.response.signal.financial_effect.calculation_status, "applied");
  assert.equal(published, result.run.response);
  const state = published.financial_state;
  assert.deepEqual(metrics(state), [4320000, 1940000, 5202584, 1057416, 512584, 17]);
  assert.equal(state.forecast_adjustments.length, 1);
  assert.equal(state.forecast_adjustments[0].monthly_amount_cents, 56117);
  assert.equal(state.forecast_adjustments[0].amount_cents, 32584);
  assert.equal(state.average_daily_net_burn_cents, 242421);
  assert.deepEqual(await api.request("GET", "/api/financial-state"), state);
  assert.deepEqual(phases, ["analyzing"]);
  // Rendering, subscribing and navigating back are read-only operations.
  for (let index = 0; index < 5; index++) {
    unsubscribe = workflow.subscribe(() => {});
    assert.equal(workflow.getSnapshot()[result.document.id].status, "success");
    unsubscribe();
  }
  assert.equal(api.extractions, 1);
  const repeated = await workflow.analyze(result.document.id);
  assert.deepEqual(repeated.response, result.run.response);
  assert.deepEqual(repeated.response.financial_state, state);
  const duplicate = await workflow.upload(await freshfields(), () => {});
  assert.equal(duplicate.run.response.application_status, "potential_duplicate");
  assert.deepEqual(duplicate.run.response.financial_state, state);
  const metro = new File([await readFile("data/documents/supplier-price-notice.md")], "metro.txt", { type: "text/plain" });
  const metroResult = await workflow.upload(metro, () => {});
  assert.equal(metroResult.run.response.application_status, "potential_duplicate");
  assert.deepEqual(metroResult.run.response.financial_state, state);
  await api.request("POST", "/api/demo/reset");
  assert.deepEqual(await api.request("GET", "/api/financial-state"), baseline);
});

test("qualitative or invalid analysis preserves the saved source, error state and baseline", async (t) => {
  const api = bridge(t);
  const baseline = await api.request("GET", "/api/financial-state");
  let results = 0;
  const workflow = createDocumentWorkflow(api, () => { results++; });
  const result = await workflow.upload(new File(
    ["Northstar announces customer layoffs. Future demand may be affected."],
    "northstar.txt", { type: "text/plain" },
  ), () => {});
  assert.equal(api.extractions, 1);
  assert.equal(result.run.status, "error");
  assert.equal(results, 0);
  assert.equal(workflow.getSnapshot()[result.document.id].status, "error");
  const documents = await api.request("GET", "/api/documents");
  assert.ok(documents.some((doc) => doc.id === result.document.id));
  assert.deepEqual(await api.request("GET", "/api/financial-state"), baseline);
  assert.equal((await workflow.analyze(result.document.id)).status, "error");
  assert.deepEqual(await api.request("GET", "/api/financial-state"), baseline);
});

test("automatic analysis preserves invalid Nemotron/provenance fallback policy", async (t) => {
  const api = bridge(t, "--invalid-provider");
  const baseline = await api.request("GET", "/api/financial-state");
  const workflow = createDocumentWorkflow(api, () => {});
  const result = await workflow.upload(await freshfields(), () => {});
  assert.equal(result.run.status, "success");
  assert.equal(result.run.response.signal.extraction.provider.mode, "fallback");
  assert.equal(result.run.response.signal.extraction.provider.failure_reason, "invalid_output");
  assert.equal(result.run.response.signal.disposition, "proposed");
  assert.equal(result.run.response.application_status, "proposed");
  assert.deepEqual(result.run.response.financial_state, baseline);
  assert.deepEqual((await workflow.analyze(result.document.id)).response, result.run.response);
  assert.deepEqual(await api.request("GET", "/api/financial-state"), baseline);
});

test("overlapping manual analysis shares the upload's in-flight request", async () => {
  let release;
  let calls = 0;
  const response = { signal: { id: "signal-1" }, financial_state: {} };
  const api = {
    uploadDocument: async () => ({ id: "doc-1" }),
    extractDocument: () => {
      calls++;
      return new Promise((resolve) => { release = () => resolve(response); });
    },
  };
  const workflow = createDocumentWorkflow(api, () => {});
  const task = workflow.upload(new File(["text"], "test.txt"), () => {});
  await new Promise((resolve) => setImmediate(resolve));
  const retry = workflow.analyze("doc-1");
  assert.equal(calls, 1);
  release();
  assert.equal((await task).run.response, response);
  assert.equal((await retry).response, response);
});

test("upload rejection never starts analysis", async () => {
  let calls = 0;
  const workflow = createDocumentWorkflow({
    uploadDocument: async () => { throw new Error("Invalid PDF"); },
    extractDocument: async () => { calls++; },
  }, () => {});
  await assert.rejects(workflow.upload(new File(["invalid"], "bad.pdf"), () => {}), /Invalid PDF/);
  assert.equal(calls, 0);
  assert.deepEqual(workflow.getSnapshot(), {});
});
