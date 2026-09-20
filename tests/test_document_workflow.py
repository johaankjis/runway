"""Run the actual TypeScript upload coordinator against the real API via JSON lines."""

import os
import subprocess
import sys

from runway_api.repository import REPOSITORY_ROOT


def test_automatic_document_workflow():
    result = subprocess.run(
        ["node", "--test", "tests/document-workflow.test.mjs"],
        cwd=REPOSITORY_ROOT,
        env={
            **os.environ,
            "RUNWAY_TEST_PYTHON": sys.executable,
            # pytest's pythonpath setting does not propagate to the Node/Python bridge.
            # Prefer this checkout over any editable install in the shared virtualenv.
            "PYTHONPATH": os.pathsep.join(
                filter(None, [str(REPOSITORY_ROOT / "apps/api"), os.environ.get("PYTHONPATH")])
            ),
        },
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
