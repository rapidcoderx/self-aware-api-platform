---
name: load-context
description: Load full project context for the Self-Aware API Platform. Run this at the start of any session to orient the LLM on objectives, stack, build state, and demo expectations.
agent: agent
tools: ['codebase', 'search']
---

You are working on the **Self-Aware API Platform** — a 48-hour hackathon project.
Read the following context carefully before responding to anything.
Also read `CLAUDE.md` in the project root if it exists and check the Build Progress Tracker.

---

## 🎯 Hackathon Objective

Build a working demo of an **agentic API intelligence platform** that:
1. Ingests OpenAPI/Swagger specs and stores them as searchable, validated knowledge
2. Exposes **typed MCP tools** so an LLM agent can discover, retrieve, and validate API endpoints
3. **Detects breaking changes** when a new spec version is uploaded (BREAKING vs NON_BREAKING)
4. **Self-heals** by generating validated before/after migration payloads
5. **Audits everything** — every tool call logged with inputs, outputs, duration

This is **tool-first architecture** — the LLM agent never accesses the database directly.
Every action goes through a typed MCP tool. Every recommendation is schema-validated.

**One-line pitch**: "We turn API specs into living infrastructure — observable, validated,
and self-healing — using MCP as the enforcement layer for safe agentic intelligence."

---

## 🛠 Stack (locked — never deviate)

| Layer | Choice | Notes |
|---|---|---|
| Backend | Python 3.12.12 + FastAPI + uvicorn | uv-managed venv at `backend/.venv` |
| LLM | Anthropic Claude — `claude-sonnet-4-20250514` | tool_use loop, max 10 iterations |
| MCP | Python MCP SDK — stdio transport | 5 tools total |
| Embeddings | Voyage AI — `voyage-3` — dim=1024 | Already configured |
| Vector DB | pgvector in PostgreSQL 16 | `selfaware_api` DB on localhost:5432 |
| OpenAPI | prance + jsonschema | prance handles $ref resolution |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 | port 5173 |
| Mock | Prism (@stoplight/prism-cli) | port 4010, reads OpenAPI spec directly |
| Package mgr | uv | Always `uv pip install`, never bare pip |

**Never suggest**: LangChain, LangGraph, OpenAI, Chroma, Pinecone, SQLAlchemy, Next.js

---

## 📁 Project Structure

```
~/self-aware-api-platform/
├── CLAUDE.md                         ← build progress tracker + full context
├── .python-version                   ← 3.12.12
├── backend/
│   ├── .venv/                        ← Python 3.12.12 uv venv
│   ├── .env                          ← ANTHROPIC_API_KEY, VOYAGE_API_KEY, DATABASE_URL
│   ├── main.py                       ← FastAPI app + CORS + health check
│   ├── mcp_server.py                 ← MCP server (stdio)
│   ├── agent.py                      ← Claude tool_use orchestrator
│   ├── ingestion/
│   │   ├── normalizer.py             ← prance → canonical endpoint dicts
│   │   ├── chunker.py                ← endpoint → embedding text
│   │   └── embedder.py               ← Voyage AI batch embed
│   ├── storage/
│   │   ├── schema_store.py           ← specs + endpoints CRUD
│   │   ├── vector_store.py           ← pgvector cosine search
│   │   └── init_db.sql               ← schema (already applied)
│   └── tools/
│       ├── spec_search.py            ← search_endpoints()
│       ├── spec_get.py               ← get_endpoint()
│       ├── spec_validate.py          ← validate_request()
│       ├── spec_diff.py              ← diff_specs()
│       └── impact_analyze.py         ← analyze_impact()
├── frontend/src/components/
│   ├── ChatPanel.jsx
│   ├── DiffPanel.jsx
│   ├── ImpactPanel.jsx
│   └── MigrationPanel.jsx
└── specs/
    ├── banking-api-v1.yaml           ← demo baseline
    ├── banking-api-v2.yaml           ← breaking changes (demo target)
    └── dependencies.yaml             ← mock dependency graph
```

---

## 🔧 MCP Tools (5 tools — canonical signatures, never change)

```python
search_endpoints(query: str, spec_id: int, limit: int = 5) -> list[EndpointSummary]
get_endpoint(operation_id: str, spec_id: int) -> EndpointDetail
validate_request(operation_id: str, payload: dict, spec_id: int) -> ValidationResult
diff_specs(old_spec_id: int, new_spec_id: int) -> list[DiffItem]
analyze_impact(diff_id: int) -> list[ImpactItem]
```

---

## 🗄 Database Schema

```sql
specs       (id, name, version INT, spec_json JSONB, hash TEXT, created_at)
endpoints   (id, spec_id→specs, operation_id, method, path, summary,
             tags TEXT[], schema_json JSONB, embedding vector(1024))
diffs       (id, spec_id_old, spec_id_new, diff_json JSONB, breaking_count INT)
audit_logs  (id, tool_name, inputs JSONB, outputs JSONB, spec_id, duration_ms, created_at)
```

Vector index: `ivfflat` on `endpoints.embedding` with `vector_cosine_ops`

---

## 🎬 Demo Expectations (3 demos, 4 minutes total)

### Demo 1 — Discover & Validate (90 sec)
> Ask: "How do I create a corporate deposit account?"

- Agent calls `spec_search` → finds endpoint via vector similarity
- Agent calls `spec_get_endpoint` → endpoint card appears in UI
- Agent generates example payload from schema
- Agent calls `spec_validate_request` → green "Valid ✓" badge
- **Provenance badge** visible: spec version + operationId

### Demo 2 — Breaking Change Detection (60 sec)
> Upload `banking-api-v2.yaml` → click "Compare with v1"

- `spec_diff` runs → diff panel opens
- 🔴 BREAKING: `companyRegistrationNumber` added as required field
- 🔴 BREAKING: `accountType` enum — `deposit` removed, `corporate` added
- 🟡 NON_BREAKING: `kycStatus` optional field added
- Summary: "2 breaking, 1 non-breaking"
- Affected: `onboarding-service` (HIGH), `crm-integration` (HIGH), `mobile-app-backend` (HIGH)

### Demo 3 — Self-Heal (60 sec)
> Click "Generate Migration Plan"

- Agent proposes **before** payload (red bg — missing required field)
- Agent proposes **after** payload (green bg — field added)
- `spec_validate_request` called on after payload → "Valid ✓"
- Step-by-step migration instructions shown
- Audit log modal opens: every tool call visible

---

## 🏗 Build Pattern

### Coding rules (always)
- Type hints on all function signatures
- Pydantic v2 models (`model_config`, not class `Config`)
- `async def` for all FastAPI route handlers
- Raw psycopg2 — parameterised `%s` queries only
- `python-dotenv` for all config — no hardcoded values
- `logging` module only — no `print()`
- Log every MCP tool call to `audit_logs` table

### Key patterns

**pgvector cosine search**
```python
cursor.execute("""
    SELECT id, operation_id, method, path, summary,
           1 - (embedding <=> %s::vector) AS score
    FROM endpoints
    WHERE spec_id = %s
    ORDER BY embedding <=> %s::vector
    LIMIT %s
""", (embedding_list, spec_id, embedding_list, limit))
```

**Voyage AI embed**
```python
client = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))
result = client.embed(texts, model="voyage-3")
return result.embeddings  # dim=1024
```

**Claude tool_use loop**
```python
for i in range(MAX_ITERATIONS):  # MAX_ITERATIONS = 10
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        tools=TOOL_DEFINITIONS,
        messages=messages
    )
    if response.stop_reason == "end_turn":
        return response.content[0].text
    # append tool results, continue
```

---

## ✅ Definition of Done

A module is complete when:
1. File exists at the correct path
2. All imports resolve cleanly in the venv
3. Type hints and Pydantic v2 models used throughout
4. Error handling covers DB failures, API failures, and validation errors
5. For tools: audit log entry written on every call
6. For routes: tested with curl or the FastAPI `/docs` UI
7. Build progress tracker in `CLAUDE.md` is ticked

---

## 📍 Current Session

> **Check `CLAUDE.md` now** and report:
> 1. Which modules are complete (ticked)
> 2. Which modules remain (unticked)
> 3. What today's logical next module is based on the Day 1 → Day 2 build order

Then ask: **"What would you like to work on today?"**