# Copilot Instructions — Self-Aware API Platform

## What this project is
A 48-hour hackathon build: an agentic API intelligence platform that ingests OpenAPI specs,
exposes typed MCP tools, detects breaking changes, and suggests self-healing migrations.
This is NOT a "chat over docs" app — it is a tool-first, schema-validated, auditable system.

---

## Tech stack (strict — do not suggest alternatives)
| Layer | Choice |
|---|---|
| Language | Python 3.12.12 (pinned via .python-version) |
| Backend | FastAPI + uvicorn |
| Package manager | uv (never suggest pip install directly) |
| LLM | Anthropic Claude API — `claude-sonnet-4-20250514` |
| Agent pattern | Claude tool_use loop — NOT LangChain, NOT LangGraph |
| MCP | Python MCP SDK (`mcp` package) — stdio transport |
| Vector DB | pgvector inside PostgreSQL 16 (local) |
| Embeddings | Voyage AI — model `voyage-3`, dimension 1024 |
| OpenAPI parsing | `prance` for $ref resolution + `jsonschema` for validation |
| Frontend | React + Vite + Tailwind CSS |
| Mock server | Prism (`@stoplight/prism-cli`) on port 4010 |
| DB | PostgreSQL 16 — localhost:5432/selfaware_api |

---

## Project structure
```
backend/
  main.py                  # FastAPI app, CORS, health check
  mcp_server.py            # MCP server — registers all tools
  agent.py                 # Claude API orchestrator — tool_use loop
  ingestion/
    normalizer.py          # OpenAPI → canonical endpoint dicts
    chunker.py             # Endpoint → text chunks for embedding
    embedder.py            # Voyage AI batch embedding
  storage/
    schema_store.py        # Postgres JSONB CRUD for specs/endpoints
    vector_store.py        # pgvector cosine similarity search
    init_db.sql            # Schema: specs, endpoints, diffs, audit_logs
  tools/
    spec_search.py         # search_endpoints(query, spec_id, limit)
    spec_get.py            # get_endpoint(operation_id, spec_id)
    spec_validate.py       # validate_request(operation_id, payload, spec_id)
    spec_diff.py           # diff_specs(old_spec_id, new_spec_id)
    impact_analyze.py      # analyze_impact(diff_id)
frontend/src/components/
  ChatPanel.jsx
  DiffPanel.jsx
  ImpactPanel.jsx
  MigrationPanel.jsx
specs/
  banking-api-v1.yaml      # Baseline spec
  banking-api-v2.yaml      # Breaking change spec (for demo)
  dependencies.yaml        # Mock dependency graph
```

---

## Database schema (PostgreSQL 16 + pgvector 0.8.2)
```sql
specs        (id, name, version, spec_json JSONB, hash, created_at)
endpoints    (id, spec_id, operation_id, method, path, summary, tags TEXT[], schema_json JSONB, embedding vector(1024))
diffs        (id, spec_id_old, spec_id_new, diff_json JSONB, breaking_count, created_at)
audit_logs   (id, tool_name, inputs JSONB, outputs JSONB, spec_id, duration_ms, created_at)
```
- Vector index: `ivfflat` on `endpoints.embedding` with `vector_cosine_ops`
- Full-text fallback: `gin` index on `to_tsvector('english', summary)`

---

## MCP tool contracts (these are the canonical signatures — never change them)
```python
search_endpoints(query: str, spec_id: int, limit: int = 5) -> list[EndpointSummary]
get_endpoint(operation_id: str, spec_id: int) -> EndpointDetail
validate_request(operation_id: str, payload: dict, spec_id: int) -> ValidationResult
diff_specs(old_spec_id: int, new_spec_id: int) -> list[DiffItem]
analyze_impact(diff_id: int) -> list[ImpactItem]
```

---

## Coding rules Copilot must follow

### General
- Always use type hints on function signatures
- Always use dataclasses or Pydantic v2 models for structured return types
- Never use `print()` for logging — use Python `logging` module
- Load all config from `.env` via `python-dotenv` — never hardcode keys
- Every DB operation must use parameterised queries (never f-string SQL)

### FastAPI
- All routes return Pydantic response models
- Use `async def` for all route handlers
- Include `status_code` explicitly on POST routes
- Dependency inject DB connections — never create connections inside route handlers

### Claude API (tool_use)
```python
# Correct pattern — always use this structure
client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    tools=TOOL_DEFINITIONS,   # list of tool dicts with name/description/input_schema
    messages=conversation_history
)
# Handle stop_reason == "tool_use" in a loop
# Max iterations guard: raise after 10 loops
```

### MCP server
```python
# Correct pattern for tool registration
from mcp.server import Server
from mcp.server.stdio import stdio_server
app = Server("self-aware-api")

@app.list_tools()
async def list_tools(): ...

@app.call_tool()
async def call_tool(name: str, arguments: dict): ...
```

### pgvector queries
```python
# Always use cosine distance operator <=>
# Always cast embedding to ::vector
cursor.execute("""
    SELECT id, operation_id, method, path, summary,
           1 - (embedding <=> %s::vector) AS score
    FROM endpoints
    WHERE spec_id = %s
    ORDER BY embedding <=> %s::vector
    LIMIT %s
""", (embedding_list, spec_id, embedding_list, limit))
```

### Audit logging
- Every MCP tool call must be logged to `audit_logs` table
- Log: tool_name, inputs (sanitised), outputs summary, spec_id, duration_ms
- Never log raw API keys or full request bodies containing sensitive data

---

## What Copilot should NOT do
- Do not suggest LangChain, LangGraph, or any orchestration framework
- Do not suggest OpenAI — this project uses Anthropic Claude exclusively
- Do not suggest Chroma, Pinecone, or Weaviate — pgvector only
- Do not suggest Next.js — Vite only
- Do not suggest SQLAlchemy ORM — use raw psycopg2 with parameterised queries
- Do not add unnecessary abstraction layers — YAGNI, this is a 48-hour build
- Do not suggest `requirements.txt` edits — use `uv pip install <package>` and re-freeze

---

## Environment variables (.env keys)
```
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
DATABASE_URL=postgresql://localhost:5432/selfaware_api
ENVIRONMENT=development
SANDBOX_MODE=true
LOG_LEVEL=info
PRISM_MOCK_URL=http://localhost:4010
```

---

## Demo specs context
- `banking-api-v1.yaml`: createAccount requires `[accountName, accountType]`
- `banking-api-v2.yaml`: createAccount adds required `companyRegistrationNumber`, changes `accountType` enum (removes `deposit`, adds `corporate`) — these are the BREAKING CHANGES for the demo
- Demo flow: ingest v1 → chat → ingest v2 → diff → self-heal → migration plan