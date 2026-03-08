---
name: run-phase-tests
description: Run the exit gate test suite for a given build phase (phase1, phase2, ...). Every check must show ✅ PASS before advancing to the next phase.
agent: API Platform Builder
argument-hint: "phase1 | phase2 | phase3 — runs backend/tests/test_<phase>.py"
tools: ['execute/getTerminalOutput', 'execute/runInTerminal', 'read/terminalLastCommand', 'read/terminalSelection', 'search/codebase', 'search']
---

Run the exit gate test suite for **${{ phase }}**.

## Pre-flight

1. Ensure the FastAPI server is running on port 8000:
   ```bash
   curl -s http://localhost:8000/health 2>/dev/null || (
     cd /Users/sathishkr/self-aware-api-platform/backend &&
     .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 &
     sleep 3
   )
   ```

2. If this is **phase2 or later**, ensure a spec is ingested:
   ```bash
   psql selfaware_api -c "SELECT MAX(id) FROM specs;"
   # Must return a number. If empty:
   # cd /Users/sathishkr/self-aware-api-platform && \
   #   curl -X POST http://localhost:8000/api/specs/ingest \
   #        -F "file=@specs/banking-api-v1.yaml" -F "name=BankingAPI"
   ```

## Run the tests

```bash
cd /Users/sathishkr/self-aware-api-platform/backend
.venv/bin/python tests/test_${{ phase }}.py
```

## Interpret results

- Count every `✅ PASS` and `❌ FAIL` line in the output.
- **If all checks pass** (exit code 0): declare the phase complete. Update `BUILD-RUNBOOK.md` blockers to `✅ ALL RESOLVED` and tick the TODOs in `CLAUDE.md`.
- **If any check fails** (exit code 1): for each `❌ FAIL`, read the relevant production source file, diagnose the root cause, apply a fix, re-run the tests. **Fix production code — never change the test script to make a test pass.**

## Constraints

- Always use `.venv/bin/python` — *never* system `python` or `python3`.
- Run from `backend/` — all module imports depend on `sys.path`.
- Fix one issue at a time and re-run between changes to isolate regressions.

