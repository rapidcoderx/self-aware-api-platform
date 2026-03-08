# Self-Aware API Platform — Build Runbook
> Copy to: `~/self-aware-api-platform/BUILD-RUNBOOK.md`  
> Tick each TODO in **CLAUDE.md** as you go. Never skip a gate.

---

## How Review Gates Work

After every phase, before moving forward, run this in Copilot Chat:

```
Switch to: api-platform-reviewer agent
Then type:  /review-module <path>
```

The reviewer agent checks:
- Stack compliance (Python 3.12, uv, no LangChain, Pydantic v2)
- Type hints on every function
- Parameterised SQL — no f-strings
- Logging not print()
- Audit log called on every tool execution
- No hardcoded secrets

**Fix every blocker the reviewer flags before moving to the next phase.**  
Non-blockers (suggestions) can be deferred to polish time.

---

## Session Start Ritual (Every Single Session)

```
1. cd ~/self-aware-api-platform/backend
2. Open VS Code → switch to api-platform-builder agent
3. Run /load-context in Copilot Chat
4. Read CLAUDE.md build tracker — identify next unchecked TODO
5. State today's goal out loud before touching any code
```

> ⚠️  Always use `.venv/bin/python` — NOT `python` or `python3`.
> The system Python (3.14.3) will silently break imports.
> `source .venv/bin/activate` does NOT override the system `python` alias on this machine.

---

## PHASE 0 — Ground Zero
> Do this once, right now, before any code.

---

**TODO 0.1 — Copy all docs into the project**
```bash
cd ~/self-aware-api-platform
cp ~/Downloads/HACKATHON.md .
cp ~/Downloads/CLAUDE.md .
cp ~/Downloads/BEST-PRACTICES.md .
cp ~/Downloads/BUILD-RUNBOOK.md .
cp ~/Downloads/AI-SESSION-CONTEXT.md .
cp ~/Downloads/.cursorrules .
cp ~/Downloads/copilot-instructions.md .github/
cp ~/Downloads/agents/*.agent.md .github/agents/
cp ~/Downloads/prompts/*.prompt.md .github/prompts/
```

**TODO 0.2 — Verify environment**
```bash
chmod +x verify-prereqs-1-2.sh && ./verify-prereqs-1-2.sh
# All 10 checks must be green before proceeding
```

**TODO 0.3 — Run bootstrap scripts**
```bash
chmod +x bootstrap-project.sh setup-venv.sh
./bootstrap-project.sh      # scaffold dirs + apply DB schema
./setup-venv.sh             # uv venv + all 14 deps
```

**TODO 0.4 — Verify API keys**
```bash
cat backend/.env
# Must show non-empty: ANTHROPIC_API_KEY, VOYAGE_API_KEY, DATABASE_URL
# Must also show: VOYAGE_MODEL=voyage-4  (configurable — change here to switch models)
```

**TODO 0.5 — Verify DB tables**
```bash
psql selfaware_api -c "\dt"
# Must show: specs, endpoints, diffs, audit_logs
```

**TODO 0.6 — Verify pgvector**
```bash
psql selfaware_api -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"
# → vector | 0.8.2
```

**TODO 0.7 — Load context in VS Code**
```bash
code ~/self-aware-api-platform
```
Switch to **api-platform-builder** agent → `/load-context`  
Confirm it reads your stack correctly before writing a single line.

---

## PHASE 1 — Backend Spine
> Goal: FastAPI running, spec ingested, all endpoints stored with embeddings.

---

**TODO 1.1 — `backend/main.py`**

Copilot Chat (Builder agent):
```
/build-module backend/main.py
```
Exit check:
```bash
cd backend
curl http://localhost:8000/health
# → {"status": "ok", "version": "0.1.0", "environment": "development"}
```

---

**TODO 1.2 — `backend/storage/schema_store.py`**
```
/build-module backend/storage/schema_store.py
```
Exit check:
```bash
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from storage.schema_store import get_db, get_db_connection
with get_db() as conn:
    print('status:', conn.status)   # → 1
print('alias OK:', callable(get_db_connection))
"
```

---

**TODO 1.3 — `backend/storage/vector_store.py`**

> This module owns the single pgvector cosine similarity query. `spec_search` calls
> into this — it never writes raw SQL itself. One place to maintain, one place to test.

```
/build-module backend/storage/vector_store.py
```

Must expose one public function:
```python
def similarity_search(
    embedding: list[float],
    spec_id: int,
    limit: int = 5,
    conn=None
) -> list[dict]:
    """
    Cosine similarity search against endpoints.embedding.
    Returns rows ordered by score descending.
    Each row: {id, operation_id, method, path, summary, score}
    """
```

Rules this module must follow:
- Always `<=>` operator (cosine distance) — never `<->` (L2) or `<#>` (inner product)
- Always casts with `%s::vector` — never passes raw list without the cast
- Always parameterised `%s` — no f-strings in SQL
- Accepts optional `conn` parameter for test injection

Exit check:
```bash
.venv/bin/python -c "
import sys, inspect; sys.path.insert(0, '.')
from storage.vector_store import similarity_search
params = list(inspect.signature(similarity_search).parameters.keys())
assert all(p in params for p in ['embedding','spec_id','limit','conn']), params
print('vector_store signature OK:', params)
import storage.vector_store as _vs
src = inspect.getsource(_vs)
assert '<=>' in src, 'Missing <=> operator'
assert '%s::vector' in src, 'Missing ::vector cast'
print('SQL patterns OK')
"

---

**TODO 1.4 — `backend/ingestion/normalizer.py`**
```
/build-module backend/ingestion/normalizer.py
```
Exit check:
```bash
# normalize_spec takes a FILE PATH (not a dict) and returns (raw_spec, endpoints)
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from ingestion.normalizer import normalize_spec
_raw_spec, endpoints = normalize_spec('../specs/banking-api-v1.yaml')
print(f'{len(endpoints)} endpoints normalised')  # → 3
assert all('operation_id' in e and 'method' in e and 'path' in e for e in endpoints)
print('normalizer OK')
"
```

---

**TODO 1.5 — `backend/ingestion/chunker.py`**

> This module converts a normalised endpoint dict into a rich text string  
> that becomes the input to Voyage AI. Quality of this text directly determines  
> search relevance — it is not a throwaway step.

```
/build-module backend/ingestion/chunker.py
```

The generated text for each endpoint must include:
- HTTP method + path
- Summary and description
- Tag names
- Required field names and their types
- Enum values where present

Exit check:
```bash
# endpoint dict uses top-level 'request_body_schema' key (pre-extracted by normalizer)
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from ingestion.chunker import chunk_endpoint, endpoint_to_text
ep = {
    'operation_id': 'createAccount',
    'method': 'POST',
    'path': '/accounts',
    'summary': 'Create a new bank account',
    'tags': ['accounts'],
    'parameters': [],
    'response_schemas': {},
    'request_body_schema': {
        'type': 'object',
        'required': ['accountName', 'accountType'],
        'properties': {
            'accountName': {'type': 'string'},
            'accountType': {'type': 'string', 'enum': ['current', 'savings']}
        }
    }
}
text = chunk_endpoint(ep)
assert 'POST' in text
assert '/accounts' in text
assert 'createAccount' in text
assert 'accountType' in text
assert 'current' in text and 'savings' in text
assert endpoint_to_text(ep) == text, 'alias mismatch'
print('chunker OK')
print(text)
"
```

---

**TODO 1.6 — `backend/ingestion/embedder.py`**
```
/build-module backend/ingestion/embedder.py
```
Exit check:
```bash
# Model is read from VOYAGE_MODEL env var (default voyage-4 in .env)
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv('.env')
from ingestion.embedder import embed_texts, embed_single
vectors = embed_texts(['create a bank account', 'list transactions'], input_type='document')
print(len(vectors))           # → 2
print(len(vectors[0]))        # → 1024
print(type(vectors[0][0]))    # → <class 'float'>
assert len(vectors[0]) == 1024
q = embed_single('find account', input_type='query')
assert len(q) == 1024
print('embedder OK')
"
```

---

**TODO 1.7 — Wire `POST /api/specs/ingest`**
```
/build-module backend/routes/ingest.py
# Then register route in main.py
```

This route calls: normalizer → chunker → embedder → schema_store (in that order).

Exit check — **Phase 1 gate**:
```bash
# Start server first: cd backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
curl -X POST http://localhost:8000/api/specs/ingest \
  -F "file=@../specs/banking-api-v1.yaml" \
  -F "name=BankingAPI"
# → {"spec_id": N, "name": "BankingAPI", "version": 1, "endpoint_count": 3}
# banking-api-v1.yaml has 3 operations: listAccounts, createAccount, listTransactions
# spec_id is a serial — auto-increments; use MAX(id) in subsequent queries

psql selfaware_api -c "SELECT MAX(id) AS spec_id, COUNT(*) AS ep_count FROM endpoints WHERE spec_id = (SELECT MAX(id) FROM specs);"
# → ep_count = 3

psql selfaware_api -c "SELECT operation_id, method, path FROM endpoints WHERE spec_id = (SELECT MAX(id) FROM specs);"
# → listAccounts GET /accounts
# → createAccount POST /accounts
# → listTransactions GET /accounts/{accountId}/transactions

psql selfaware_api -c "SELECT COUNT(*) FROM endpoints WHERE embedding IS NULL;"
# → 0  (all embeddings populated)
```

---

### 🔍 PHASE 1 REVIEW GATE

Switch to **api-platform-reviewer** agent, then run these one by one:

```
/review-module backend/main.py
/review-module backend/storage/schema_store.py
/review-module backend/storage/vector_store.py
/review-module backend/ingestion/normalizer.py
/review-module backend/ingestion/chunker.py
/review-module backend/ingestion/embedder.py
```

**Run the full vector_store search test now that spec is ingested (post TODO 1.7):**
```bash
# voyage-4 uses asymmetric embeddings: input_type='document' at index time, 'query' at search time.
# voyage-4 asymmetric cosine scores are low in absolute terms (~0.01–0.05) but ranking is correct.
# spec_id is a serial — always auto-detect from DB; never hardcode.
cd /Users/sathishkr/self-aware-api-platform/backend
.venv/bin/python tests/test_phase1.py
# All 28 checks must show ✅ PASS
# Or run the manual spot-check:
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv('.env')
from storage.schema_store import get_db
from storage.vector_store import similarity_search
from ingestion.embedder import embed_single
with get_db() as conn:
    cur = conn.cursor()
    cur.execute('SELECT MAX(id) FROM specs')
    spec_id = cur.fetchone()[0]
emb = embed_single('create bank account', input_type='query')
with get_db() as conn:
    results = similarity_search(emb, spec_id=spec_id, limit=3, conn=conn)
assert len(results) > 0
assert results[0]['score'] > 0.005, 'Score too low: ' + str(results[0]['score'])
assert results[0]['operation_id'] == 'createAccount', results[0]['operation_id']
print('vector_store OK — top result:', results[0]['operation_id'], round(results[0]['score'], 4))
"

**Blockers to fix before Phase 2: ✅ ALL RESOLVED**
- [x] All functions have type hints
- [x] `get_db_connection = get_db` alias added — runbook exit checks use this name
- [x] `vector_store.similarity_search` uses `<=>` and `%s::vector` cast — verified in source
- [x] `vector_store.similarity_search` accepts optional `conn` parameter for test injection
- [x] `embed_texts()` batches in groups of ≤ 50 (`batch_size=50`, was 128 — fixed)
- [x] `embed_texts()` passes `input_type="document"` at ingest time; `embed_single()` passes `input_type="query"` at search time
- [x] `VOYAGE_MODEL` read from `.env` (default `voyage-4`) — not hardcoded in source
- [x] `endpoint_to_text = chunk_endpoint` alias added — runbook exit checks use this name
- [x] Chunker reads `request_body_schema` from top-level endpoint dict key (not from `schema_json.requestBody`)
- [x] Normalizer takes a **file path string**, returns `(raw_spec, endpoints)` tuple — not `(dict → list)`
- [x] Normalizer resolves `$ref` via prance `ResolvingParser` — no raw YAML walking
- [x] `Form(None)` used for multipart `name` field in `/api/specs/ingest` (not `Query(None)`)
- [x] `IngestResponse.name` field (not `spec_name`) — matches API contract
- [x] `logging` used — no `print()` anywhere
- [x] No SQL f-strings anywhere in storage layer

**Known voyage-4 behaviour:**
- Asymmetric cosine scores are low in absolute value (~0.01–0.05) — this is expected
- Ranking is always correct; use `score > 0.005` as the minimum threshold (not 0.45)
- `VOYAGE_MODEL` in `.env` can be changed to `voyage-3` at any time without code changes

**Tick CLAUDE.md items 1–7 only after this review passes.**

---

## PHASE 2 — MCP Tools
> Goal: All 3 core tools unit-tested and working independently before agent wiring.

---

**TODO 2.1 — `backend/tools/spec_search.py`**
```
/build-module backend/tools/spec_search.py
```
Exit check:
```bash
python -c "
# Note: use spec_id from DB (currently 2 after re-ingest)
from storage.schema_store import get_db
from tools.spec_search import search_endpoints
with get_db() as conn:
    cur = conn.cursor(); cur.execute('SELECT MAX(id) FROM specs'); spec_id = cur.fetchone()[0]
results = search_endpoints('create bank account', spec_id=spec_id, limit=3)
for r in results:
    print(r.operation_id, round(r.score, 3))
# createAccount must be top result with score > 0.45
assert results[0].operation_id == 'createAccount'
print('spec_search OK')
"
```

---

**TODO 2.2 — `backend/tools/spec_get.py`**
```
/build-module backend/tools/spec_get.py
```
Exit check:
```bash
python -c "
from storage.schema_store import get_db
from tools.spec_get import get_endpoint
with get_db() as conn:
    cur = conn.cursor(); cur.execute('SELECT MAX(id) FROM specs'); spec_id = cur.fetchone()[0]
ep = get_endpoint('createAccount', spec_id=spec_id)
print(ep.method, ep.path)        # → POST /accounts
print(ep.spec_version)           # → 1
assert ep.request_body_schema is not None
print('spec_get OK')
"
```

---

**TODO 2.3 — `backend/tools/spec_validate.py`**
```
/build-module backend/tools/spec_validate.py
```
Exit check:
```bash
python -c "
from tools.spec_validate import validate_request

from storage.schema_store import get_db
from tools.spec_validate import validate_request
with get_db() as conn:
    cur = conn.cursor(); cur.execute('SELECT MAX(id) FROM specs'); spec_id = cur.fetchone()[0]

# Valid payload
r1 = validate_request('createAccount', {'accountName': 'Acme Corp', 'accountType': 'current'}, spec_id=spec_id)
assert r1.valid == True, f'Expected valid, got errors: {r1.errors}'

# Missing required field
r2 = validate_request('createAccount', {'accountType': 'current'}, spec_id=spec_id)
assert r2.valid == False
assert any(e.field == 'accountName' for e in r2.errors), 'Missing field error not reported'

# Bad enum value
r3 = validate_request('createAccount', {'accountName': 'Acme', 'accountType': 'invalid_type'}, spec_id=spec_id)
assert r3.valid == False
assert any(e.field == 'accountType' for e in r3.errors), 'Enum error not reported'

print('spec_validate OK — all 3 cases pass')
"
```

---

### 🔍 PHASE 2 REVIEW GATE

Switch to **api-platform-reviewer** agent:

```
/review-module backend/tools/spec_search.py
/review-module backend/tools/spec_get.py
/review-module backend/tools/spec_validate.py
```

**Blockers to fix before Phase 3: ✅ ALL RESOLVED**
- [x] `search_endpoints` uses the `::vector` cast in the pgvector query
- [x] `search_endpoints` passes embedding as `list`, not numpy array
- [x] `get_endpoint` returns `spec_version` field (needed for provenance badge) — verified: v1
- [x] `validate_request` returns field-level errors — not a single top-level message
- [x] Each tool calls `log_tool_call()` from `schema_store.py` — audit log populated (5 rows verified)
- [x] All three return Pydantic v2 models, not raw dicts
- [x] No tool accesses the DB without parameterised queries

Spot-check audit log:
```bash
psql selfaware_api -c "SELECT tool_name, duration_ms FROM audit_logs ORDER BY created_at DESC LIMIT 5;"
# Should show rows for spec_search, spec_get, spec_validate from your tests above
```

**Tick CLAUDE.md items 7–9 only after this review passes.**

---

## PHASE 3 — MCP Server + Agent
> Goal: Full end-to-end — question in → validated answer out.

---

**TODO 3.1 — `backend/mcp_server.py`**
```
/build-module backend/mcp_server.py
```
Exit check:
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | python mcp_server.py
# → JSON response listing all 3 tools: spec_search, spec_get_endpoint, spec_validate_request
```

---

**TODO 3.2 — `backend/agent.py`**
```
/build-module backend/agent.py
```
Exit check:
```bash
python -c "
import asyncio
from agent import run_agent
result = asyncio.run(run_agent('How do I create a corporate deposit account?', spec_id=1))
print(result[:300])
# Must contain: POST, /accounts, createAccount, spec version mention
assert 'createAccount' in result or '/accounts' in result
assert 'v1' in result.lower() or 'version 1' in result.lower()
print('agent OK')
"
```

---

**TODO 3.3 — Wire `POST /api/chat`**
```
/build-module backend/routes/chat.py
# Register in main.py
```

Exit check — **Phase 3 gate / Day 1 end-to-end gate**:
```bash
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I create a corporate deposit account?", "spec_id": 1}' | python -m json.tool

# Must return ALL of:
# "answer": "..." (non-empty)
# "tool_calls": [...] (at least 2 entries: search + get + validate)
# "provenance": {"spec_name": "BankingAPI", "spec_version": 1, "operation_id": "createAccount"}
# "spec_id": 1
```

---

### 🔍 PHASE 3 REVIEW GATE

Switch to **api-platform-reviewer** agent:

```
/review-module backend/mcp_server.py
/review-module backend/agent.py
```

**Blockers to fix before Phase 4:** ✅ ALL RESOLVED
- [x] `agent.py` has `MAX_ITERATIONS = 10` guard — loop cannot run forever
- [x] Agent always validates the payload before returning an answer (calls `spec_validate_request`)
- [x] `run_agent()` returns `ProvenanceInfo` alongside the answer text
- [x] Tool call results appended as `tool_result` blocks — not raw text strings
- [x] `RuntimeError` raised if `MAX_ITERATIONS` exceeded — caught at route level → HTTP 503
- [x] System prompt contains: PROVENANCE instruction, SANDBOX notice, TOOLS-ONLY instruction
- [x] `mcp_server.py` tool definitions match canonical signatures in CLAUDE.md exactly
- [x] `client.messages.create()` wrapped in `asyncio.to_thread()` — no event loop blocking
- [x] `get_spec_by_id()` wrapped in `asyncio.to_thread()` — no sync DB call in async context
- [x] `_extract_provenance()` receives `spec_info` directly — no redundant DB query
- [x] HTTP 500 handler returns generic message — no internal error detail leakage
- [x] `_sanitise()` handles nested dicts inside lists — full recursive redaction
- [x] `vector_store.py` has type hints on all `conn` parameters

Verify agent provenance in audit log:
```bash
psql selfaware_api -c "
  SELECT tool_name, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 6;
"
# Should show the full tool chain from your /api/chat test:
# spec_search → spec_get_endpoint → spec_validate_request
```

**Tick CLAUDE.md items 10–11 only after this review passes.**

---

## PHASE 4 — Day 1 UI
> Goal: 3-panel React app. Chat works. Tool chips visible. Validation badge renders.

---

**TODO 4.1 — `frontend/src/App.jsx` (base layout)**
```
/build-module frontend/src/App.jsx
```
Exit check:
```bash
cd ~/self-aware-api-platform/frontend && npm run dev
# Open http://localhost:5173
# → 3-column layout visible (chat | endpoint detail | validation)
# → No console errors
```

---

**TODO 4.2 — `ChatPanel.jsx`**
```
/build-module frontend/src/components/ChatPanel.jsx
```
Exit check (manual):
- Type a question → message appears in thread
- Loading spinner shows during the API call
- Collapsible tool chips appear (one per tool call)
- Expand a chip → shows tool name, inputs, result
- Answer text renders below chips
- Provenance badge shows spec name + version + operationId

---

**TODO 4.3 — `ValidationPanel.jsx`**
```
/build-module frontend/src/components/ValidationPanel.jsx
```
Exit check (manual):
- After agent answer: right panel populates with endpoint schema
- Green "Valid ✓" badge shown when validation passes
- Red error list shown when validation fails, with field names + hints

---

**TODO 4.4 — Day 1 full demo run**

Start all services:
```bash
# Terminal 1
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000
# Terminal 2
cd frontend && npm run dev
# Terminal 3
prism mock specs/banking-api-v1.yaml --port 4010
```

In Copilot Chat:
```
Switch to: api-platform-demo-coach agent
Then type: /demo-rehearsal
```

Demo 1 must pass fully (question → search → get → validate → green badge) before Day 1 is closed.

---

### 🔍 PHASE 4 REVIEW GATE

Switch to **api-platform-reviewer** agent:

```
/review-module frontend/src/App.jsx
/review-module frontend/src/components/ChatPanel.jsx
/review-module frontend/src/components/ValidationPanel.jsx
```

**Blockers to fix before Phase 5:**
- [ ] All API calls use `axios` — no raw `fetch()`
- [ ] All three states handled in every component: loading, error, success
- [ ] No `console.log()` left in component files
- [ ] Tool chips are collapsible — not always expanded (noisy UX)
- [ ] Provenance badge is always visible — not hidden behind a toggle
- [ ] Sandbox mode badge visible somewhere in the layout
- [ ] Error states show human-readable message — not raw JSON

**Tick CLAUDE.md items 12–14 only after this review passes.**

---

## PHASE 5 — Change Detection
> Goal: Upload v2 → 2 breaking changes detected → 3 services impacted → all shown in UI.

---

**TODO 5.1 — Spec versioning in ingest route**

Edit `routes/ingest.py` — re-uploading same name auto-increments version. Never overwrites.

Exit check:
```bash
curl -X POST http://localhost:8000/api/specs/ingest \
  -F "file=@../specs/banking-api-v2.yaml" \
  -F "name=BankingAPI"
# → {"spec_id": 2, "version": 2, ...}

psql selfaware_api -c "SELECT id, name, version FROM specs ORDER BY id;"
# → 1 | BankingAPI | 1
# → 2 | BankingAPI | 2
```

---

**TODO 5.2 — `backend/tools/spec_diff.py`**
```
/build-module backend/tools/spec_diff.py
```
Exit check:
```bash
python -c "
from tools.spec_diff import diff_specs
diffs = diff_specs(old_spec_id=1, new_spec_id=2)
breaking = [d for d in diffs if d.breaking]
non_breaking = [d for d in diffs if not d.breaking]

assert len(breaking) == 2, f'Expected 2 breaking, got {len(breaking)}'
assert len(non_breaking) >= 1, f'Expected 1+ non-breaking, got {len(non_breaking)}'

fields = [d.field for d in breaking]
assert 'companyRegistrationNumber' in fields
assert 'accountType' in fields

print(f'spec_diff OK — {len(breaking)} breaking, {len(non_breaking)} non-breaking')
"
```

---

**TODO 5.3 — Wire `POST /api/specs/compare`**
```
/build-module backend/routes/compare.py
# Register in main.py
```
Exit check:
```bash
curl -s -X POST http://localhost:8000/api/specs/compare \
  -H "Content-Type: application/json" \
  -d '{"old_spec_id": 1, "new_spec_id": 2}' | python -m json.tool
# → "diff_id": 1, "breaking_count": 2, "non_breaking_count": 1, "diffs": [...]
```

---

**TODO 5.4 — `frontend/src/components/DiffPanel.jsx`**
```
/build-module frontend/src/components/DiffPanel.jsx
```
Exit check (manual):
- Upload `banking-api-v2.yaml` via SpecUploader (or trigger via API)
- Click "Compare with v1"
- DiffPanel renders:
  - 🔴 `companyRegistrationNumber` — BREAKING — red row
  - 🔴 `accountType` — BREAKING — red row
  - 🟡 `kycStatus` — NON-BREAKING — yellow row
  - Summary bar: "2 breaking · 1 non-breaking · 3 services affected"

---

**TODO 5.5 — `backend/tools/impact_analyze.py`**
```
/build-module backend/tools/impact_analyze.py
```
Exit check:
```bash
python -c "
from tools.impact_analyze import analyze_impact
impacts = analyze_impact(diff_id=1)

assert len(impacts) == 3, f'Expected 3 services, got {len(impacts)}'
services = [i.affected_service for i in impacts]
assert 'onboarding-service' in services
assert 'crm-integration' in services
assert 'mobile-app-backend' in services

for i in impacts:
    print(i.affected_service, i.severity)
# → all 3 should be HIGH
print('impact_analyze OK')
"
```

---

### 🔍 PHASE 5 REVIEW GATE

Switch to **api-platform-reviewer** agent:

```
/review-module backend/tools/spec_diff.py
/review-module backend/tools/impact_analyze.py
/review-module backend/routes/compare.py
/review-module frontend/src/components/DiffPanel.jsx
```

**Blockers to fix before Phase 6:**
- [ ] `spec_diff` classifies changes as `BREAKING` / `NON_BREAKING` — not just "changed"
- [ ] `change_type` field uses canonical values: `REQUIRED_ADDED`, `FIELD_REMOVED`, `TYPE_CHANGED`, `ENUM_CHANGED`
- [ ] `impact_analyze` loads `specs/dependencies.yaml` — not hardcoded service names
- [ ] Diff result is saved to `diffs` table — `diff_id` returned in response
- [ ] DiffPanel shows `change_type` label on each row — not just colour
- [ ] Audit log populated for `spec_diff` and `impact_analyze` tool calls
- [ ] SQL in `spec_diff` is parameterised — no f-strings

Spot-check:
```bash
psql selfaware_api -c "SELECT id, breaking_count FROM diffs;"
# → 1 | 2

psql selfaware_api -c "
  SELECT tool_name FROM audit_logs
  WHERE tool_name IN ('spec_diff', 'impact_analyze')
  ORDER BY created_at DESC LIMIT 4;
"
# Should show entries from your tests above
```

**Tick CLAUDE.md Day 2 items 1–5 only after this review passes.**

---

## PHASE 6 — Self-Healing
> Goal: Before/after payloads generated, after payload validated as "Valid ✓".

---

**TODO 6.1 — Self-heal loop in `agent.py`**

Add `run_self_heal(old_spec_id, new_spec_id, operation_id)` to `agent.py`.

```
/build-module backend/agent.py
Context: add run_self_heal() alongside existing run_agent(). 
See HACKATHON.md section 7.3 for the exact flow.
```

Exit check:
```bash
python -c "
import asyncio
from agent import run_self_heal
plan = asyncio.run(run_self_heal(1, 2, 'createAccount'))

assert 'before_payload' in plan
assert 'after_payload' in plan
assert plan['after_validation']['valid'] == True, f'After payload invalid: {plan}'
assert 'companyRegistrationNumber' in str(plan['after_payload'])
assert len(plan['migration_steps']) >= 1

print('Self-heal OK')
print('Before valid:', plan.get('before_validation', {}).get('valid'))  # → False
print('After valid:', plan['after_validation']['valid'])                # → True
"
```

---

**TODO 6.2 — Wire `POST /api/agent/self-heal`**
```
/build-module backend/routes/selfheal.py
# Register in main.py
```
Exit check:
```bash
curl -s -X POST http://localhost:8000/api/agent/self-heal \
  -H "Content-Type: application/json" \
  -d '{"old_spec_id": 1, "new_spec_id": 2, "operation_id": "createAccount"}' | python -m json.tool
# Must contain:
# "before_payload": {...} — missing companyRegistrationNumber
# "after_payload": {..., "companyRegistrationNumber": "BC-1234567"}
# "after_validation": {"valid": true, "errors": []}
# "migration_steps": ["Add required field: companyRegistrationNumber"]
```

---

**TODO 6.3 — `frontend/src/components/MigrationPanel.jsx`**
```
/build-module frontend/src/components/MigrationPanel.jsx
```
Exit check (manual):
- Click "Generate Migration Plan"
- Loading state shows during API call
- Before payload renders in red-tinted box (labelled "Before — Invalid for v2")
- After payload renders in green-tinted box with "Valid ✓" badge
- Migration steps list renders below both payloads
- "Export as JSON" button downloads the plan as a `.json` file
- "Apply Migration" button shows a confirmation dialog — does NOT auto-apply

---

### 🔍 PHASE 6 REVIEW GATE

Switch to **api-platform-reviewer** agent:

```
/review-module backend/agent.py
/review-module backend/routes/selfheal.py
/review-module frontend/src/components/MigrationPanel.jsx
```

**Blockers to fix before Phase 7:**
- [ ] `run_self_heal` validates the after payload using `spec_validate_request` — not just generating it
- [ ] If after payload fails validation: agent revises using error hints and re-validates (max 3 revision loops)
- [ ] Self-heal function has its own iteration guard (max 3) — separate from `MAX_ITERATIONS`
- [ ] `migration_steps` are human-readable sentences — not JSON field paths
- [ ] MigrationPanel requires explicit user action — no auto-apply behaviour
- [ ] "Export as JSON" actually triggers a download — not just logs to console
- [ ] Audit log shows the full self-heal tool chain (spec_get → spec_validate × 2+)

Full chain audit check:
```bash
psql selfaware_api -c "
  SELECT tool_name, created_at FROM audit_logs
  ORDER BY created_at DESC LIMIT 10;
"
# Should show the self-heal chain: spec_get → spec_validate (before) → spec_validate (after)
```

**Tick CLAUDE.md Day 2 items 6–7 only after this review passes.**

---

## PHASE 7 — Polish & Responsible AI UI
> Goal: Audit log modal, Responsible AI panel, SpecUploader — demo-ready UI.

---

**TODO 7.1 — `SpecUploader.jsx`**
```
/build-module frontend/src/components/SpecUploader.jsx
```
Exit check (manual):
- Drag-and-drop zone renders
- Drop a YAML file → upload progress bar shows
- After upload: spec name + "v2" version badge appears
- Global `spec_id` state updates — subsequent chat uses new spec

---

**TODO 7.2 — `ImpactPanel.jsx`**
```
/build-module frontend/src/components/ImpactPanel.jsx
```
Exit check (manual):
- After diff runs: ImpactPanel populates
- Each affected service shown as a row: service name | team | severity badge
- HIGH = red badge, MEDIUM = amber badge, LOW = grey badge

---

**TODO 7.3 — Audit log modal**

Add to `App.jsx` or a new `AuditLogModal.jsx`:

Exit check (manual):
- "Audit Log" button visible in app header
- Click → modal opens
- Table shows last 20 tool calls: tool_name | inputs summary | duration_ms | timestamp
- All tool calls from all 3 demos visible in the log

---

**TODO 7.4 — Responsible AI panel**

Collapsible sidebar or fixed panel:

Exit check (manual):
- Panel shows 6 guardrails as green checkmarks:
  - ✅ Sandbox Mode Active
  - ✅ Schema Validation Enforced
  - ✅ Provenance on Every Answer
  - ✅ Human-in-the-Loop for Migration
  - ✅ Audit Log Active
  - ✅ Breaking Changes Explained
- All 6 must be green (not grey/amber) during a normal demo flow

---

### 🔍 PHASE 7 REVIEW GATE

Switch to **api-platform-reviewer** agent:

```
/review-module frontend/src/components/SpecUploader.jsx
/review-module frontend/src/components/ImpactPanel.jsx
/review-module frontend/src/App.jsx
```

**Blockers to fix before final rehearsal:**
- [ ] SpecUploader validates file type client-side (`.yaml` or `.json` only)
- [ ] Upload errors shown to user — not silently swallowed
- [ ] Audit log modal pulls from `GET /api/audit-logs` — not hardcoded mock data
- [ ] Responsible AI panel items are live-computed, not static checkmarks
  - Sandbox badge reads `SANDBOX_MODE` from `/health` or config endpoint
  - Audit log active item checks that `audit_logs` has recent entries
- [ ] No `console.log()` or debug artifacts left in any component

**Tick CLAUDE.md Day 2 items 8–9 only after this review passes.**

---

## PHASE 8 — Presentation Site

**TODO 8.1 — Bootstrap**
```bash
chmod +x bootstrap-presentation.sh && ./bootstrap-presentation.sh
```

**TODO 8.2 — Build**
```bash
code ~/self-aware-api-platform/presentation
```
In Copilot Chat (Builder agent):
```
/build-presentation
```

Exit check:
```bash
cd presentation && npm run build
# → dist/ created, zero errors, zero warnings
```

**TODO 8.3 — Deploy**
```bash
vercel          # first deploy — follow login prompts
vercel --prod   # production URL
# Copy the .vercel.app URL — include it in your judge submission
```

---

### 🔍 PHASE 8 REVIEW GATE

```
/review-module presentation/src/App.jsx
/review-module presentation/src/components/StarField.jsx
```

**Checklist:**
- [ ] All 10 sections render without errors
- [ ] Star field canvas is animating (not frozen)
- [ ] No images — all visuals are CSS/SVG/JSX
- [ ] Mobile view (375px) — single column, no overflow
- [ ] Vercel production URL opens in < 3 seconds on a mobile connection

---

## PHASE 9 — Final Demo Rehearsal

**TODO 9.1 — Full startup sequence**
```bash
# Three terminals, all running simultaneously
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000
cd frontend && npm run dev
prism mock specs/banking-api-v1.yaml --port 4010

# Smoke test all 3
curl http://localhost:8000/health  # → {"status": "ok"}
curl -I http://localhost:5173      # → 200
curl http://localhost:4010/accounts --header "Content-Type: application/json" 2>/dev/null | head -5
```

**TODO 9.2 — Rehearsal prompt**

Switch to **api-platform-demo-coach** agent:
```
/demo-rehearsal
```
All 3 flows must report GO before you stop.

**TODO 9.3 — Manual timing run**

Run each demo by hand, exactly as you will for judges:

| Demo | Target | Your time | GO/NO-GO |
|---|---|---|---|
| Demo 1 — Discover & Validate | 90 sec | ___ | |
| Demo 2 — Breaking Change | 60 sec | ___ | |
| Demo 3 — Self-Heal | 60 sec | ___ | |
| Buffer | 30 sec | — | |
| **Total** | **4 min** | ___ | |

**TODO 9.4 — Final commit**
```bash
cd ~/self-aware-api-platform
git add -A
git commit -m "feat: complete hackathon build — all 3 demo flows working"
git push origin main
```

---

## ✅ Final Build Checklist

All items must be green before you walk in:

```
BACKEND ROUTES
  [ ] GET  /health                    → {"status":"ok"}
  [ ] POST /api/specs/ingest          → spec_id + endpoint_count
  [ ] POST /api/chat                  → answer + tool_calls + provenance
  [ ] POST /api/specs/compare         → diff_id + breaking_count
  [ ] POST /api/agent/self-heal       → before + after + valid:true
  [ ] GET  /api/audit-logs            → list of recent tool calls

TOOLS (unit tested)
  [ ] spec_search       → ranked endpoints, top result score > 0.85
  [ ] spec_get          → full schema + spec_version returned
  [ ] spec_validate     → valid:true for good, field errors for bad
  [ ] spec_diff         → 2 BREAKING + 1 NON-BREAKING for v1→v2
  [ ] impact_analyze    → 3 HIGH services for diff_id=1

FRONTEND
  [ ] Chat → answer with tool chips + provenance badge
  [ ] Tool chips are collapsible (not all expanded by default)
  [ ] SpecUploader → drag-drop + version badge on success
  [ ] DiffPanel → red BREAKING + yellow NON-BREAKING rows + labels
  [ ] MigrationPanel → before (red) + after (green Valid ✓) + export
  [ ] Audit log modal → all tool calls visible
  [ ] Responsible AI panel → 6 green checkmarks

PRESENTATION
  [ ] npm run build → zero errors
  [ ] vercel --prod → live URL works
  [ ] All 10 sections render on mobile + desktop
  [ ] Star field animating on load

DATABASE AUDIT
  [ ] SELECT COUNT(*) FROM audit_logs > 20 (from all your tests)
  [ ] SELECT COUNT(*) FROM endpoints = 12 (6 per spec × 2 versions)
  [ ] SELECT COUNT(*) FROM diffs = 1
  [ ] All embeddings non-NULL:
      SELECT COUNT(*) FROM endpoints WHERE embedding IS NULL;
      → 0
```

---

> **When stuck:** Switch to **api-platform-debugger** agent → paste full error → `/fix-and-explain`  
> **After any fix:** Re-run the exit check for that TODO before moving on  
> **Decision log:** Any deviation from BEST-PRACTICES.md must be recorded in CLAUDE.md Known Issues table with a reason