# CLAUDE.md — Self-Aware API Platform

This file is read by Claude Code at the start of every session.
It gives Claude full project context so you never have to re-explain the architecture.

---

## Project identity
**Name**: Self-Aware API Platform  
**Type**: 48-hour hackathon build  
**Builder**: Solo developer, AI-assisted (Claude Code + Cursor + Copilot)  
**Goal**: Ship a working demo — not production code. Favour clarity and runnability over elegance.

**One-line pitch**: "We turn API specs into living infrastructure — observable, validated,
and self-healing — using MCP as the enforcement layer for safe agentic intelligence."

---

## What this system does (understand this before generating any code)

1. **Ingests** OpenAPI/Swagger specs → normalises into canonical endpoint dicts → embeds with Voyage AI → stores in Postgres + pgvector
2. **Exposes MCP tools** that an LLM agent calls to search, retrieve, validate, and diff specs — the agent NEVER accesses the DB directly
3. **Detects breaking changes** when a new spec version is uploaded — diffs are classified BREAKING vs NON_BREAKING
4. **Self-heals** by generating payload migration suggestions, validating them against schema, and presenting a human-reviewable migration plan
5. **Audits everything** — every tool call is logged with inputs/outputs/duration

---

## Absolute constraints (never violate these)

- **Python 3.12.12 only** — pinned in `.python-version`. Never suggest 3.13 or 3.14
- **uv for all package operations** — `uv pip install`, `uv venv`, never bare `pip`
- **Claude API only** — model `claude-sonnet-4-20250514`, tool_use pattern
- **No LangChain/LangGraph** — agent loop is hand-rolled in `agent.py`
- **pgvector only** — no Chroma, Pinecone, or any external vector service
- **Sandbox mode** — `SANDBOX_MODE=true` in .env. All API calls go to Prism mock (port 4010), never production
- **Raw psycopg2** — no SQLAlchemy ORM
- **Pydantic v2** — for all data models (use `model_validator`, `field_validator`, not v1 syntax)

---

## Tech stack quick reference
```
Backend:    Python 3.12.12 + FastAPI + uvicorn
Agent:      Anthropic SDK — claude-sonnet-4-20250514 — tool_use loop
MCP:        mcp Python SDK — stdio transport
Embeddings: voyageai — voyage-4 — dim=1024
Storage:    PostgreSQL 16 + pgvector 0.8.2 — selfaware_api DB
Parsing:    prance ($ref resolution) + jsonschema (validation)
Frontend:   React 18 + Vite 5 + Tailwind CSS 3
Mock:       Prism (@stoplight/prism-cli) — port 4010
Env:        python-dotenv — .env in backend/
```

---

## Directory layout (always write files to the correct location)
```
~/self-aware-api-platform/
├── .python-version          ← 3.12.12
├── .gitignore
├── README.md
├── backend/
│   ├── .venv/               ← uv-managed, Python 3.12.12
│   ├── .env                 ← NEVER commit this
│   ├── .env.example
│   ├── main.py              ← FastAPI app entry point
│   ├── mcp_server.py        ← MCP server (stdio)
│   ├── agent.py             ← Claude tool_use orchestrator
│   ├── requirements.txt     ← frozen by uv pip freeze
│   ├── ingestion/
│   │   ├── normalizer.py    ← prance → canonical endpoint dicts
│   │   ├── chunker.py       ← endpoint → embedding text
│   │   └── embedder.py      ← Voyage AI batch embed
│   ├── storage/
│   │   ├── schema_store.py  ← specs + endpoints CRUD
│   │   ├── vector_store.py  ← pgvector search
│   │   └── init_db.sql      ← schema (already applied)
│   └── tools/
│       ├── spec_search.py
│       ├── spec_get.py
│       ├── spec_validate.py
│       ├── spec_diff.py
│       └── impact_analyze.py
├── frontend/
│   ├── src/components/
│   │   ├── ChatPanel.jsx
│   │   ├── DiffPanel.jsx
│   │   ├── ImpactPanel.jsx
│   │   └── MigrationPanel.jsx
│   ├── src/App.jsx
│   └── package.json
└── specs/
    ├── banking-api-v1.yaml  ← baseline demo spec
    ├── banking-api-v2.yaml  ← breaking change demo spec
    └── dependencies.yaml   ← mock dependency graph
```

---

## Database schema (PostgreSQL 16 + pgvector 0.8.2)
```sql
-- specs: one row per ingested version
specs (id SERIAL, name TEXT, version INT, spec_json JSONB, hash TEXT, created_at TIMESTAMPTZ)

-- endpoints: one row per operation with embedding
endpoints (id, spec_id→specs, operation_id, method, path, summary, tags TEXT[],
           schema_json JSONB, embedding vector(1024))

-- diffs: structured diff between versions
diffs (id, spec_id_old→specs, spec_id_new→specs, diff_json JSONB, breaking_count INT)

-- audit_logs: every MCP tool call
audit_logs (id, tool_name, inputs JSONB, outputs JSONB, spec_id, duration_ms, created_at)
```

---

## MCP tool signatures (canonical — match these exactly)
```python
# spec_search.py
async def search_endpoints(query: str, spec_id: int, limit: int = 5) -> list[EndpointSummary]:
    """Embed query with Voyage AI, cosine search pgvector, return top-N"""

# spec_get.py
async def get_endpoint(operation_id: str, spec_id: int) -> EndpointDetail:
    """Fetch full schema_json for one operation from endpoints table"""

# spec_validate.py
async def validate_request(operation_id: str, payload: dict, spec_id: int) -> ValidationResult:
    """Extract requestBody JSON Schema, run jsonschema.validate(), return errors"""

# spec_diff.py
async def diff_specs(old_spec_id: int, new_spec_id: int) -> list[DiffItem]:
    """Compare requestBody schemas. Classify: BREAKING | NON_BREAKING"""

# impact_analyze.py
async def analyze_impact(diff_id: int) -> list[ImpactItem]:
    """Load dependencies.yaml, map breaking changes to affected services"""
```

---

## Pydantic models (use these — don't invent new ones)
```python
class EndpointSummary(BaseModel):
    operation_id: str
    method: str
    path: str
    summary: str | None
    score: float  # cosine similarity

class EndpointDetail(BaseModel):
    operation_id: str
    method: str
    path: str
    summary: str | None
    tags: list[str]
    parameters: list[dict]
    request_body_schema: dict | None
    response_schemas: dict
    spec_version: int

class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationError]

class ValidationError(BaseModel):
    field: str
    message: str
    hint: str | None

class DiffItem(BaseModel):
    operation_id: str
    method: str
    path: str
    breaking: bool
    change_type: str  # FIELD_ADDED | FIELD_REMOVED | TYPE_CHANGED | ENUM_CHANGED | REQUIRED_ADDED
    field: str
    old_value: str | None
    new_value: str | None

class ImpactItem(BaseModel):
    operation_id: str
    affected_service: str
    team: str
    severity: str  # HIGH | MEDIUM | LOW
    breaking_changes: list[DiffItem]
```

---

## Claude API tool_use pattern (always use this skeleton)
```python
import anthropic, os
from dotenv import load_dotenv
load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-20250514"
MAX_ITERATIONS = 10

SYSTEM_PROMPT = """You are an API intelligence assistant for the Self-Aware API Platform.
Use the available tools to answer questions about API endpoints and specs.
Always show provenance: include spec version and operationId in every answer.
Never guess — always use tools to get schema information."""

async def run_agent(user_message: str, spec_id: int) -> str:
    messages = [{"role": "user", "content": user_message}]
    for i in range(MAX_ITERATIONS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,  # imported from tools module
            messages=messages
        )
        if response.stop_reason == "end_turn":
            return response.content[0].text
        if response.stop_reason == "tool_use":
            # process tool calls, append results, continue loop
            ...
    raise RuntimeError("Agent exceeded max iterations")
```

---

## pgvector query pattern (always use this)
```python
# cosine similarity search — note the ::vector cast
cursor.execute("""
    SELECT id, operation_id, method, path, summary,
           1 - (embedding <=> %s::vector) AS score
    FROM endpoints
    WHERE spec_id = %s
    ORDER BY embedding <=> %s::vector
    LIMIT %s
""", (embedding_as_list, spec_id, embedding_as_list, limit))
```

---

## Voyage AI embedding pattern
```python
import voyageai, os
client = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed. voyage-4 returns dim=1024 vectors."""
    result = client.embed(texts, model="voyage-4")
    return result.embeddings  # list of list[float]
```

---

## Session start prompt for Claude Code
Paste this at the start of each new Claude Code session:

```
Read CLAUDE.md in the project root. Today's goal is: [YOUR TASK].
Generate complete, runnable code for [MODULE NAME] only.
Follow all constraints in CLAUDE.md exactly.
Use type hints, Pydantic v2, async FastAPI patterns, and raw psycopg2.
One module at a time. No placeholders — full implementation.
```

---

## Build progress tracker
Update this section as modules are completed.

### Day 1
- [x] Repo scaffold + FastAPI health check (`main.py`)
- [x] DB connection + schema verify (`storage/schema_store.py`)
- [x] pgvector similarity search (`storage/vector_store.py`)
- [x] OpenAPI normalizer (`ingestion/normalizer.py`)
- [x] Endpoint text chunker (`ingestion/chunker.py`)
- [x] Embedding pipeline (`ingestion/embedder.py`)
- [x] Spec ingest route (`POST /api/specs/ingest`)
- [x] `spec_search` tool (`tools/spec_search.py`)
- [x] `spec_get_endpoint` tool (`tools/spec_get.py`)
- [x] `spec_validate_request` tool (`tools/spec_validate.py`)
- [x] MCP server (`mcp_server.py`)
- [x] Agent orchestrator (`agent.py`)
- [x] Chat API route (`POST /api/chat`)
- [x] React 3-panel layout (`App.jsx`)
- [x] ChatPanel with tool call display
- [x] ValidationPanel

### Day 2
- [x] Spec versioning (auto-increment on re-ingest)
- [ ] `spec_diff` tool (`tools/spec_diff.py`)
- [ ] Diff route (`POST /api/specs/compare`)
- [ ] DiffPanel UI
- [ ] `impact_analyze` tool (`tools/impact_analyze.py`)
- [ ] Self-heal loop in `agent.py`
- [ ] MigrationPanel UI
- [ ] Responsible AI panel (audit log modal)
- [ ] Spec upload UI component
- [ ] End-to-end demo rehearsal

---

## Known issues / decisions log
| Date | Decision | Reason |
|---|---|---|
| Day 0 | pgvector installed from source (v0.8.2), not brew | brew install conflicted with PG16 on Intel Mac |
| Day 0 | Python pinned to 3.12.12 via uv | 3.14.3 (system) has incomplete wheels for psycopg2/prance |
| Day 0 | React/Vite/Tailwind chosen over Streamlit | Demo polish matters for judging |