# AI Session Context — Self-Aware API Platform
**Paste this into any new Claude.ai / ChatGPT / Gemini chat to restore full project context**

---

## What I'm building
A 48-hour hackathon project: **Self-Aware API Platform** — an agentic system that ingests
OpenAPI specs, exposes MCP tools, detects breaking changes between spec versions, and
generates validated self-healing migration suggestions.

**This is tool-first architecture**: the LLM agent only acts through typed MCP tools.
No direct DB access from the agent. Every recommendation is schema-validated before display.

---

## Current stack (locked — do not suggest changes)
| Component | Choice |
|---|---|
| Backend | Python 3.12.12 + FastAPI + uvicorn |
| Package manager | uv (not pip) |
| LLM | Anthropic Claude — `claude-sonnet-4-20250514` — tool_use loop |
| MCP | Python MCP SDK — stdio transport |
| Vector store | pgvector in PostgreSQL 16 — `selfaware_api` DB |
| Embeddings | Voyage AI — `voyage-3` — dim=1024 |
| OpenAPI | prance + jsonschema |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Mock server | Prism on port 4010 |
| Platform | Mac Intel 2018, macOS, Python pinned via `.python-version` |

---

## Environment setup status
- ✅ PostgreSQL 16 running, `selfaware_api` DB created
- ✅ pgvector 0.8.2 active (source-built — brew conflicted with PG16 on Intel Mac)
- ✅ Python 3.12.12 via uv (system has 3.14.3 but that's unstable for our deps)
- ✅ All Python deps installed in `backend/.venv`
- ✅ DB schema applied (specs, endpoints, diffs, audit_logs tables)
- ✅ Sample specs ready: banking-api-v1.yaml + banking-api-v2.yaml
- ✅ Anthropic + Voyage AI API keys configured in backend/.env

---

## Key architectural decisions (with reasons)
1. **No LangChain/LangGraph** — hand-rolled tool_use loop in `agent.py`. Less abstraction, easier to debug in 48hrs
2. **pgvector not Chroma** — single DB instance for schema store + vectors. One less service to run
3. **prance not swagger-parser** — Python-native, handles complex `$ref` resolution
4. **React/Vite not Streamlit** — demo needs to look like a product, not a prototype
5. **Prism not custom mocks** — reads OpenAPI spec directly, validates requests/responses automatically
6. **Sandbox mode only** — `SANDBOX_MODE=true`, all calls go to Prism. No prod API calls in hackathon

---

## MCP tools (5 tools, these are final)
```
spec.search(query, spec_id, limit=5)          → list[EndpointSummary]
spec.get_endpoint(operation_id, spec_id)       → EndpointDetail
spec.validate_request(operation_id, payload, spec_id) → ValidationResult
spec.diff(old_spec_id, new_spec_id)            → list[DiffItem]
impact.analyze(diff_id)                        → list[ImpactItem]
```

---

## Demo narrative (3 demos, 4 minutes total)
**Demo 1 — Discover & Validate**: Ask about creating a deposit account → agent searches
vector index → gets endpoint schema → generates payload → validates against schema → shows
provenance badge (spec version + operationId)

**Demo 2 — Breaking Change**: Upload banking-api-v2.yaml → platform diffs against v1 →
shows BREAKING: `companyRegistrationNumber` now required, `accountType` enum changed
(deposit removed, corporate added)

**Demo 3 — Self-Heal**: Agent generates before/after payload migration → validates after
payload → outputs step-by-step migration plan → audit log shows full tool call history

---

## Project file locations
```
~/self-aware-api-platform/
├── CLAUDE.md                    ← Claude Code session context
├── .cursorrules                 ← Cursor IDE rules
├── .github/copilot-instructions.md ← GitHub Copilot rules
├── backend/
│   ├── .venv/                   ← Python 3.12.12 uv venv
│   ├── .env                     ← API keys (never committed)
│   ├── main.py                  ← FastAPI app
│   ├── mcp_server.py            ← MCP server
│   ├── agent.py                 ← Claude tool_use loop
│   ├── ingestion/{normalizer,chunker,embedder}.py
│   ├── storage/{schema_store,vector_store,init_db.sql}.py
│   └── tools/{spec_search,spec_get,spec_validate,spec_diff,impact_analyze}.py
├── frontend/src/components/
│   └── {ChatPanel,DiffPanel,ImpactPanel,MigrationPanel}.jsx
└── specs/
    ├── banking-api-v1.yaml      ← demo baseline
    ├── banking-api-v2.yaml      ← demo breaking changes
    └── dependencies.yaml        ← mock impact graph
```

---

## Breaking changes in v1→v2 (the demo's key moment)
In `createAccount` operation:
- **BREAKING**: `companyRegistrationNumber` added as a required field
- **BREAKING**: `accountType` enum — `deposit` removed, `corporate` added
- **NON_BREAKING**: `kycStatus` optional field added

These affect 3 downstream services: onboarding-service (HIGH), crm-integration (HIGH), mobile-app-backend (HIGH)

---

## How to activate the venv
```bash
cd ~/self-aware-api-platform/backend
source .venv/bin/activate
python --version  # should show 3.12.12
```

---

## Current build status
**Update this section each session before pasting**

Completed modules:
- [ ] main.py (FastAPI scaffold)
- [ ] storage/schema_store.py
- [ ] ingestion/normalizer.py
- [ ] ingestion/embedder.py
- [ ] POST /api/specs/ingest route
- [ ] tools/spec_search.py
- [ ] tools/spec_get.py
- [ ] tools/spec_validate.py
- [ ] mcp_server.py
- [ ] agent.py
- [ ] POST /api/chat route
- [ ] ChatPanel.jsx
- [ ] ValidationPanel.jsx
- [ ] tools/spec_diff.py
- [ ] POST /api/specs/compare route
- [ ] DiffPanel.jsx
- [ ] tools/impact_analyze.py
- [ ] Self-heal loop in agent.py
- [ ] MigrationPanel.jsx

**Blockers / issues this session:**
(fill in before pasting)

**Today's goal:**
(fill in before pasting)

---

## Prompt template (copy-paste to start any session)
```
Here is full context for my project: [paste this whole document]

Today's goal: [ONE specific task]
Module to build: [e.g. tools/spec_diff.py]

Generate complete, runnable code. No placeholders.
Follow the stack exactly — Python 3.12.12, FastAPI, raw psycopg2, Pydantic v2,
Anthropic tool_use, pgvector cosine search, voyageai voyage-3.
One module at a time. Include type hints, error handling, and docstrings.
```