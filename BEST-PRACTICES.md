# Self-Aware API Platform — Best Practices

> Living reference document. Read before writing any code.  
> Every decision here has a reason — the reason is as important as the rule.

---

## Table of Contents

1. [Architecture & Design](#1-architecture--design)
2. [Tech Stack Practices](#2-tech-stack-practices)
3. [API Design](#3-api-design)
4. [Data & Storage](#4-data--storage)
5. [Agent & LLM Practices](#5-agent--llm-practices)
6. [MCP Tool Design](#6-mcp-tool-design)
7. [Security](#7-security)
8. [Responsible AI](#8-responsible-ai)
9. [Frontend Practices](#9-frontend-practices)
10. [Code Quality](#10-code-quality)
11. [Demo & Delivery](#11-demo--delivery)

---

## 1. Architecture & Design

### 1.1 Tool-First, Agent-Second

The LLM agent **orchestrates** — it never acts directly. Every external action (DB query, API call, schema validation) must go through a typed MCP tool. The agent's job is to decide *which tool* to call and *what to do with the result*.

```
❌ agent.py directly queries the database
✅ agent.py calls spec_search tool → tool queries the database → returns typed result
```

**Why**: Tool-first architecture makes the system auditable, testable, and safe. You can unit test every tool independently. You can swap the LLM without touching the execution layer. You can see exactly what happened from the audit log.

---

### 1.2 Single Responsibility per Module

Each file does one thing:

| File | One job |
|---|---|
| `normalizer.py` | OpenAPI YAML → canonical endpoint dicts |
| `embedder.py` | Text → Voyage AI vectors |
| `schema_store.py` | Postgres CRUD for specs and endpoints |
| `vector_store.py` | pgvector similarity search |
| `spec_diff.py` | Diff two spec versions, classify changes |
| `agent.py` | Claude tool_use loop — nothing else |

No file should need to know about the internals of another file. Pass data through function arguments, not shared state.

---

### 1.3 Dependency Direction

Dependencies flow in one direction only:

```
FastAPI routes
    └── agent.py
          └── MCP tools (spec_search, spec_get, spec_validate, spec_diff, impact_analyze)
                └── storage (schema_store, vector_store)
                      └── PostgreSQL + pgvector

Ingestion pipeline (separate from agent path):
FastAPI /ingest route → normalizer → embedder → schema_store → PostgreSQL
```

Tools never call routes. Storage never calls tools. Nothing calls `agent.py` except routes.

---

### 1.4 Fail Loudly in Dev, Fail Gracefully in Demo

During development: raise exceptions, log full tracebacks, never swallow errors silently.  
During demo: catch exceptions at route handlers, return structured error responses, never let an unhandled exception reach the UI.

```python
# Route handler — graceful demo failure
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        result = await run_agent(request.message, request.spec_id)
        return ChatResponse(answer=result)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected agent failure: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Agent temporarily unavailable")
```

---

### 1.5 No Premature Abstraction

This is a 48-hour build. Write the simplest code that makes the demo work. Do not:
- Create base classes for tools that only have 5 implementations
- Build a plugin system for ingestion formats
- Add configuration layers for things that won't change during the hackathon

If two modules share 3 lines of code, it is not worth abstracting. Abstract only when the duplication causes an actual bug or a real maintenance problem.

---

## 2. Tech Stack Practices

### 2.1 Python Environment

Always use the uv-managed venv. Never run Python commands outside it.

```bash
# Activate before any Python work
cd ~/self-aware-api-platform/backend
source .venv/bin/activate
python --version  # must show 3.12.12
```

Always install packages with `uv pip install`, never bare `pip install`. After any install, freeze:

```bash
uv pip install <package>
uv pip freeze > requirements.txt
```

**Why 3.12.12 and not 3.14**: Python 3.14 is in alpha. Key packages (`psycopg2-binary`, `prance`, `voyageai`) publish pre-built wheels for 3.12 — no compilation needed, no unexpected failures during a hackathon.

---

### 2.2 FastAPI Conventions

```python
# Always: async route handlers
@app.post("/api/specs/ingest", status_code=201, response_model=IngestResponse)
async def ingest_spec(file: UploadFile, name: str = Form(...), db=Depends(get_db)):
    ...

# Always: explicit status codes on POST (201 not 200)
# Always: response_model declared — no naked dict returns
# Always: dependency-injected DB connection — never create inside handler
# Always: Form() or Body() for request parsing — never raw request.body()
```

---

### 2.3 Pydantic v2

Use v2 syntax throughout. Never mix v1 and v2 patterns.

```python
# ✅ v2 correct
from pydantic import BaseModel, field_validator, model_validator

class EndpointDetail(BaseModel):
    model_config = {"str_strip_whitespace": True}
    operation_id: str
    method: str

# ❌ v1 wrong — will silently behave incorrectly in v2
class EndpointDetail(BaseModel):
    class Config:
        anystr_strip_whitespace = True
```

---

### 2.4 Anthropic SDK

Always use `claude-sonnet-4-20250514`. Never hardcode a different model string anywhere.

```python
MODEL = "claude-sonnet-4-20250514"  # defined once in agent.py, imported everywhere
MAX_ITERATIONS = 10                  # always guard the tool_use loop
```

---

### 2.5 Voyage AI

Always use `voyage-3`. Always expect `dim=1024`. Always batch embeds in groups of ≤ 50.

```python
def embed_texts(texts: list[str]) -> list[list[float]]:
    results = []
    for i in range(0, len(texts), 50):          # batch max 50
        batch = texts[i:i+50]
        r = client.embed(batch, model="voyage-3")
        results.extend(r.embeddings)
    return results                               # each vector is dim=1024
```

---

## 3. API Design

### 3.1 Route Naming

All routes prefixed with `/api`. Resource-oriented, lowercase, hyphen-separated.

```
POST   /api/specs/ingest          ← ingest a new spec
GET    /api/specs                 ← list all specs
POST   /api/specs/compare         ← diff two spec versions
POST   /api/chat                  ← agent conversation
GET    /api/audit-logs            ← retrieve audit log entries
POST   /api/agent/self-heal       ← trigger self-heal for a diff
GET    /health                    ← health check (no /api prefix)
```

---

### 3.2 Response Models

Every route returns a typed Pydantic model. No naked `dict` or `{"key": "value"}` returns.

```python
class IngestResponse(BaseModel):
    spec_id: int
    name: str
    version: int
    endpoint_count: int
    message: str

class ChatResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallSummary]
    provenance: ProvenanceInfo     # spec_version + operation_id
    spec_id: int
```

---

### 3.3 Error Responses

Use HTTPException with clear messages. Always include enough detail for the UI to show a useful message — never expose internal stack traces.

```python
# Spec not found
raise HTTPException(status_code=404, detail=f"Spec '{spec_id}' not found")

# Validation failure
raise HTTPException(status_code=422, detail={"errors": error_list})

# External service unavailable
raise HTTPException(status_code=503, detail="Voyage AI embedding service unavailable")
```

---

## 4. Data & Storage

### 4.1 Parameterised Queries — No Exceptions

Every SQL statement uses `%s` placeholders. No f-strings, no string concatenation in SQL. Ever.

```python
# ✅ Correct — parameterised
cursor.execute(
    "SELECT * FROM specs WHERE name = %s AND version = %s",
    (name, version)
)

# ❌ Wrong — SQL injection risk, fails in demo if name has quotes
cursor.execute(f"SELECT * FROM specs WHERE name = '{name}'")
```

---

### 4.2 pgvector Cosine Search Pattern

Always use this exact pattern. Never deviate.

```python
cursor.execute("""
    SELECT id, operation_id, method, path, summary,
           1 - (embedding <=> %s::vector) AS score
    FROM endpoints
    WHERE spec_id = %s
    ORDER BY embedding <=> %s::vector
    LIMIT %s
""", (embedding_as_list, spec_id, embedding_as_list, limit))
```

The `::vector` cast is required. The `<=>` operator is cosine distance. `1 - distance = similarity score` for display.

---

### 4.3 Schema Versioning

When a spec is re-ingested with the same name, auto-increment the version. Never overwrite.

```python
# Always create a new version — never UPDATE the existing spec row
new_version = current_max_version + 1
cursor.execute(
    "INSERT INTO specs (name, version, spec_json, hash) VALUES (%s, %s, %s, %s)",
    (name, new_version, json.dumps(spec_json), compute_hash(spec_json))
)
```

**Why**: Diffs require both versions to exist. Overwriting v1 breaks the diff demo.

---

### 4.4 Audit Log on Every Tool Call

Every MCP tool call must write to `audit_logs` before returning. No exceptions.

```python
import time, json

def log_tool_call(conn, tool_name: str, inputs: dict,
                  outputs: dict, spec_id: int | None = None):
    duration_ms = int((time.time() - start_time) * 1000)
    sanitised_inputs = redact_sensitive(inputs)   # remove any key-like values
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO audit_logs (tool_name, inputs, outputs, spec_id, duration_ms)
            VALUES (%s, %s, %s, %s, %s)
        """, (tool_name, json.dumps(sanitised_inputs),
              json.dumps(outputs), spec_id, duration_ms))
    conn.commit()
```

---

## 5. Agent & LLM Practices

### 5.1 System Prompt Requirements

The agent system prompt must always include three things:

```python
SYSTEM_PROMPT = """You are an API intelligence assistant for the Self-Aware API Platform.

PROVENANCE: Always include the spec version and operationId in every answer.
Format: "Based on Banking API v1 (operationId: createAccount)..."

SANDBOX: You are operating in sandbox mode. All API calls go to a mock server.
Never suggest or imply production API calls.

TOOLS: Use tools for every external action. Never guess endpoint schemas or
payload structures — always retrieve them via spec_get_endpoint."""
```

---

### 5.2 Tool Loop Guard

Always protect the tool_use loop with a max iterations counter. Never allow infinite loops.

```python
MAX_ITERATIONS = 10

async def run_agent(message: str, spec_id: int) -> str:
    messages = [{"role": "user", "content": message}]

    for iteration in range(MAX_ITERATIONS):
        response = client.messages.create(...)

        if response.stop_reason == "end_turn":
            return extract_text(response)

        if response.stop_reason == "tool_use":
            tool_results = await process_tool_calls(response, spec_id)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
            continue

        break  # unexpected stop_reason

    raise RuntimeError(f"Agent did not complete within {MAX_ITERATIONS} iterations")
```

---

### 5.3 Tool Result Formatting

Tool results must be appended as `tool_result` blocks, not raw text. The Anthropic SDK requires this exact structure.

```python
def format_tool_result(tool_use_id: str, content: str) -> dict:
    return {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": content
    }

# Append as user message with list of tool_result blocks
messages.append({
    "role": "user",
    "content": [format_tool_result(id1, result1), format_tool_result(id2, result2)]
})
```

---

### 5.4 Provenance in Every Response

Every agent answer must include where the information came from. Display as a badge in the UI.

```python
class ProvenanceInfo(BaseModel):
    spec_name: str
    spec_version: int
    operation_id: str
    retrieved_at: datetime
```

This is a **Responsible AI requirement** — not optional. Users must be able to verify claims.

---

## 6. MCP Tool Design

### 6.1 Tools Are Narrow and Deterministic

Each tool does exactly one thing. It is not an LLM call — it is a typed function with a schema.

```
✅ spec_search   → vector similarity search, returns ranked endpoints
✅ spec_get      → fetch one endpoint's full schema
✅ spec_validate → run jsonschema.validate(), return structured errors
✅ spec_diff     → compare two schemas, classify changes
✅ impact_analyze → load dependency graph, map affected services

❌ "smart_api_helper" → searches + validates + suggests + calls Prism (too broad)
```

---

### 6.2 Tool Input Schema Must Match Exactly

The tool's JSON Schema in the Claude tool definitions must match the Python function signature exactly. Any mismatch causes `tool_use` failures.

```python
# Python function
async def validate_request(operation_id: str, payload: dict, spec_id: int) -> ValidationResult:
    ...

# Claude tool definition — must match 1:1
{
    "name": "validate_request",
    "input_schema": {
        "type": "object",
        "properties": {
            "operation_id": {"type": "string"},
            "payload": {"type": "object"},
            "spec_id": {"type": "integer"}
        },
        "required": ["operation_id", "payload", "spec_id"]
    }
}
```

---

### 6.3 Tools Return Structured Data, Not Prose

Tools return typed Pydantic models serialised to JSON. They never return natural language sentences. The agent's job is to turn structured data into natural language — not the tool's job.

```python
# ✅ Tool returns structured data
return ValidationResult(
    valid=False,
    errors=[ValidationError(field="accountType", message="Value 'deposit' not in enum", hint="Use one of: savings, current, corporate")]
)

# ❌ Tool returns prose — agent can't reliably parse this
return "The payload is invalid because accountType is wrong"
```

---

## 7. Security

### 7.1 Secrets Never Leave `.env`

API keys, database URLs, and any credential must only exist in `backend/.env`.  
`.env` must be in `.gitignore`.  
Never pass secrets as function arguments, CLI flags, or query parameters.

```python
# ✅ Load from environment
load_dotenv()
api_key = os.getenv("ANTHROPIC_API_KEY")

# ❌ Never do this
client = anthropic.Anthropic(api_key="sk-ant-abc123...")
```

---

### 7.2 Least Privilege for Tool Auth

MCP tools that call external APIs accept an `auth_ref` string (a reference key), not raw credentials. The actual credential is resolved server-side from the environment.

```python
# ✅ Tool accepts a reference, not a secret
async def sandbox_call(operation_id: str, payload: dict, auth_ref: str) -> SandboxResult:
    # auth_ref = "banking_api_sandbox" → resolved to actual key internally
    credentials = resolve_auth_ref(auth_ref)
    ...
```

---

### 7.3 Audit Log Sanitisation

Before writing to `audit_logs`, strip any value that looks like a secret.

```python
SENSITIVE_PATTERNS = ["api_key", "password", "token", "secret", "authorization"]

def redact_sensitive(data: dict) -> dict:
    return {
        k: "***REDACTED***" if any(p in k.lower() for p in SENSITIVE_PATTERNS) else v
        for k, v in data.items()
    }
```

---

### 7.4 Sandbox Mode Enforcement

`SANDBOX_MODE=true` in `.env` means all `api.sandbox_call` invocations must route to Prism (port 4010), never to production URLs. Enforce this at the tool level, not just in comments.

```python
def get_base_url() -> str:
    if os.getenv("SANDBOX_MODE", "true").lower() == "true":
        return os.getenv("PRISM_MOCK_URL", "http://localhost:4010")
    raise RuntimeError("Production mode not enabled in this build")
```

---

### 7.5 Input Validation at Route Boundaries

All user-supplied data is validated by Pydantic before it reaches any business logic. FastAPI's automatic Pydantic validation is the first line of defence — never bypass it by accepting `Any` or raw `dict` at the route level.

---

## 8. Responsible AI

This section is non-negotiable. These practices are not polish — they are foundational to the platform's credibility and the hackathon pitch.

---

### 8.1 Schema Validation Before Every Recommendation

The agent must **never present a payload suggestion to the user without first validating it** against the actual JSON Schema via `spec_validate_request`. Unvalidated suggestions are hallucinations dressed up as recommendations.

```
Agent generates payload example
    → calls spec_validate_request(operation_id, payload, spec_id)
    → if valid: display with green "Valid ✓" badge
    → if invalid: revise payload using error hints, re-validate, then display
    → never display an unvalidated payload
```

---

### 8.2 Provenance on Every Answer

Every agent response shown in the UI must carry a provenance badge:

```
"Based on: Banking API v1.0 · operationId: createAccount · Retrieved: 14:23:01"
```

This allows users to verify the claim independently. It is also an audit trail.  
Provenance is **not** optional styling — it is a trust mechanism.

---

### 8.3 Human-in-the-Loop for Migration Actions

Self-healing is **advisory only**. The platform proposes; the human decides.

The migration plan UI must:
- Show before/after payloads side by side
- Show the validation badge on the after payload
- Require explicit user action ("Apply migration" button) — never auto-apply
- Export the plan as JSON for human review outside the tool

No automated patching, no auto-commit, no silent modification of client code.

---

### 8.4 Transparent Tool Calls

Every tool call made by the agent must be visible in the UI as a collapsible chip:

```
[tool chip] spec_search  ▼
  query: "create corporate deposit account"
  spec_id: 1
  → returned 3 endpoints
```

Users must be able to see *what* the agent did, not just *what it said*. Black-box AI is not acceptable for an API intelligence platform.

---

### 8.5 Explicit Sandbox Boundaries

The UI must display a persistent "Sandbox Mode" badge. Users must always know they are interacting with a mock server, not a production system.  
Any tool call that would reach an external API must:
1. Be blocked if `SANDBOX_MODE=true`
2. Show a clear indicator that it went to the mock server

---

### 8.6 Breaking Change Classification Transparency

When the platform classifies a diff as BREAKING, it must show **why** — the specific rule that triggered the classification, not just the label.

```
⚠️ BREAKING — companyRegistrationNumber
   Rule: New required field added to requestBody
   Impact: Any existing payload without this field will fail validation
   Affected clients: onboarding-service (HIGH), crm-integration (HIGH)
```

"BREAKING" without explanation is noise. Explanation enables action.

---

### 8.7 Confidence and Uncertainty

When the agent cannot determine an answer with high confidence (e.g., ambiguous query matches multiple endpoints), it must say so and present options — not pick one silently.

```
"Your query matches 3 endpoints. Which did you mean?
 1. POST /accounts — createAccount (score: 0.91)
 2. POST /accounts/corporate — createCorporateAccount (score: 0.87)
 3. PUT /accounts/{id} — updateAccount (score: 0.74)"
```

Presenting options is more responsible than false certainty.

---

### 8.8 No Hallucinated Endpoints or Fields

The agent must retrieve schema information via `spec_get_endpoint` before generating any payload. It must never generate a payload from its training knowledge of "what APIs usually look like."

If a `spec_id` is not provided in the conversation, the agent must ask for it before proceeding. Scope creep (using a different spec than the user intended) is a form of hallucination.

---

### 8.9 Audit Log as Accountability Record

The `audit_logs` table is not just a debug tool — it is the platform's accountability record. It answers: *"What did the AI actually do, and when?"*

Requirements:
- Every tool call logged — no exceptions, no opt-outs
- Log retention: keep all entries for the duration of the hackathon session
- UI access: judges must be able to open the audit log modal and see real entries
- Entries must be immutable — no UPDATE or DELETE on audit_logs

---

### 8.10 PII and Data Hygiene

In a banking API context, payloads may contain PII (account names, registration numbers, etc.).

Rules for the hackathon build:
- Do not store request payload bodies in `audit_logs` — store only the operation name and validation result
- Do not log full API responses from Prism if they contain example PII
- Use clearly fictional example data in sample specs (e.g., "Acme Corp", "BC-1234567")

---

## 9. Frontend Practices

### 9.1 Component Responsibilities

| Component | Responsibility | Not responsible for |
|---|---|---|
| `ChatPanel` | Conversation UI, tool call chips, provenance badge | Fetching spec details |
| `DiffPanel` | Diff visualisation, breaking/non-breaking colours | Triggering diffs |
| `ImpactPanel` | Affected services list, severity badges | Calculating impact |
| `MigrationPanel` | Before/after payloads, validation badges, export | Calling the agent |
| `SpecUploader` | File drop, upload progress, version indicator | Spec parsing |

---

### 9.2 API Communication

Always use `axios`. Never use the raw `fetch` API. All calls go to `http://localhost:8000`.

```javascript
// ✅ axios with error handling
const sendMessage = async (message) => {
  try {
    const { data } = await axios.post('/api/chat', { message, spec_id: specId });
    setMessages(prev => [...prev, { role: 'assistant', content: data.answer,
                                    toolCalls: data.tool_calls,
                                    provenance: data.provenance }]);
  } catch (err) {
    setError(err.response?.data?.detail || 'Agent unavailable');
  }
};
```

---

### 9.3 Loading and Error States

Every API-connected component must have three states: loading, error, and success. No component should render blank or crash silently on API failure.

```jsx
{loading && <div className="text-gray-400 text-sm animate-pulse">Thinking...</div>}
{error   && <div className="text-red-400 text-sm">⚠️ {error}</div>}
{result  && <ResultCard data={result} />}
```

---

### 9.4 Tailwind Only

No custom CSS files. No inline `style={{}}` props except for dynamic values that Tailwind cannot express (e.g., dynamic widths from data). No CSS modules.

Brand colours as Tailwind arbitrary values where needed:
```jsx
<div className="bg-[#1A3A5C] text-white">   // primary navy
<div className="border-l-4 border-[#E74C3C]"> // breaking change red
<div className="bg-[#D5F5E3]">               // valid green background
```

---

## 10. Code Quality

### 10.1 Logging, Not Printing

```python
import logging
logger = logging.getLogger(__name__)

# ✅ Use logging
logger.info(f"Ingested spec: {name} v{version} — {endpoint_count} endpoints")
logger.error(f"Embedding failed for spec {spec_id}: {e}", exc_info=True)

# ❌ Never use print
print(f"Ingested: {name}")
```

---

### 10.2 Docstrings on Public Functions

Every public function and every MCP tool gets a one-line docstring. Not a novel — one line.

```python
async def search_endpoints(query: str, spec_id: int, limit: int = 5) -> list[EndpointSummary]:
    """Search endpoints in a spec by semantic similarity to the query string."""
```

---

### 10.3 Module Header Comment

Every Python file starts with a 3-line header:

```python
"""
Self-Aware API Platform — spec_diff.py
Compares two spec versions and classifies each change as BREAKING or NON_BREAKING.
"""
```

---

### 10.4 One Import Block

All imports at the top of the file, grouped: stdlib → third-party → local. No imports inside functions.

```python
# stdlib
import json
import logging
import os
import time

# third-party
import psycopg2
from dotenv import load_dotenv
from pydantic import BaseModel

# local
from storage.schema_store import get_endpoint_schema
from models import DiffItem
```

---

## 11. Demo & Delivery

### 11.1 Protect the Demo Path Above All Else

Three flows must work flawlessly:
1. Chat → search → get → validate (Demo 1)
2. Upload v2 → diff → breaking change display (Demo 2)
3. Self-heal → before/after → validated migration (Demo 3)

If time is short, cut `impact_analyze`, `MigrationPanel` polish, and the audit log modal UI **before** touching any of these three flows.

---

### 11.2 Pre-Demo Checklist

Run `/demo-rehearsal` in VS Code Copilot Chat 1 hour before presenting.  
Manually verify: Postgres running, both specs ingested, all 3 demo flows return expected results.

---

### 11.3 Sample Data Is Part of the Build

`banking-api-v1.yaml` and `banking-api-v2.yaml` are not throwaway test fixtures — they are **demo assets**. Treat them with the same care as code. The breaking changes in v2 (`companyRegistrationNumber` required, `deposit` enum removed) are the centrepiece of Demo 2.

---

### 11.4 The Responsible AI Panel Is a Judge Signal

Showing the audit log modal, the sandbox badge, and the provenance display during the demo communicates architectural maturity. Judges have seen many AI demos. Few show their audit trail. Show yours.

---

*Last updated: March 2026 — Self-Aware API Platform Hackathon Build*