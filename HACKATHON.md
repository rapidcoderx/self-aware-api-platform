# Self-Aware API Platform
## Hackathon Master Document

> **Version**: 1.0 · **Date**: March 2026 · **Format**: 48-Hour Build  
> **Builder**: Sathish Krishnan · Industry Principal & Finacle Banking Expert · Calgary, Canada  
> **Tools**: VS Code + GitHub Copilot (Claude) + Claude Code + Cursor  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Proposed Solution](#3-proposed-solution)
4. [Why It's Innovative](#4-why-its-innovative)
5. [System Architecture](#5-system-architecture)
6. [MCP Tool Contract](#6-mcp-tool-contract)
7. [Agent & Self-Healing Workflow](#7-agent--self-healing-workflow)
8. [Tech Stack & Justification](#8-tech-stack--justification)
9. [Responsible AI & Security](#9-responsible-ai--security)
10. [Demo Script](#10-demo-script)
11. [Build Plan](#11-build-plan)
12. [Project Structure](#12-project-structure)
13. [Environment Setup](#13-environment-setup)
14. [Best Practices Summary](#14-best-practices-summary)
15. [AI Tooling Strategy](#15-ai-tooling-strategy)
16. [Presentation Site](#16-presentation-site)
17. [Success Metrics](#17-success-metrics)
18. [Closing Statement](#18-closing-statement)

---

## 1. Executive Summary

Enterprise teams operate hundreds — often thousands — of APIs. Specs drift from reality, breaking changes propagate silently, and integration work becomes a repetitive cycle: search docs, guess payloads, debug failures, repeat.

**Self-Aware API Platform** converts API specifications (OpenAPI/Swagger) into an **AI-ready knowledge layer** and exposes **safe, typed tools via MCP** so an LLM agent can:

- Discover the right endpoint through semantic search
- Generate payloads **validated against the actual schema**
- Continuously monitor spec evolution for **breaking changes**
- Produce **impact analysis** mapped to downstream services
- Propose **self-healing migration guidance** — validated before display

This is not "chat over docs." It is **tool-first API lifecycle intelligence**.

**One-line pitch**:
> *"We turn API specs into living infrastructure — observable, validated, and self-healing — using MCP as the enforcement layer for safe agentic intelligence."*

---

## 2. Problem Statement

### 2.1 The Four Pain Points (Judge-Friendly)

| # | Problem | Real-World Impact |
|---|---|---|
| 1 | **API Discovery Is Hard** | Teams can't quickly find the right endpoint among many services and versions | Hours lost per integration |
| 2 | **Specs Drift from Reality** | Docs are updated late or inconsistently, causing silent integration errors | Production incidents |
| 3 | **Breaking Changes Detected Too Late** | Downstream systems fail before anyone is warned | Cascading failures |
| 4 | **LLM Usage Is Unsafe by Default** | AI answers hallucinate endpoints or payload fields without validation | Wrong implementations shipped |

### 2.2 The Banking Context

This project is built with a banking/fintech lens. In core banking platforms like Finacle, APIs govern account creation, transaction processing, customer onboarding, compliance reporting, and more. A single breaking change in `createAccount` can silently break:

- Customer onboarding flows
- CRM integrations
- Mobile banking backends
- Regulatory reporting pipelines

The cost of catching that change in production vs. at spec upload time is enormous.

### 2.3 The LLM Gap

Current AI coding assistants will happily generate an API payload from memory — based on what similar APIs "usually look like." They have no access to the actual schema. This produces code that:

- Compiles and runs
- Fails at runtime with a 422 Unprocessable Entity
- Wastes developer time debugging a hallucinated field name

Our platform closes this gap by making schema validation a non-negotiable step in every agent recommendation.

---

## 3. Proposed Solution

### 3.1 What We Build

A platform with three cooperating components:

#### Component 1 — Spec Ingestion + Normalisation
- Ingest OpenAPI/Swagger YAML or JSON (file upload or URL)
- Resolve all `$ref` references using `prance`
- Normalise into canonical endpoint representations
- Store as: structured JSONB (for validation) + vector embeddings (for search)
- Auto-version: re-ingesting the same spec name creates v2, v3, etc. — never overwrites

#### Component 2 — MCP Tool Server (Deterministic Execution)
- Expose 5 typed tools: search, get, validate, diff, impact
- Every tool is narrow, typed, and independently testable
- All tool calls logged to an immutable audit trail
- No tool calls external APIs — sandbox mode enforced at the tool level

#### Component 3 — Agent Orchestrator
- Claude API with native `tool_use` pattern — no orchestration framework
- LLM plans which tools to call; tools do the actual work
- Max 10 iterations guard — no infinite loops
- Every response includes provenance: spec version + operationId

### 3.2 What Makes It "Self-Aware"

The platform knows:
- Its own **structure** — schema + constraints for every endpoint
- Its own **evolution** — diff watcher that classifies every change
- Its own **dependencies** — impact mapping to downstream consumers
- Its own **state** — audit log of every action taken

It adapts its guidance based on that self-knowledge — hence "self-aware."

---

## 4. Why It's Innovative

### 4.1 Tool-First Agent Architecture (MCP Best Practice)

Most AI demos have the LLM call APIs directly or "pretend" to execute actions. In this platform:

- The agent **cannot** call the database, call external APIs, or validate a payload directly
- It **must** call an MCP tool for every external action
- Tools are narrow, typed, and auditable
- The agent's job is to **orchestrate** — tools **execute**

This is the correct architecture for production agentic systems.

### 4.2 Spec Change Intelligence

- Automatic spec versioning on every upload
- Structured diffs with **breaking change classification** at the field level
- Change types detected: `REQUIRED_ADDED`, `FIELD_REMOVED`, `TYPE_CHANGED`, `ENUM_CHANGED`
- Impact analysis maps changes to affected downstream services

### 4.3 Self-Healing — Advisory, Not Autonomous

When a breaking change is detected:
1. Agent generates a "before" payload (matching the old schema)
2. Agent generates an "after" payload (satisfying the new schema)
3. `spec_validate_request` is called on the after payload — must return `valid: true`
4. If invalid: agent revises using field-level error hints, re-validates
5. Output: before/after payloads + migration steps — **never auto-applied**

Human reviews before acting. The platform prepares; the developer decides.

### 4.4 Governance + Responsible AI by Design

Not bolted on after the fact — architectural constraints:
- Schema validation required before any recommendation
- Sandbox-only execution (Prism mock server — no production calls)
- Immutable audit log of every tool call
- Provenance badge on every agent answer
- Breaking change classification is explained, not just labelled

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────┐
│              INPUT LAYER                            │
│  OpenAPI/Swagger YAML or JSON (upload or URL)       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              INGESTION PIPELINE                     │
│  normalizer.py  →  chunker.py  →  embedder.py       │
│  (prance $ref)     (text repr)    (Voyage AI v3)    │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────┐
│  SCHEMA STORE    │      │    VECTOR STORE          │
│  Postgres JSONB  │      │    pgvector (dim=1024)   │
│  specs table     │      │    endpoints.embedding   │
│  endpoints table │      │    ivfflat cosine index  │
└──────────┬───────┘      └───────────┬──────────────┘
           │                          │
           └──────────┬───────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              CHANGE WATCHER                         │
│  hash comparison → version bump → spec_diff trigger │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              MCP TOOL SERVER                        │
│  spec_search  ·  spec_get  ·  spec_validate         │
│  spec_diff    ·  impact_analyze                     │
│  Python MCP SDK · stdio transport · typed JSON      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              AGENT ORCHESTRATOR                     │
│  Claude API · claude-sonnet-4-20250514              │
│  tool_use loop · max 10 iterations                  │
│  provenance on every response                       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              REACT UI                               │
│  Chat Panel  ·  Diff Panel  ·  Migration Panel      │
│  Audit Log Modal  ·  Spec Uploader                  │
│  Vite 5 · Tailwind CSS 3 · port 5173               │
└─────────────────────────────────────────────────────┘
```

### 5.1 Database Schema

```sql
-- One row per ingested spec version
specs (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    spec_json   JSONB NOT NULL,
    hash        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, version)
)

-- One row per endpoint operation, with vector embedding
endpoints (
    id           SERIAL PRIMARY KEY,
    spec_id      INTEGER REFERENCES specs(id) ON DELETE CASCADE,
    operation_id TEXT NOT NULL,
    method       TEXT NOT NULL,
    path         TEXT NOT NULL,
    summary      TEXT,
    tags         TEXT[],
    schema_json  JSONB NOT NULL,           -- full requestBody + responses
    embedding    vector(1024),             -- Voyage AI voyage-3
    created_at   TIMESTAMPTZ DEFAULT NOW()
)

-- Structured diff between two versions
diffs (
    id             SERIAL PRIMARY KEY,
    spec_id_old    INTEGER REFERENCES specs(id),
    spec_id_new    INTEGER REFERENCES specs(id),
    diff_json      JSONB NOT NULL,
    breaking_count INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
)

-- Immutable audit log — every MCP tool call
audit_logs (
    id          SERIAL PRIMARY KEY,
    tool_name   TEXT NOT NULL,
    inputs      JSONB,
    outputs     JSONB,
    spec_id     INTEGER,
    duration_ms INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 6. MCP Tool Contract

Five tools. Final. Never change the signatures.

### `spec.search`
```python
search_endpoints(query: str, spec_id: int, limit: int = 5) -> list[EndpointSummary]
```
Embeds the query using Voyage AI `voyage-3`, runs cosine similarity search against `endpoints.embedding`, returns top-N ranked results with similarity score.

### `spec.get_endpoint`
```python
get_endpoint(operation_id: str, spec_id: int) -> EndpointDetail
```
Returns the full canonical endpoint definition: request/response schema, parameters, auth, examples, spec version for provenance.

### `spec.validate_request`
```python
validate_request(operation_id: str, payload: dict, spec_id: int) -> ValidationResult
```
Deterministic JSON Schema validation using `jsonschema`. Returns `valid: bool` + field-level error list with hints. Called before every agent recommendation is shown to the user.

### `spec.diff`
```python
diff_specs(old_spec_id: int, new_spec_id: int) -> list[DiffItem]
```
Compares `requestBody` schemas of matching endpoints. Classifies each change:
- `BREAKING`: required field added, field removed, type changed, enum value removed
- `NON_BREAKING`: optional field added, description changed, example changed

### `impact.analyze`
```python
analyze_impact(diff_id: int) -> list[ImpactItem]
```
Loads `specs/dependencies.yaml`, maps each breaking change to affected downstream services. Returns severity-ranked impact list (`HIGH` / `MEDIUM` / `LOW`).

### Pydantic Models

```python
class EndpointSummary(BaseModel):
    operation_id: str
    method: str
    path: str
    summary: str | None
    score: float                    # cosine similarity 0–1

class EndpointDetail(BaseModel):
    operation_id: str
    method: str
    path: str
    summary: str | None
    tags: list[str]
    parameters: list[dict]
    request_body_schema: dict | None
    response_schemas: dict
    spec_version: int               # for provenance badge

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
    change_type: str                # REQUIRED_ADDED | FIELD_REMOVED | TYPE_CHANGED | ENUM_CHANGED
    field: str
    old_value: str | None
    new_value: str | None

class ImpactItem(BaseModel):
    operation_id: str
    affected_service: str
    team: str
    severity: str                   # HIGH | MEDIUM | LOW
    breaking_changes: list[DiffItem]
```

---

## 7. Agent & Self-Healing Workflow

### 7.1 Normal Agent Flow (Demo 1)

```
User: "How do I create a corporate deposit account?"
  │
  ├─ Agent calls spec_search(query, spec_id=1, limit=3)
  │    └─ Returns: [createAccount (0.94), updateAccount (0.71), listAccounts (0.68)]
  │
  ├─ Agent calls spec_get_endpoint(operation_id="createAccount", spec_id=1)
  │    └─ Returns: full schema with requestBody, required fields, examples
  │
  ├─ Agent generates payload from schema
  │
  ├─ Agent calls spec_validate_request(operation_id="createAccount", payload, spec_id=1)
  │    └─ Returns: {valid: true, errors: []}
  │
  └─ Agent returns answer with:
       - Validated payload example
       - Provenance badge: "Banking API v1.0 · createAccount"
       - Sandbox notice
```

### 7.2 Change Detection Flow (Demo 2)

```
User uploads banking-api-v2.yaml
  │
  ├─ Ingestion pipeline runs → spec stored as version 2
  │
  ├─ Change watcher: hash(v1) ≠ hash(v2) → triggers diff
  │
  ├─ spec_diff(old_spec_id=1, new_spec_id=2)
  │    └─ Returns:
  │         [BREAKING] createAccount · companyRegistrationNumber · REQUIRED_ADDED
  │         [BREAKING] createAccount · accountType · ENUM_CHANGED (deposit removed)
  │         [NON-BREAKING] createAccount · kycStatus · FIELD_ADDED (optional)
  │
  ├─ impact_analyze(diff_id=1)
  │    └─ Returns:
  │         createAccount → onboarding-service (HIGH)
  │         createAccount → crm-integration (HIGH)
  │         createAccount → mobile-app-backend (HIGH)
  │
  └─ UI: Diff panel opens — red BREAKING rows, yellow NON-BREAKING rows
         "2 breaking · 1 non-breaking · 3 services affected"
```

### 7.3 Self-Healing Flow (Demo 3)

```
User clicks "Generate Migration Plan"
  │
  ├─ Agent: gets current endpoint schema (v1 createAccount)
  │
  ├─ Agent: generates "before" payload matching old schema
  │    {accountName: "Acme Corp", accountType: "current"}
  │
  ├─ Agent: generates "after" payload satisfying new schema
  │    {accountName: "Acme Corp", accountType: "corporate",
  │     companyRegistrationNumber: "BC-1234567"}
  │
  ├─ Agent: calls spec_validate_request(after_payload, spec_id=2)
  │    └─ Returns: {valid: true, errors: []}
  │
  ├─ If invalid: agent revises using field-level error hints → re-validates
  │
  └─ UI: Migration panel renders
       - Before payload (red background — invalid for v2)
       - After payload (green background — "Valid ✓")
       - Migration steps: "Add required field companyRegistrationNumber"
       - "Export as JSON" button — human reviews before applying
       - Audit log: all tool calls visible
```

---

## 8. Tech Stack & Justification

### 8.1 Final Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | Python + FastAPI + uvicorn | Python 3.12.12 |
| Package Manager | uv | Latest |
| LLM | Anthropic Claude API | `claude-sonnet-4-20250514` |
| Agent Pattern | Claude native `tool_use` | No LangChain/LangGraph |
| MCP Server | Python MCP SDK | stdio transport |
| Vector Embeddings | Voyage AI | `voyage-3` · dim=1024 |
| Schema Store | PostgreSQL 16 + JSONB | Local · `selfaware_api` |
| Vector Store | pgvector | 0.8.2 · source-built |
| OpenAPI Parser | prance + jsonschema | $ref resolution |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 | port 5173 |
| Mock Server | Prism (@stoplight/prism-cli) | port 4010 |
| Presentation | React + Vite + Framer Motion | Deployed to Vercel |

### 8.2 Why This Stack — Judge Q&A Ready

**"Why Claude API and not OpenAI?"**
Claude's `tool_use` API is structurally aligned with MCP — both use typed JSON schemas for tools. This means MCP tool contracts and LLM tool calls share the same schema definition, reducing translation layers. We chose architectural alignment, not brand familiarity.

**"Why FastAPI and not Express/Node?"**
The OpenAPI validation ecosystem (`prance`, `jsonschema`, `openapi-spec-validator`) is Python-native. FastAPI auto-generates OpenAPI docs — meta-appropriate for a platform about API intelligence. Same language across ingestion, storage, tools, and validation.

**"Why pgvector instead of a dedicated vector DB?"**
One DB instance stores both structured schema (JSONB) and vectors. One connection string, one backup, one mental model. At scale, migrating to Pinecone is a one-day task. In a hackathon, this demonstrates production pragmatism.

**"Why React/Vite instead of Streamlit?"**
Streamlit looks like a prototype. React/Vite/Tailwind looks like a product. In a hackathon judged on ambition and polish, the UI signal matters. Vite's HMR means instant live reload. Tailwind means AI-assisted code generation produces pixel-accurate results.

**"Why Prism for sandbox?"**
Prism reads the OpenAPI spec and spawns a validated mock server in one command. The mock is spec-accurate by definition — it validates requests and responses against the same schema the agent uses. That's not a convenience hack; that's the correct architecture.

**"Why no LangChain/LangGraph?"**
Tool-use loops are 30 lines of Python. Adding an orchestration framework adds complexity, debugging overhead, and abstraction that obscures what the agent is actually doing. For a 48-hour build and a judge demo, hand-rolled is the right call.

---

## 9. Responsible AI & Security

### 9.1 Guardrails (Architectural, Not Advisory)

| Guardrail | Implementation | Where |
|---|---|---|
| Sandbox-only execution | `SANDBOX_MODE=true` enforced at tool level — blocks non-Prism URLs | `tools/spec_validate.py` |
| Schema validation required | Every agent recommendation passes `spec_validate_request` before display | `agent.py` |
| Provenance on every answer | Spec version + operationId shown as badge on every response | `ChatPanel.jsx` |
| Least privilege auth | Tools accept `auth_ref` string, never raw secrets | All tool files |
| Immutable audit log | Every tool call logged — no UPDATE/DELETE on `audit_logs` | `storage/schema_store.py` |
| Human-in-the-loop | Migration plan requires explicit user confirmation — never auto-applied | `MigrationPanel.jsx` |
| PII hygiene | Request bodies not stored in audit logs; fictional data in sample specs | `agent.py` |
| Confidence signalling | Ambiguous queries return top-N options with scores — never false certainty | `agent.py` |

### 9.2 Failure Modes Handled

| Failure Mode | Handling |
|---|---|
| Ambiguous query | Return top-3 endpoints with confidence scores — agent asks user to confirm |
| Validation errors | Field-level corrective hints — agent revises and re-validates |
| Diff uncertainty | Mark change as "needs review" rather than force-classifying |
| Agent loop timeout | MAX_ITERATIONS=10 guard raises RuntimeError → HTTP 503 response |
| External API unavailable | Voyage AI / Anthropic failures caught, logged, HTTP 503 returned |

### 9.3 Security Rules

- All secrets in `.env` — never in code, never in logs, never in git
- All SQL parameterised — no f-string queries anywhere
- Audit log entries sanitised before write — sensitive key patterns redacted
- `.env` in `.gitignore` — enforced by bootstrap script

---

## 10. Demo Script

**Total time: 3–4 minutes. Three demos. One narrative arc.**

### Setup Before Demo
```bash
# Terminal 1 — Backend
cd ~/self-aware-api-platform/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd ~/self-aware-api-platform/frontend
npm run dev

# Terminal 3 — Prism mock
prism mock specs/banking-api-v1.yaml --port 4010

# Browser — open both
open http://localhost:5173       # App
open http://localhost:8000/docs  # FastAPI backup
```

---

### Demo 1 — Discover & Validate (90 seconds)

| Step | Action | Talking Point |
|---|---|---|
| 1 | Type: *"How do I create a corporate deposit account?"* | "I'll ask a natural language question." |
| 2 | Agent calls `spec.search` | "It's not guessing — it's calling a typed tool against a vector index." |
| 3 | Endpoint card appears in right panel | "Full schema retrieved. Method, path, requestBody, required fields." |
| 4 | Agent generates example payload | "Generated from the actual schema — not from training memory." |
| 5 | `spec.validate_request` → green "Valid ✓" | "Every recommendation is schema-validated before it reaches you." |
| 6 | Point to provenance badge | "Banking API v1.0 · operationId: createAccount. Full audit trail." |

---

### Demo 2 — Breaking Change Detected (60 seconds)

| Step | Action | Talking Point |
|---|---|---|
| 1 | Drop `banking-api-v2.yaml` into upload zone | "The API team just pushed a new spec version." |
| 2 | Click "Compare with v1" | Diff panel opens automatically |
| 3 | Show red ⚠️ row: `companyRegistrationNumber` | "New required field. Any existing integration breaks silently." |
| 4 | Show red ⚠️ row: `accountType` enum change | "`deposit` removed from the enum. Another silent break." |
| 5 | Show 3 affected services | "This would have broken 3 downstream systems in production. We caught it at spec upload." |
| 6 | Show yellow NON-BREAKING row | "Not all changes are equal. We classify them." |

---

### Demo 3 — Self-Heal (60 seconds)

| Step | Action | Talking Point |
|---|---|---|
| 1 | Click "Generate Migration Plan" | Agent runs self-heal loop |
| 2 | Before payload (red): missing field | "This is what your current integration sends. It will fail against v2." |
| 3 | After payload (green): field added | "This is what it needs to send." |
| 4 | "Valid ✓" badge on after payload | "Schema-validated. Not a guess." |
| 5 | Show migration steps | "Advisory only. You review. You apply." |
| 6 | Open audit log modal | "Every tool call. Every input. Every output. Nothing is hidden." |

---

### Closing Line
> *"Self-Aware API Platform doesn't chat about APIs. It acts on them — safely, with validation at every step and a full audit trail. This is what responsible agentic infrastructure looks like."*

---

## 11. Build Plan

### Day 1 — Build the Spine

**Goal**: Ask a question → agent finds endpoint → produces payload → validates successfully.

| Block | Tasks | Exit Check |
|---|---|---|
| Morning (3–4h) | Repo scaffold, DB schema, OpenAPI normaliser, embedding pipeline, `POST /api/specs/ingest` | Upload `banking-api-v1.yaml` → 200 + endpoint count |
| Afternoon (3–4h) | `spec_search`, `spec_get_endpoint`, `spec_validate_request` tools, MCP server, agent orchestrator | End-to-end: question → tool calls → validated answer |
| Evening (2–3h) | React 3-panel layout, ChatPanel, ValidationPanel, wire to backend | Chat works, tool call chips visible, validation badge renders |

### Day 2 — Add the Differentiators

**Goal**: Upload v2 → platform flags breaking change → suggests and validates fix → demo ready.

| Block | Tasks | Exit Check |
|---|---|---|
| Morning (3–4h) | Spec versioning, `spec_diff` tool, `POST /api/specs/compare`, DiffPanel UI | Upload v2 → 2 BREAKING + 1 NON-BREAKING shown in colour |
| Afternoon (3–4h) | `impact_analyze` tool, self-heal loop in agent, MigrationPanel UI | Migration plan renders with before/after + "Valid ✓" |
| Evening (2–3h) | Responsible AI panel, audit log modal, SpecUploader, demo rehearsal | Full 3-demo sequence runs clean twice |

### Build Order (Module Dependencies)

```
1.  backend/main.py                     ← FastAPI scaffold
2.  backend/storage/schema_store.py     ← DB connection + CRUD
3.  backend/ingestion/normalizer.py     ← prance → endpoint dicts
4.  backend/ingestion/embedder.py       ← Voyage AI batch embed
5.  POST /api/specs/ingest              ← wires 2–4
6.  backend/tools/spec_search.py        ← pgvector search
7.  backend/tools/spec_get.py           ← schema retrieval
8.  backend/tools/spec_validate.py      ← jsonschema validation
9.  backend/mcp_server.py               ← registers tools 6–8
10. backend/agent.py                    ← Claude tool_use loop
11. POST /api/chat                      ← wires agent to HTTP
12. frontend: ChatPanel.jsx             ← Day 1 UI
13. frontend: ValidationPanel.jsx
--- Day 1 gate ---
14. Spec versioning in ingest route
15. backend/tools/spec_diff.py
16. POST /api/specs/compare
17. frontend: DiffPanel.jsx
18. backend/tools/impact_analyze.py
19. Self-heal loop in agent.py
20. frontend: MigrationPanel.jsx
21. Responsible AI panel + audit log modal
22. SpecUploader.jsx
--- Day 2 gate ---
```

---

## 12. Project Structure

```
~/self-aware-api-platform/
│
├── HACKATHON.md                         ← This document (master reference)
├── CLAUDE.md                            ← Claude Code session context + build tracker
├── BEST-PRACTICES.md                    ← Full engineering best practices
├── AI-SESSION-CONTEXT.md                ← Paste-anywhere context for any AI chat
├── .python-version                      ← 3.12.12
├── .gitignore
├── README.md
│
├── .github/
│   ├── copilot-instructions.md          ← GitHub Copilot global rules
│   ├── agents/                          ← 5 custom Copilot agents
│   │   ├── api-platform-builder.agent.md
│   │   ├── api-platform-planner.agent.md
│   │   ├── api-platform-reviewer.agent.md
│   │   ├── api-platform-debugger.agent.md
│   │   └── api-platform-demo-coach.agent.md
│   └── prompts/                         ← 7 slash command prompts
│       ├── load-context.prompt.md
│       ├── build-module.prompt.md
│       ├── check-progress.prompt.md
│       ├── review-module.prompt.md
│       ├── demo-rehearsal.prompt.md
│       ├── fix-and-explain.prompt.md
│       └── build-presentation.prompt.md
│
├── backend/
│   ├── .venv/                           ← Python 3.12.12 uv venv
│   ├── .env                             ← API keys (never committed)
│   ├── .env.example
│   ├── .python-version                  ← 3.12.12
│   ├── main.py                          ← FastAPI app entry + CORS + health
│   ├── mcp_server.py                    ← MCP server (stdio transport)
│   ├── agent.py                         ← Claude tool_use orchestrator
│   ├── requirements.txt                 ← frozen by uv pip freeze
│   ├── ingestion/
│   │   ├── normalizer.py                ← prance → canonical endpoint dicts
│   │   ├── chunker.py                   ← endpoint → embedding text
│   │   └── embedder.py                  ← Voyage AI batch embed (groups of 50)
│   ├── storage/
│   │   ├── schema_store.py              ← specs + endpoints CRUD
│   │   ├── vector_store.py              ← pgvector cosine similarity search
│   │   └── init_db.sql                  ← schema (applied by bootstrap)
│   └── tools/
│       ├── spec_search.py               ← vector search tool
│       ├── spec_get.py                  ← schema retrieval tool
│       ├── spec_validate.py             ← JSON Schema validation tool
│       ├── spec_diff.py                 ← breaking change classifier tool
│       └── impact_analyze.py            ← dependency impact tool
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   └── components/
│   │       ├── ChatPanel.jsx
│   │       ├── DiffPanel.jsx
│   │       ├── ImpactPanel.jsx
│   │       ├── MigrationPanel.jsx
│   │       └── SpecUploader.jsx
│   └── package.json
│
├── presentation/                        ← Vercel-deployed hackathon deck
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── StarField.jsx
│   │       ├── Navigation.jsx
│   │       └── sections/
│   │           ├── Hero.jsx
│   │           ├── Problem.jsx
│   │           ├── Solution.jsx
│   │           ├── Architecture.jsx
│   │           ├── MCPTools.jsx
│   │           ├── DemoFlow.jsx
│   │           ├── TechStack.jsx
│   │           ├── ResponsibleAI.jsx
│   │           ├── LiveDemo.jsx
│   │           └── CallToAction.jsx
│   └── vercel.json
│
└── specs/
    ├── banking-api-v1.yaml              ← Demo baseline spec
    ├── banking-api-v2.yaml              ← Demo breaking change spec
    └── dependencies.yaml               ← Mock dependency graph
```

---

## 13. Environment Setup

### 13.1 Prerequisites (Mac Intel 2018 Pro)

| Component | Status | Notes |
|---|---|---|
| Homebrew | ✅ Installed | v5.0.16 |
| Node.js | ✅ v22.22.0 | ≥ v18 required |
| Python | ✅ 3.12.12 via uv | System has 3.14 but pinned to 3.12 |
| PostgreSQL 16 | ✅ Running | `selfaware_api` DB created |
| pgvector 0.8.2 | ✅ Active | Source-built (brew version conflicted with PG16 on Intel) |
| uv | ✅ Installed | Package manager for Python |
| Vercel CLI | ✅ Installed | For presentation deployment |

### 13.2 Environment Variables (`backend/.env`)

```env
ANTHROPIC_API_KEY=sk-ant-xxxx        # Claude API
VOYAGE_API_KEY=pa-xxxx               # Voyage AI embeddings
DATABASE_URL=postgresql://localhost:5432/selfaware_api
ENVIRONMENT=development
SANDBOX_MODE=true                    # Enforced — no prod calls
LOG_LEVEL=info
PRISM_MOCK_URL=http://localhost:4010
```

### 13.3 Scripts Available

| Script | Purpose | Run Order |
|---|---|---|
| `verify-prereqs-1-2.sh` | Verify Mac environment (10 checks) | 1st |
| `bootstrap-project.sh` | Scaffold full project + DB schema | 2nd |
| `setup-venv.sh` | Create uv venv + install all deps | 3rd |
| `bootstrap-presentation.sh` | Scaffold presentation site | Optional |

---

## 14. Best Practices Summary

### Architecture
- **Tool-first**: agent orchestrates, tools execute — never the reverse
- **Single responsibility**: each file does one thing
- **Dependency direction**: routes → agent → tools → storage → DB
- **No premature abstraction**: YAGNI for a 48-hour build

### Code Quality
- Python 3.12.12 via uv — pinned in `.python-version`
- Type hints on every function signature
- Pydantic v2 models for all structured data
- Raw psycopg2 with parameterised `%s` queries — no ORM
- `logging` module only — no `print()`
- Async FastAPI throughout — no sync route handlers

### Security
- Secrets only in `.env` — never in code or logs
- All SQL parameterised — no f-string queries
- Audit log sanitised — sensitive patterns redacted
- Sandbox mode enforced at tool level

### Responsible AI
- Schema validation before every recommendation
- Provenance on every agent answer
- Human-in-the-loop for all migration actions
- Transparent tool calls in UI
- Immutable audit log
- Confidence signalling on ambiguous queries
- No hallucinated endpoints — always retrieve from schema

---

## 15. AI Tooling Strategy

This project is built solo using AI-assisted development. Here is the tooling stack and how each tool is used:

### VS Code GitHub Copilot (Claude-powered)
Primary coding environment. Uses:
- **5 custom agents** (Builder, Planner, Reviewer, Debugger, Demo Coach) in `.github/agents/`
- **7 prompt slash commands** in `.github/prompts/` — invoked with `/`
- **`copilot-instructions.md`** for always-on project constraints

**Workflow per module**:
1. `/load-context` — orient the session
2. Switch to Builder agent → `/build-module tools/spec_diff.py`
3. Switch to Reviewer agent → `/review-module backend/tools/spec_diff.py`
4. Switch to Builder → fix blockers
5. `/check-progress` — plan next module

### Claude Code
Used for longer, multi-file generation sessions. Reads `CLAUDE.md` automatically. Best for:
- Scaffolding entire modules from scratch
- Complex integrations (MCP server wiring, agent loop)
- When context window needs to span multiple files

### Cursor
Used for targeted edits and refactoring. Reads `.cursorrules`. Best for:
- In-place edits to existing files
- Pattern-matching completions using project-specific patterns
- Fast iteration on React components

### Session Start Ritual (Every Session)
```
1. Open VS Code in ~/self-aware-api-platform
2. Run /load-context in Copilot Chat
3. Check CLAUDE.md build tracker
4. State today's goal clearly before writing any code
```

---

## 16. Presentation Site

A separate React/Vite application deployed to Vercel. Built at `presentation/`.

**Theme**: Deep space observatory — animated star field, glass morphism cards, cinematic scroll reveals.

**Sections** (10 total):
Hero → Problem → Solution → Architecture → MCP Tools → Demo Flows → Tech Stack → Responsible AI → Live Demo → Call to Action

**Key visual features**:
- 220-star animated canvas with per-star twinkle, 5 shooting stars, mouse parallax
- Glass morphism cards with cyan glow borders
- Framer Motion scroll-triggered section reveals
- Typing terminal animation for the live demo section
- Animated counter stats on the closing slide

**Deploy**:
```bash
cd ~/self-aware-api-platform/presentation
vercel --prod
```

---

## 17. Success Metrics

These are the metrics we reference during the pitch. Each has a concrete demo moment.

| Metric | Claim | Demo Moment |
|---|---|---|
| Discovery speed | Minutes → 12 seconds | Stopwatch during Demo 1 |
| Breaking change detection | Caught at upload, not production | Demo 2 — 3 affected services named |
| Payload accuracy | 100% schema-validated before display | "Valid ✓" badge in Demo 1 |
| Migration speed | 45 seconds vs 2–3 hours manual | Demo 3 — before/after in one click |
| Audit completeness | Every tool call logged, visible in UI | Audit log modal in Demo 3 |

---

## 18. Closing Statement

Self-Aware API Platform demonstrates how **tool-first agent architectures** via MCP can make APIs **observable, explainable, and resilient**.

By combining:
- **Schema intelligence** — vector search + deterministic validation
- **Change detection** — structured diff with breaking change classification
- **Self-healing guidance** — validated migration plans, human-reviewed

...we turn API specifications into **living infrastructure** — a practical, responsible step toward autonomous enterprise platforms.

The project is built in 48 hours by a solo developer using AI-assisted tooling, demonstrating that structured documentation, disciplined architecture decisions, and the right AI tooling stack can compress what would normally be weeks of platform engineering into a compelling, working demo.

---

**Build started**: March 2026  
**Platform**: Mac Intel 2018 Pro · macOS · VS Code + GitHub Copilot (Claude)  
**Domain**: Banking / Fintech API Intelligence  
**Architect**: Sathish Krishnan · Industry Principal · Finacle Banking Expert

---

*This document is the single source of truth for the hackathon project.  
All agents, prompts, scripts, and code in this repo serve the objective defined here.*