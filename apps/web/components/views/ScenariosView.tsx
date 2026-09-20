"use client";

import type { ScenarioRequest, ScenarioResult, ScenarioSnapshot } from "@runway/contracts";
import { Info, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ScenarioComparisonChart, ScenarioLegend } from "@/components/charts/ScenarioComparisonChart";
import { ScenarioCard } from "@/components/domain/ScenarioCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterPills } from "@/components/ui/FilterPills";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCents, formatSignedCents, pluralize } from "@/lib/format";
import { CUSTOM_SCENARIO_DEFAULTS, QUICK_SCENARIOS, type QuickScenario } from "@/lib/scenarios";

type Tab = "quick" | "custom";

interface RunState {
  result: ScenarioResult | null;
  loading: boolean;
  error: Error | null;
}

const idle: RunState = { result: null, loading: false, error: null };

function useScenarioRunner() {
  const [runs, setRuns] = useState<Record<string, RunState>>({});

  const run = useCallback(async (key: string, request: ScenarioRequest) => {
    setRuns((prev) => ({ ...prev, [key]: { ...(prev[key] ?? idle), loading: true, error: null } }));
    try {
      const result = await api.runScenario(request);
      setRuns((prev) => ({ ...prev, [key]: { result, loading: false, error: null } }));
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setRuns((prev) => ({ ...prev, [key]: { result: null, loading: false, error: err } }));
      return null;
    }
  }, []);

  const reset = useCallback(() => setRuns({}), []);
  return { runs, run, reset };
}

function DeltaValue({ base, next, invert = false, format }: { base: number; next: number; invert?: boolean; format: (v: number) => string }) {
  const delta = next - base;
  const good = invert ? delta < 0 : delta > 0;
  return (
    <span className={cn("tabular text-[12px] font-semibold", delta === 0 ? "text-muted" : good ? "text-success-600" : "text-danger-600")}>
      {delta === 0 ? "No change" : format(delta)}
    </span>
  );
}

function ComparisonTable({ baseline, projected }: { baseline: ScenarioSnapshot; projected: ScenarioSnapshot }) {
  const rows: Array<{
    label: string;
    base: number;
    next: number;
    format: (v: number) => string;
    deltaFormat: (v: number) => string;
    invert?: boolean;
  }> = [
    { label: "Projected balance", base: baseline.projected_ending_cash_cents, next: projected.projected_ending_cash_cents, format: formatCents, deltaFormat: formatSignedCents },
    { label: "Projected shortfall", base: baseline.projected_shortfall_cents, next: projected.projected_shortfall_cents, format: (v) => (v > 0 ? formatCents(v) : "None"), deltaFormat: formatSignedCents, invert: true },
    { label: "Cash runway", base: baseline.cash_runway_days ?? 0, next: projected.cash_runway_days ?? 0, format: (v) => `${v} days`, deltaFormat: (v) => `${v > 0 ? "+" : ""}${v} days` },
    { label: "Current cash", base: baseline.current_cash_cents, next: projected.current_cash_cents, format: formatCents, deltaFormat: formatSignedCents },
    { label: "Expected inflows", base: baseline.expected_inflows_cents, next: projected.expected_inflows_cents, format: formatCents, deltaFormat: formatSignedCents },
    { label: "Expected outflows", base: baseline.expected_outflows_cents, next: projected.expected_outflows_cents, format: formatCents, deltaFormat: formatSignedCents, invert: true },
    { label: "Daily net burn", base: baseline.average_daily_net_burn_cents, next: projected.average_daily_net_burn_cents, format: formatCents, deltaFormat: formatSignedCents, invert: true },
  ];
  return (
    <table className="w-full text-left text-[13.5px]">
      <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        <tr className="border-b border-line">
          <th scope="col" className="py-2 pr-3 font-semibold">Metric</th>
          <th scope="col" className="py-2 pr-3 text-right">Baseline</th>
          <th scope="col" className="py-2 pr-3 text-right text-info-600">Scenario</th>
          <th scope="col" className="py-2 text-right">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.label} className={cn("border-b border-line last:border-b-0", index < 3 && "font-semibold")}>
            <th scope="row" className="py-2.5 pr-3 font-medium text-ink-soft">{row.label}</th>
            <td className="tabular py-2.5 pr-3 text-right text-ink">{row.format(row.base)}</td>
            <td className="tabular py-2.5 pr-3 text-right text-ink">{row.format(row.next)}</td>
            <td className="py-2.5 text-right">
              <DeltaValue base={row.base} next={row.next} invert={row.invert} format={row.deltaFormat} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScenarioResultPanel({ result, startDate, modeling }: { result: ScenarioResult; startDate: string; modeling?: string }) {
  const baseRunway = result.baseline.cash_runway_days;
  const nextRunway = result.projected.cash_runway_days;
  const runwayDelta = baseRunway != null && nextRunway != null ? nextRunway - baseRunway : null;
  const shortfallDelta = result.projected.projected_shortfall_cents - result.baseline.projected_shortfall_cents;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Cash Position Impact"
          subtitle={`${result.name} · compared with the current projection`}
          action={<ScenarioLegend hasScenario />}
        />
        <ScenarioComparisonChart baseline={result.baseline} scenario={result.projected} startDate={startDate} height={260} />
      </Card>

      <Card tone="info" className="flex items-start gap-3.5 px-5 py-4">
        <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info-100 text-info-600">
          <Info className="h-4 w-4" />
        </span>
        <p className="text-[14px] leading-relaxed text-ink">
          {runwayDelta == null ? (
            <>In this scenario the engine reports no measurable net burn, so runway is not bounded.</>
          ) : runwayDelta === 0 ? (
            <>This scenario leaves cash runway unchanged at {nextRunway} days.</>
          ) : (
            <>
              In this scenario, your cash runway {runwayDelta > 0 ? "increases" : "decreases"} by{" "}
              <strong>{pluralize(Math.abs(runwayDelta), "day")}</strong> to {nextRunway} days
              {shortfallDelta !== 0 ? (
                <>
                  , and the projected shortfall {shortfallDelta < 0 ? "shrinks" : "grows"} by{" "}
                  <strong>{formatCents(Math.abs(shortfallDelta))}</strong>
                  {result.projected.projected_shortfall_cents === 0 ? " (fully covered)" : ""}
                </>
              ) : null}
              .
            </>
          )}
          {modeling ? <span className="mt-1 block text-[12.5px] text-ink-soft">{modeling}</span> : null}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader title="Baseline vs. scenario" subtitle="Every figure below is calculated by the deterministic engine." />
          <ComparisonTable baseline={result.baseline} projected={result.projected} />
        </Card>
        <Card className="self-start">
          <CardHeader title="Engine assumptions" subtitle="Returned with every scenario result." />
          <ul className="list-disc space-y-1.5 pl-4 text-[12.5px] text-ink-soft">
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[10.5px] text-muted">{result.id}</p>
        </Card>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[12.5px] font-medium text-ink">
          {label}
        </label>
        <span className="tabular text-[12.5px] font-semibold text-ink">
          {value > 0 ? "+" : ""}
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-navy-900"
      />
      {hint ? <p className="mt-1 text-[11.5px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function ScenariosView() {
  const state = useApi("financial-state", api.getFinancialState);
  const { runs, run, reset } = useScenarioRunner();
  const [tab, setTab] = useState<Tab>("quick");
  const [selected, setSelected] = useState<string>(QUICK_SCENARIOS[1]?.id ?? QUICK_SCENARIOS[0].id);
  const [custom, setCustom] = useState<ScenarioRequest>(CUSTOM_SCENARIO_DEFAULTS);
  const [customCashDollars, setCustomCashDollars] = useState(0);

  useEffect(() => {
    QUICK_SCENARIOS.forEach((scenario) => {
      void run(scenario.id, scenario.request);
    });
  }, [run]);

  const resetAll = () => {
    reset();
    setCustom(CUSTOM_SCENARIO_DEFAULTS);
    setCustomCashDollars(0);
    setSelected(QUICK_SCENARIOS[1]?.id ?? QUICK_SCENARIOS[0].id);
    QUICK_SCENARIOS.forEach((scenario) => {
      void run(scenario.id, scenario.request);
    });
  };

  const selectedScenario: QuickScenario | undefined = QUICK_SCENARIOS.find((item) => item.id === selected);
  const selectedRun = runs[selected] ?? idle;
  const customRun = runs.custom ?? idle;
  const startDate = state.data?.as_of ?? new Date().toISOString().slice(0, 10);

  const runCustom = () => {
    void run("custom", { ...custom, cash_adjustment_cents: Math.round(customCashDollars * 100) });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Run a Scenario"
        subtitle="Explore how different outcomes change your cash runway. Every result is calculated by the deterministic engine."
        actions={
          <Button variant="secondary" size="sm" onClick={resetAll} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}>
            Reset
          </Button>
        }
      />

      <FilterPills
        label="Scenario mode"
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { key: "quick", label: "Quick scenarios" },
          { key: "custom", label: "Custom scenario" },
        ]}
      />

      {tab === "quick" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {QUICK_SCENARIOS.map((scenario) => {
              const runState = runs[scenario.id] ?? { ...idle, loading: true };
              return (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  result={runState.result}
                  loading={runState.loading}
                  error={runState.error}
                  selected={selected === scenario.id}
                  onSelect={() => setSelected(scenario.id)}
                />
              );
            })}
          </div>

          {selectedRun.error ? (
            <ErrorState
              title="Scenario could not be calculated"
              error={selectedRun.error}
              onRetry={() => selectedScenario && void run(selectedScenario.id, selectedScenario.request)}
            />
          ) : selectedRun.result ? (
            <ScenarioResultPanel result={selectedRun.result} startDate={startDate} modeling={selectedScenario?.modeling} />
          ) : (
            <Card>
              <LoadingState label="Calculating scenario" lines={5} />
            </Card>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <Card className="self-start">
            <CardHeader title="Scenario inputs" subtitle="Mapped 1:1 to the engine's request contract." />
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                runCustom();
              }}
            >
              <div>
                <label htmlFor="scenario-name" className="text-[12.5px] font-medium text-ink">
                  Scenario name
                </label>
                <input
                  id="scenario-name"
                  type="text"
                  maxLength={80}
                  required
                  value={custom.name}
                  onChange={(event) => setCustom({ ...custom, name: event.target.value })}
                  className="mt-1.5 h-9 w-full rounded-lg border border-line-strong px-3 text-[13px] text-ink focus:border-info-500"
                />
              </div>
              <NumberField
                id="revenue-change"
                label="Revenue change"
                value={custom.revenue_change_percent}
                onChange={(value) => setCustom({ ...custom, revenue_change_percent: value })}
                min={-50}
                max={50}
                step={1}
                suffix="%"
                hint="Applied uniformly to expected inflows."
              />
              <NumberField
                id="expense-change"
                label="Expense change"
                value={custom.expense_change_percent}
                onChange={(value) => setCustom({ ...custom, expense_change_percent: value })}
                min={-50}
                max={50}
                step={1}
                suffix="%"
                hint="Applied uniformly to expected outflows."
              />
              <div>
                <label htmlFor="cash-adjustment" className="text-[12.5px] font-medium text-ink">
                  One-time cash adjustment
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[13px] text-muted">$</span>
                  <input
                    id="cash-adjustment"
                    type="number"
                    step={100}
                    min={-1_000_000}
                    max={1_000_000}
                    value={customCashDollars}
                    onChange={(event) => setCustomCashDollars(Number(event.target.value) || 0)}
                    className="tabular h-9 w-full rounded-lg border border-line-strong px-3 text-[13px] text-ink focus:border-info-500"
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-muted">Positive for a receipt or loan, negative for a payment.</p>
              </div>
              <Button type="submit" className="w-full" disabled={customRun.loading} icon={<Play className="h-4 w-4" aria-hidden />}>
                {customRun.loading ? "Calculating…" : "Run scenario"}
              </Button>
            </form>
          </Card>

          <div>
            {customRun.error ? (
              <ErrorState title="Scenario could not be calculated" error={customRun.error} onRetry={runCustom} />
            ) : customRun.result ? (
              <ScenarioResultPanel result={customRun.result} startDate={startDate} />
            ) : (
              <Card>
                <CardHeader title="Cash Position Impact" subtitle="Run a custom scenario to compare it with the current projection." action={<ScenarioLegend hasScenario={false} />} />
                {state.data ? (
                  <ScenarioComparisonChart
                    baseline={{
                      current_cash_cents: state.data.current_cash_cents,
                      expected_inflows_cents: state.data.expected_inflows_cents,
                      expected_outflows_cents: state.data.expected_outflows_cents,
                      projected_ending_cash_cents: state.data.projected_ending_cash_cents,
                      minimum_cash_reserve_cents: state.data.minimum_cash_reserve_cents,
                      projected_shortfall_cents: state.data.projected_shortfall_cents,
                      average_daily_net_burn_cents: state.data.average_daily_net_burn_cents,
                      cash_runway_days: state.data.cash_runway_days,
                    }}
                    scenario={null}
                    startDate={startDate}
                    height={250}
                  />
                ) : (
                  <LoadingState lines={4} />
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
