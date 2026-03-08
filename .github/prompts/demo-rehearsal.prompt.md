---
name: demo-rehearsal
description: Run the full pre-demo checklist. Verifies all 3 demo flows, checks infrastructure, pre-loads demo data, and surfaces any broken paths before presenting.
agent: API Platform Demo Coach
tools: ['search/codebase', 'execute/getTerminalOutput', 'execute/runInTerminal', 'read/terminalLastCommand', 'read/terminalSelection', 'web/fetch', 'read/problems']
---

Run the full pre-demo checklist for the Self-Aware API Platform hackathon presentation.

## Step 1 — Infrastructure health check

Run these checks and report pass/fail for each:

```bash
# Postgres
pg_isready
# Expected: /tmp:5432 - accepting connections

# Backend
curl -s http://localhost:8000/health
# Expected: {"status": "ok"}

# Prism mock
curl -s -X GET http://localhost:4010/accounts
# Expected: any valid mock JSON response (not connection refused)

# Both specs ingested
curl -s http://localhost:8000/api/specs
# Expected: array with 2 specs (v1 and v2 of Banking API)
```

If anything fails, stop here and report what needs to be started.

**Startup sequence** (if services are not running):
```bash
# Terminal 1
cd ~/self-aware-api-platform/backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2
cd ~/self-aware-api-platform/frontend && npm run dev

# Terminal 3
prism mock ~/self-aware-api-platform/specs/banking-api-v1.yaml --port 4010
```

---

## Step 2 — Demo 1 rehearsal: Discover & Validate

Test query to send via the chat API:
```bash
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I create a corporate deposit account?", "spec_id": 1}' \
  | python3 -m json.tool
```

Check the response for:
- [ ] Agent called `spec_search` tool (visible in tool_calls)
- [ ] Agent called `spec_get_endpoint` tool
- [ ] Response contains a generated payload example
- [ ] Response contains validation result (valid: true)
- [ ] Response includes provenance: spec version + operationId

---

## Step 3 — Demo 2 rehearsal: Breaking Change Detection

```bash
curl -s -X POST http://localhost:8000/api/specs/compare \
  -H "Content-Type: application/json" \
  -d '{"spec_id_old": 1, "spec_id_new": 2}' \
  | python3 -m json.tool
```

Check the response for:
- [ ] At least 2 items with `breaking: true`
- [ ] One item: field `companyRegistrationNumber`, change_type `REQUIRED_ADDED`
- [ ] One item: field `accountType`, change_type `ENUM_CHANGED`
- [ ] At least 1 item with `breaking: false` (kycStatus)
- [ ] `breaking_count: 2` in the summary

---

## Step 4 — Demo 3 rehearsal: Self-Heal

```bash
curl -s -X POST http://localhost:8000/api/agent/self-heal \
  -H "Content-Type: application/json" \
  -d '{"diff_id": 1}' \
  | python3 -m json.tool
```

Check the response for:
- [ ] `before_payload` present (missing `companyRegistrationNumber`)
- [ ] `after_payload` present (includes `companyRegistrationNumber`)
- [ ] `validated: true` on the after payload
- [ ] `migration_steps` list has at least 1 entry

---

## Step 5 — Audit log check

```bash
curl -s http://localhost:8000/api/audit-logs?limit=10 | python3 -m json.tool
```

- [ ] At least 5 entries from the test runs above
- [ ] Each entry has: tool_name, inputs, outputs, duration_ms, created_at
- [ ] No raw API keys visible in any entry

---

## Step 6 — UI smoke test (manual)

Open `http://localhost:5173` in browser and verify:
- [ ] 3-panel layout renders (Chat | Spec | Validation)
- [ ] Typing a question and submitting returns a response
- [ ] Tool call chips appear in the chat (collapsible)
- [ ] Provenance badge visible on agent response
- [ ] Upload button visible
- [ ] Compare button appears after upload

---

## Step 7 — Demo data reset (run before presenting)

```bash
# Re-ingest both specs for a clean demo state
curl -s -X POST http://localhost:8000/api/specs/ingest \
  -F "file=@~/self-aware-api-platform/specs/banking-api-v1.yaml" \
  -F "name=Banking API"

curl -s -X POST http://localhost:8000/api/specs/ingest \
  -F "file=@~/self-aware-api-platform/specs/banking-api-v2.yaml" \
  -F "name=Banking API"

echo "✅ Demo data ready"
```

---

## Final report format

```
## Demo Rehearsal Report — [timestamp]

### Infrastructure
- Postgres: ✅/❌
- Backend: ✅/❌
- Prism: ✅/❌
- Specs ingested: ✅/❌

### Demo 1 — Discover & Validate: ✅ SAFE / ⚠️ AT RISK / ❌ BLOCKED
[any issues]

### Demo 2 — Breaking Change: ✅ SAFE / ⚠️ AT RISK / ❌ BLOCKED
[any issues]

### Demo 3 — Self-Heal: ✅ SAFE / ⚠️ AT RISK / ❌ BLOCKED
[any issues]

### Audit log: ✅/❌

### Overall: GO / NO-GO
[if NO-GO: list blockers in priority order]
```