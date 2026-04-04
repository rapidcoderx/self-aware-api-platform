# Self-Aware API Platform — Detailed Code Walkthrough

> A technical deep-dive into the three core flows: **Ingest**, **Query**, and **Self-Heal**.
> Includes Mermaid diagrams, code references, and a forward-looking viewpoint on full automation and CI/CD integration.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Flow 1 — Spec Ingestion](#2-flow-1--spec-ingestion)
3. [Flow 2 — Query (Discover & Validate)](#3-flow-2--query-discover--validate)
4. [Flow 3 — Self-Heal (Migration Generation)](#4-flow-3--self-heal-migration-generation)
5. [Viewpoint — Fully Automated Self-Heal Propagation](#5-viewpoint--fully-automated-self-heal-propagation)
6. [Viewpoint — CLI & CI/CD Pipeline Integration](#6-viewpoint--cli--cicd-pipeline-integration)

---

## 1. Architecture Overview

The platform is a **tool-first, agent-mediated** system. The LLM (Claude) never touches the database directly — every action flows through a typed MCP tool, and every tool call is logged to `audit_logs`.

```mermaid
graph TB
    subgraph "Frontend — React + Vite"
        UI[React UI<br/>ChatPanel · DiffPanel · MigrationPanel]
    end

    subgraph "Backend — FastAPI"
        API[FastAPI Routes<br/>POST /api/specs/ingest<br/>POST /api/chat<br/>POST /api/specs/compare<br/>POST /api/agent/self-heal]
        AGENT[Agent Orchestrator<br/>agent.py — Claude tool_use loop]
    end

    subgraph "MCP Tool Layer — 5 Typed Tools"
        T1[search_endpoints]
        T2[get_endpoint]
        T3[validate_request]
        T4[diff_specs]
        T5[analyze_impact]
    end

    subgraph "Ingestion Pipeline"
        NORM[normalizer.py<br/>prance $ref resolution]
        CHUNK[chunker.py<br/>endpoint → text chunk]
        EMBED[embedder.py<br/>Voyage AI voyage-4]
    end

    subgraph "Storage Layer"
        PG[(PostgreSQL 16<br/>specs · endpoints · diffs · audit_logs)]
        VEC[(pgvector<br/>vector 1024 embeddings)]
    end

    subgraph "External Services"
        CLAUDE[Anthropic Claude<br/>claude-sonnet-4-20250514]
        VOYAGE[Voyage AI<br/>voyage-4 dim=1024]
    end

    UI --> API
    API --> AGENT
    AGENT --> CLAUDE
    AGENT --> T1 & T2 & T3 & T4 & T5
    T1 --> VEC
    T1 --> VOYAGE
    T2 --> PG
    T3 --> PG
    T4 --> PG
    T5 --> PG
    API --> NORM --> CHUNK --> EMBED --> PG
    EMBED --> VOYAGE
    T1 & T2 & T3 & T4 & T5 --> PG

    style AGENT fill:#4f46e5,color:#fff
    style PG fill:#0f766e,color:#fff
    style VEC fill:#0f766e,color:#fff
    style CLAUDE fill:#d97706,color:#fff
    style VOYAGE fill:#d97706,color:#fff
```

### Database Schema (Quick Reference)

| Table | Purpose | Key Columns |
|---|---|---|
| `specs` | One row per ingested spec version | `id`, `name`, `version`, `spec_json` (JSONB), `hash` |
| `endpoints` | One row per operation with embedding | `spec_id`, `operation_id`, `method`, `path`, `schema_json`, `embedding` vector(1024) |
| `diffs` | Stored diff between two spec versions | `spec_id_old`, `spec_id_new`, `diff_json` (JSONB), `breaking_count` |
| `audit_logs` | Every MCP tool call | `tool_name`, `inputs`, `outputs`, `duration_ms` |

---

## 2. Flow 1 — Spec Ingestion

### What happens when you upload an OpenAPI spec

The ingestion pipeline transforms a raw YAML/JSON OpenAPI spec into **normalized endpoint dicts**, **1024-dim vector embeddings**, and **Postgres rows** — making every endpoint semantically searchable.

### Mermaid Flow Diagram

```mermaid
flowchart TD
    A[User uploads YAML/JSON<br/><b>POST /api/specs/ingest</b>] --> B{File valid?}
    B -- No --> B1[HTTP 400<br/>Bad Request]
    B -- Yes --> C[Write to temp file<br/>prance needs filesystem path]
    C --> D[SSRF Check<br/>_reject_http_refs]
    D -- HTTP $ref found --> D1[ValueError<br/>Blocked external ref]
    D -- Safe --> E[<b>normalizer.py</b><br/>prance.ResolvingParser<br/>Resolve all $ref chains]
    E --> F[Extract endpoints<br/>Iterate paths x methods<br/>Build canonical dicts]
    F --> G{Endpoints found?}
    G -- No --> G1[HTTP 422<br/>No endpoints]
    G -- Yes --> H[<b>schema_store.upsert_spec</b><br/>SHA-256 hash check<br/>Auto-increment version]
    H --> I{Hash already exists?}
    I -- Yes --> I1[Return existing<br/>No changes made]
    I -- No, new version --> J[<b>chunker.py</b><br/>Each endpoint to rich text chunk<br/>METHOD PATH + fields + enums]
    J --> K[<b>embedder.py</b><br/>Voyage AI voyage-4<br/>Batch embed dim 1024 vectors]
    K --> L[<b>bulk_insert_endpoints</b><br/>Single transaction<br/>vector cast]
    L --> M[HTTP 201<br/>spec_id + version + endpoint_count]
    K -- Failure --> N[Rollback: delete_spec<br/>HTTP 502]

    style E fill:#4f46e5,color:#fff
    style K fill:#d97706,color:#fff
    style L fill:#0f766e,color:#fff
```

### Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as React Frontend
    participant API as FastAPI main.py
    participant NORM as normalizer.py
    participant CHUNK as chunker.py
    participant EMB as embedder.py
    participant VOY as Voyage AI
    participant DB as PostgreSQL

    User->>FE: Select and upload spec file
    FE->>API: POST /api/specs/ingest (multipart: file + name)
    API->>API: Write content to temp file

    API->>NORM: normalize_spec(tmp_path)
    NORM->>NORM: _reject_http_refs() SSRF guard
    NORM->>NORM: prance.ResolvingParser(strict=False)
    NORM->>NORM: Iterate paths x HTTP methods
    NORM->>NORM: For each operation:<br/>extract operationId or auto-generate<br/>merge path+op level params<br/>extract requestBodySchema<br/>extract responseSchemas
    NORM-->>API: (raw_spec_dict, list of endpoint_dicts)

    API->>DB: upsert_spec(name, raw_spec) SHA-256 hash check
    alt Hash match — already ingested
        DB-->>API: (spec_id, version, is_new=False)
        API-->>FE: 201 No changes made
    else New content
        DB-->>API: (spec_id, version, is_new=True)

        loop For each endpoint
            API->>CHUNK: chunk_endpoint(endpoint_dict)
            CHUNK-->>API: rich text string
        end

        API->>EMB: embed_texts(texts, input_type=document)
        EMB->>VOY: client.embed(batch, model=voyage-4)
        VOY-->>EMB: list of 1024-dim float vectors
        EMB-->>API: embeddings list

        API->>DB: bulk_insert_endpoints(spec_id, endpoints, embeddings) single transaction
        DB-->>API: OK

        API-->>FE: 201 {spec_id, name, version, endpoint_count}
    end

    FE-->>User: Ingested N endpoints as vX
```

### Code Walkthrough — Key Functions

#### 1. `normalizer.py` → `normalize_spec(spec_path)`
- **SSRF protection**: `_reject_http_refs()` scans the raw file content for `$ref: http://` patterns before parsing. Blocks external references to prevent Server-Side Request Forgery.
- **Full $ref resolution**: `prance.ResolvingParser` recursively resolves all `$ref` chains (`#/components/schemas/...`, local file refs) into inline JSON.
- **Canonical extraction**: For every `(path, method)` pair, builds a dict with `operation_id`, `method`, `path`, `summary`, `tags`, `parameters`, `request_body_schema`, `response_schemas`, and the full `schema_json`.
- **Parameter merging**: `_merge_parameters()` merges path-level and operation-level parameters, with operation-level winning on `(name, in)` key collisions.

#### 2. `chunker.py` → `chunk_endpoint(endpoint_dict)`
Converts a canonical endpoint dict into a rich text string designed for high-quality semantic embedding:
```
POST /accounts
operationId: createAccount
summary: Create a new bank account
tags: accounts
requestBody fields: accountName (string, required); accountType (string, required, enum: savings, checking, deposit)
response 201 fields: id, accountName, accountType, status, createdAt
```
This structured text ensures that vector similarity search works on **method + path + field names + enum values** — not just summaries.

#### 3. `embedder.py` → `embed_texts(texts, input_type)`
- Thread-safe lazy client initialization (double-checked locking).
- Batches texts in groups of 50 (Voyage AI limit is 128, capped for safety).
- Uses `input_type="document"` for stored content, `input_type="query"` for search queries — this asymmetric embedding improves retrieval accuracy.

#### 4. `schema_store.py` → `upsert_spec()` + `bulk_insert_endpoints()`
- **Idempotent ingestion**: SHA-256 hash of `json.dumps(spec_json, sort_keys=True)`. Same content = same hash = skip re-embedding.
- **Auto-versioning**: `COALESCE(MAX(version), 0) + 1` per spec name. Retries once on `UNIQUE(name, version)` race condition.
- **Atomic insert**: `bulk_insert_endpoints` uses a single `executemany()` + `commit()`. On failure, the orphaned spec row is cleaned up.

---

## 3. Flow 2 — Query (Discover & Validate)

### What happens when a user asks "How do I create a corporate deposit account?"

The query flow uses a **Claude tool_use agent loop** — Claude decides which tools to call, processes the results, and synthesises a grounded answer with provenance.

### Mermaid Flow Diagram

```mermaid
flowchart TD
    A[User asks:<br/>How do I create a corporate<br/>deposit account?] --> B[POST /api/chat<br/>message + spec_id]
    B --> C[Verify spec exists]
    C --> D[<b>agent.py run_agent</b><br/>Inject spec context into message]
    D --> E[Claude API call<br/>model: claude-sonnet-4-20250514<br/>system: SYSTEM_PROMPT<br/>tools: TOOL_DEFINITIONS]

    E --> F{stop_reason?}
    F -- tool_use --> G[Dispatch tool calls<br/>concurrently via asyncio.gather]
    G --> H[<b>spec_search</b><br/>Embed query with Voyage AI<br/>Cosine search pgvector<br/>Return top-N matches]
    H --> I[Append tool results<br/>to conversation]
    I --> E

    F -- tool_use --> J[<b>spec_get_endpoint</b><br/>Fetch full schema for<br/>top-match operationId]
    J --> I

    F -- tool_use --> K[<b>spec_validate_request</b><br/>jsonschema.validate<br/>Claude-generated payload]
    K --> I

    F -- end_turn --> L[Extract text answer<br/>Build provenance<br/>Log to audit_logs]
    L --> M[Return AgentResponse<br/>answer + tool_calls + provenance]

    style D fill:#4f46e5,color:#fff
    style H fill:#d97706,color:#fff
    style L fill:#0f766e,color:#fff
```

### Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as React ChatPanel
    participant API as POST /api/chat
    participant AGENT as agent.py run_agent
    participant CLAUDE as Claude API
    participant SEARCH as spec_search tool
    participant VOY as Voyage AI
    participant VEC as pgvector
    participant GET as spec_get_endpoint tool
    participant VAL as spec_validate_request tool
    participant DB as PostgreSQL
    participant AUDIT as audit_logs

    User->>FE: How do I create a corporate deposit account?
    FE->>API: POST /api/chat {message, spec_id}
    API->>API: Verify spec_id exists in DB
    API->>AGENT: run_agent(user_message, spec_id)
    AGENT->>AGENT: Inject spec context: spec_id=1 name=banking-api version=1

    rect rgb(255, 248, 220)
        Note over AGENT,CLAUDE: Iteration 1 — Claude decides to search
        AGENT->>CLAUDE: messages.create(tools=TOOL_DEFINITIONS)
        CLAUDE-->>AGENT: stop_reason=tool_use<br/>tool: spec_search(query=create corporate deposit account, spec_id=1)

        AGENT->>SEARCH: search_endpoints(query, spec_id=1, limit=3)
        SEARCH->>VOY: embed_single(query, input_type=query)
        VOY-->>SEARCH: 1024-dim vector
        SEARCH->>VEC: SELECT ... ORDER BY embedding cosine distance LIMIT 3
        VEC-->>SEARCH: [{createAccount, 0.87}, {listAccounts, 0.52}, ...]
        SEARCH->>AUDIT: log tool call
        SEARCH-->>AGENT: list of EndpointSummary
    end

    rect rgb(220, 237, 255)
        Note over AGENT,CLAUDE: Iteration 2 — Claude retrieves full schema
        AGENT->>CLAUDE: messages + tool_results
        CLAUDE-->>AGENT: stop_reason=tool_use<br/>tool: spec_get_endpoint(operation_id=createAccount, spec_id=1)

        AGENT->>GET: get_endpoint(createAccount, spec_id=1)
        GET->>DB: SELECT ... FROM endpoints JOIN specs
        DB-->>GET: schema_json with requestBodySchema
        GET->>AUDIT: log tool call
        GET-->>AGENT: EndpointDetail (full schema)
    end

    rect rgb(220, 255, 220)
        Note over AGENT,CLAUDE: Iteration 3 — Claude validates a payload
        AGENT->>CLAUDE: messages + tool_results
        CLAUDE-->>AGENT: stop_reason=tool_use<br/>tool: spec_validate_request(createAccount,<br/>{accountName: Acme Corp, accountType: deposit}, spec_id=1)

        AGENT->>VAL: validate_request(createAccount, payload, spec_id=1)
        VAL->>DB: Fetch requestBodySchema
        VAL->>VAL: jsonschema.Draft7Validator.iter_errors(payload)
        VAL->>AUDIT: log tool call (payload keys only, not values)
        VAL-->>AGENT: ValidationResult{valid: true, errors: []}
    end

    rect rgb(245, 240, 255)
        Note over AGENT,CLAUDE: Iteration 4 — Claude composes final answer
        AGENT->>CLAUDE: messages + tool_results
        CLAUDE-->>AGENT: stop_reason=end_turn<br/>text: To create a corporate deposit account use POST /accounts with...
    end

    AGENT->>AGENT: _extract_provenance -> spec_name, version, operation_id
    AGENT->>AUDIT: log run_agent (iterations, tool_calls_count)
    AGENT-->>API: AgentResponse{answer, tool_calls, provenance}
    API-->>FE: ChatResponse{answer, tool_calls, provenance, spec_id}
    FE-->>User: Render answer + provenance badge + tool call accordion
```

### Code Walkthrough — Key Mechanics

#### Agent Loop (`agent.py` → `run_agent()`)
- **Max 10 iterations**: Hard guard. Raises `RuntimeError` if exceeded.
- **Concurrent tool dispatch**: When Claude returns multiple `tool_use` blocks in a single response, they are dispatched concurrently via `asyncio.gather()`.
- **Token-efficient**: `max_tokens=1024` (chat answers are concise). `response_schemas` stripped from `spec_get_endpoint` results to save input tokens. Search `limit` capped at 3.
- **Provenance extraction**: After the loop, `_extract_provenance()` scans tool call history — prefers `spec_get_endpoint` inputs for `operation_id`, falls back to first `spec_search` result.

#### Vector Search (`spec_search.py` → `search_endpoints()`)
- Embeds the query with `input_type="query"` (asymmetric retrieval).
- pgvector cosine distance: `1 - (embedding <=> %s::vector) AS score`.
- Results sorted by distance ascending (best match first), score = `1 - distance`.

#### Validation (`spec_validate.py` → `validate_request()`)
- Uses `jsonschema.Draft7Validator.iter_errors()` — single pass, collects **all** errors at once.
- Each error gets a structured `hint` based on `validator` type (required, enum, type, pattern, minLength, etc.).
- **Security**: Only `payload.keys()` are logged — never the values (which may contain PII).

#### Audit Trail
Every tool call logs to `audit_logs` in its `finally` block — ensuring logging even on failure:
```
tool_name | inputs (sanitized) | outputs (summary) | spec_id | duration_ms | created_at
```

---

## 4. Flow 3 — Self-Heal (Migration Generation)

### What happens when you click "Generate Migration Plan"

The self-heal flow detects breaking changes between two spec versions, builds a **before payload** (valid for v1, invalid for v2), uses a **Claude tool_use loop** to generate a valid **after payload** for v2, and returns step-by-step migration instructions.

### Mermaid Flow Diagram

```mermaid
flowchart TD
    A[User clicks<br/><b>Generate Migration Plan</b><br/>for createAccount] --> B[<b>POST /api/agent/self-heal</b><br/>old_spec_id + new_spec_id + operation_id]
    B --> C[Validate inputs<br/>old != new, both exist]
    C --> D[<b>agent.py run_self_heal</b>]

    D --> E[Step 1: Fetch old schema<br/><b>get_endpoint op, old_spec_id</b>]
    E --> F[Step 2: Compute diffs<br/><b>diff_specs old_spec_id, new_spec_id</b>]
    F --> G[Filter to operation breaking diffs]

    G --> H[Step 3: Build before_payload<br/><b>_build_before_payload old_detail</b><br/>Fill required fields from old schema<br/>Use first enum value<br/>Type-aware defaults]
    H --> I[Validate before_payload<br/>against NEW spec<br/><b>validate_request op, payload, new_spec_id</b>]
    I --> J[Expected: INVALID<br/>Missing new required fields<br/>Old enum values rejected]

    J --> K[Step 4: Claude Self-Heal Loop<br/><b>SELF_HEAL_MAX_REVISIONS = 3</b>]

    K --> L[Build prompt with:<br/>NEW spec_id<br/>OLD payload invalid<br/>Breaking changes summary<br/>Instructions to use tools]

    L --> M{Claude Response}
    M -- tool_use --> N[Dispatch: spec_get_endpoint<br/>or spec_validate_request]
    N --> O[Append results to conversation]
    O --> M

    M -- end_turn --> P[Extract payload JSON<br/>Strip markdown fences]
    P --> Q[Final validation<br/><b>validate_request op, extracted, new_spec_id</b>]
    Q --> R{Valid?}
    R -- Yes --> S[after_payload confirmed]
    R -- No --> T[Feed errors back to Claude<br/>Fix these errors...]
    T --> M

    S --> U[Step 5: Build migration_steps<br/><b>_build_migration_steps breaking_diffs</b>]
    U --> V[Return SelfHealResponse<br/>before_payload + before_validation<br/>after_payload + after_validation<br/>migration_steps]

    style D fill:#4f46e5,color:#fff
    style K fill:#d97706,color:#fff
    style S fill:#0f766e,color:#fff
```

### Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as MigrationPanel
    participant API as POST /api/agent/self-heal
    participant HEAL as agent.py run_self_heal
    participant GET as spec_get_endpoint
    participant DIFF as diff_specs
    participant VAL as spec_validate_request
    participant CLAUDE as Claude API
    participant DB as PostgreSQL
    participant AUDIT as audit_logs

    User->>FE: Click Generate Migration Plan<br/>operation: createAccount
    FE->>API: POST {old_spec_id: 1, new_spec_id: 2, operation_id: createAccount}
    API->>API: Validate: old != new, both specs exist
    API->>HEAL: run_self_heal(old_spec_id=1, new_spec_id=2, op=createAccount)

    rect rgb(255, 235, 235)
        Note over HEAL: Step 1 — Fetch old schema
        HEAL->>GET: get_endpoint(createAccount, spec_id=1)
        GET->>DB: SELECT schema_json FROM endpoints
        GET->>AUDIT: log
        GET-->>HEAL: EndpointDetail (old schema)
    end

    rect rgb(255, 248, 220)
        Note over HEAL: Step 2 — Compute breaking diffs
        HEAL->>DIFF: diff_specs(old_spec_id=1, new_spec_id=2)
        DIFF->>DB: Fetch endpoints for both specs
        DIFF->>DIFF: Compare requestBody schemas:<br/>REQUIRED_ADDED: companyRegistrationNumber<br/>ENUM_CHANGED: accountType (deposit removed, corporate added)<br/>FIELD_ADDED: kycStatus (optional)
        DIFF->>AUDIT: log
        DIFF-->>HEAL: list of DiffItem
        HEAL->>HEAL: Filter to createAccount breaking diffs
    end

    rect rgb(255, 220, 220)
        Note over HEAL: Step 3 — Build before_payload (intentionally INVALID for v2)
        HEAL->>HEAL: _build_before_payload(old_detail):<br/>{accountName: Example Account Name,<br/> accountType: savings}<br/>Missing companyRegistrationNumber<br/>savings may not match new enum
        HEAL->>VAL: validate_request(createAccount, before_payload, new_spec_id=2)
        VAL->>DB: Fetch new requestBodySchema
        VAL->>VAL: jsonschema validate -> FAILS
        VAL->>AUDIT: log
        VAL-->>HEAL: {valid: false, errors: [{field: companyRegistrationNumber, ...}]}
    end

    rect rgb(220, 237, 255)
        Note over HEAL: Step 4 — Claude self-heal loop (max 3 revisions)
        HEAL->>CLAUDE: System: SELF_HEAL_SYSTEM_PROMPT<br/>User: Generate migration payload...<br/>Breaking changes: REQUIRED_ADDED on companyRegistrationNumber...<br/>Tools: [spec_get_endpoint, spec_validate_request]

        CLAUDE-->>HEAL: tool_use: spec_get_endpoint(createAccount, spec_id=2)
        HEAL->>GET: get_endpoint(createAccount, spec_id=2)
        GET-->>HEAL: EndpointDetail (new schema with companyRegistrationNumber)
        HEAL->>CLAUDE: tool_result: schema with new required fields

        CLAUDE-->>HEAL: tool_use: spec_validate_request(createAccount,<br/>{accountName: Acme Corp, accountType: corporate,<br/> companyRegistrationNumber: BC-1234567}, spec_id=2)
        HEAL->>VAL: validate_request(...)
        VAL-->>HEAL: {valid: true, errors: []}
        HEAL->>CLAUDE: tool_result: valid true

        CLAUDE-->>HEAL: end_turn: {payload: {accountName: Acme Corp, ...}}
        HEAL->>HEAL: Extract JSON, strip markdown fences
        HEAL->>VAL: Final validation (source of truth)
        VAL-->>HEAL: valid: true
    end

    rect rgb(220, 255, 220)
        Note over HEAL: Step 5 — Build migration steps
        HEAL->>HEAL: _build_migration_steps(breaking_diffs):<br/>1. Add required field companyRegistrationNumber...<br/>2. Update accountType: old [savings, checking, deposit]<br/>   to new [savings, checking, corporate]...
    end

    HEAL->>AUDIT: log run_self_heal (before_valid, after_valid, steps_count)
    HEAL-->>API: {before_payload, before_validation,<br/> after_payload, after_validation, migration_steps}
    API-->>FE: SelfHealResponse
    FE-->>User: Render:<br/>Before payload (invalid — red bg)<br/>After payload (valid — green bg)<br/>Step-by-step migration instructions
```

### Code Walkthrough — Key Mechanics

#### `_build_before_payload(old_detail)` — Intentional Invalidity
Constructs a payload that is **valid for the old spec but will FAIL against the new spec**:
- Fills only the old `required` fields.
- For enum fields, uses the **first** enum value (e.g. `"savings"`) — which may have been removed in v2.
- The contrast between red (before) and green (after) in the UI makes breaking changes viscerally obvious.

#### Claude Self-Heal Loop — Constrained Generation
- **Separate system prompt** (`SELF_HEAL_SYSTEM_PROMPT`): Instructs Claude to ONLY return `{"payload": {...}}` — no prose, no markdown.
- **Reduced tool set** (`SELF_HEAL_TOOLS`): Only `spec_get_endpoint` + `spec_validate_request`. No search tool — the operation is already known.
- **Max 3 revisions** (`SELF_HEAL_MAX_REVISIONS`): If Claude can't produce a valid payload in 3 tries, the system raises `RuntimeError` rather than burning tokens.
- **Double validation**: Even when Claude claims it validated via a tool call, `run_self_heal()` always does a **final validation itself** before accepting the payload.

#### `_build_migration_steps(breaking_diffs)` — Human-Readable Instructions
Maps each `DiffItem.change_type` to a natural-language migration instruction:

| Change Type | Example Step |
|---|---|
| `REQUIRED_ADDED` | "Add required field 'companyRegistrationNumber' to all requests for POST /accounts" |
| `ENUM_CHANGED` | "Update 'accountType': old [savings, checking, deposit] → new [savings, checking, corporate]" |
| `FIELD_REMOVED` | "Remove 'legacyField' from payloads — no longer exists in new spec" |
| `TYPE_CHANGED` | "Change type of 'amount' from string to number" |
| `ENDPOINT_REMOVED` | "Remove all client calls to DELETE /accounts/{id}" |

#### Diff Engine (`spec_diff.py` → `diff_specs()`)
Compares `requestBody` schemas field-by-field:
1. **REQUIRED_ADDED** — field newly appears in `required[]` → BREAKING
2. **FIELD_REMOVED** — field dropped from `properties{}` → BREAKING
3. **TYPE_CHANGED** — same field, different `type` → BREAKING
4. **ENUM_CHANGED** — values removed from `enum[]` → BREAKING; values only added → NON_BREAKING
5. **FIELD_ADDED** — new optional field → NON_BREAKING
6. **ENDPOINT_REMOVED** — entire operation gone → BREAKING

Diffs are persisted to the `diffs` table and reused by `analyze_impact()`.

#### Impact Analysis (`impact_analyze.py` → `analyze_impact()`)
- Loads `specs/dependencies.yaml` — a service dependency graph mapping `operationId` → `[{service, team, severity}]`.
- Cross-references breaking diffs with downstream consumers.
- Returns `ImpactItem` records: which services, which teams, what severity.

---

## 5. Viewpoint — Fully Automated Self-Heal Propagation

### Current State: Human-in-the-Loop

Today, the self-heal flow generates a **migration plan** (before/after payloads + instructions) and presents it for human review. The developer decides whether to apply it. This is the right default for a 48-hour build — trust must be earned.

### Vision: Closed-Loop Automated Propagation

The architecture is already designed to support full automation with minimal extension:

```mermaid
flowchart TD
    A[New Spec Version Uploaded] --> B[Auto-Diff<br/>diff_specs triggers on ingest]
    B --> C{Breaking changes?}
    C -- No --> D[Green Light<br/>No action needed]
    C -- Yes --> E[Auto Impact Analysis<br/>Load dependency graph]
    E --> F[For each affected operation:<br/><b>run_self_heal</b>]
    F --> G[Generate after_payload<br/>+ migration_steps]
    G --> H{after_payload valid?}
    H -- No --> I[Escalate to human<br/>Slack/Teams alert]
    H -- Yes --> J[Auto-Generate Code Patch<br/>AST transform or sed<br/>on consumer repos]
    J --> K[Create PR per consumer service<br/>via GitHub/GitLab API]
    K --> L[Run consumer CI tests<br/>against new spec]
    L --> M{Tests pass?}
    M -- Yes --> N[Auto-merge PR<br/>or await single approval]
    M -- No --> O[Escalate to human<br/>Attach test failure logs]

    style F fill:#4f46e5,color:#fff
    style J fill:#d97706,color:#fff
    style N fill:#0f766e,color:#fff
```

### What Needs to Be Built

| Capability | Implementation Path |
|---|---|
| **Auto-diff on ingest** | Add a post-ingest hook in `main.py`: after `bulk_insert_endpoints`, check if a previous version exists. If so, call `diff_specs()` automatically. |
| **Event bus** | Introduce a lightweight event system (even just a Postgres `LISTEN/NOTIFY` channel) to decouple ingest from diff/heal triggers. |
| **Code patch generation** | Extend Claude's self-heal prompt to output not just a JSON payload but an actual code diff (e.g., Python `requests.post()` call, Java DTO class). Use the consumer's language context from `dependencies.yaml`. |
| **PR automation** | Integrate GitHub/GitLab API: create a branch, commit the generated patch, open a PR tagged with the diff_id and audit trail link. |
| **Consumer test gate** | Trigger the consumer's CI pipeline against the PR. If tests pass, auto-merge (or require one-click approval). If tests fail, escalate with full context. |
| **Rollback safety** | Every auto-generated PR links back to the `audit_logs` entry. If a propagated change causes production issues, the audit trail provides instant root cause: which diff triggered which heal which generated which patch. |

### Key Principle: Progressive Trust

```
Level 0: Detect + Report          ← Today (diff + impact panel)
Level 1: Detect + Suggest Fix     ← Today (self-heal with human review)
Level 2: Detect + Fix + PR        ← Auto-PR with CI gate
Level 3: Detect + Fix + Merge     ← Full automation with rollback safety
```

Each level is a configuration toggle, not a code rewrite. The MCP tool layer and audit trail remain unchanged — only the **orchestration policy** changes.

---

## 6. Viewpoint — CLI & CI/CD Pipeline Integration

### The Problem

The platform currently runs as a web application. But the real value for engineering teams is **shift-left** — catching breaking changes **before** they're merged, not after they're deployed.

### Vision: `selfaware` CLI

A lightweight CLI that wraps the same backend tools, designed to run in any CI/CD pipeline:

```mermaid
flowchart LR
    A[Developer pushes<br/>spec change] --> B[CI Pipeline<br/>GitHub Actions / GitLab CI /<br/>Jenkins / Azure DevOps]
    B --> C[<b>selfaware lint</b><br/>Parse + validate spec]
    C --> D[<b>selfaware diff</b><br/>Compare against baseline]
    D --> E{Breaking changes?}
    E -- No --> F[Pipeline passes]
    E -- Yes --> G[<b>selfaware impact</b><br/>Map to downstream services]
    G --> H[<b>selfaware heal</b><br/>Generate migration plan]
    H --> I[Output: JSON report<br/>+ exit code 1]
    I --> J[Block merge<br/>until reviewed]

    style C fill:#4f46e5,color:#fff
    style D fill:#d97706,color:#fff
    style H fill:#0f766e,color:#fff
```

### Proposed CLI Commands

```bash
# Ingest a spec into the platform (or local SQLite in standalone mode)
selfaware ingest ./specs/banking-api-v2.yaml --name banking-api

# Diff against the previous version (or a specific baseline)
selfaware diff --old banking-api:v1 --new banking-api:v2 --format json
selfaware diff --old banking-api:v1 --new banking-api:v2 --format table

# Impact analysis
selfaware impact --diff-id 42 --deps ./specs/dependencies.yaml

# Generate migration plan for a specific operation
selfaware heal --old banking-api:v1 --new banking-api:v2 --operation createAccount

# Full pipeline check (ingest + diff + impact + heal — single command)
selfaware check ./specs/banking-api-v2.yaml \
    --baseline banking-api:v1 \
    --deps ./specs/dependencies.yaml \
    --fail-on-breaking \
    --output report.json
```

### CI/CD Integration Examples

#### GitHub Actions

```yaml
name: API Spec Check
on:
  pull_request:
    paths: ['specs/**']

jobs:
  spec-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install selfaware CLI
        run: uv pip install selfaware-cli

      - name: Check for breaking changes
        run: |
          selfaware check specs/banking-api-v2.yaml \
            --baseline banking-api:v1 \
            --deps specs/dependencies.yaml \
            --fail-on-breaking \
            --output spec-report.json

      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const report = require('./spec-report.json');
            const body = `## Breaking API Changes Detected
            
            **${report.breaking_count} breaking changes** found.
            
            ### Affected Services
            ${report.impacts.map(i =>
              `- **${i.affected_service}** (${i.team}) — ${i.severity}`
            ).join('\n')}
            
            ### Migration Plan
            ${report.migration_steps.map((s, i) =>
              `${i+1}. ${s}`
            ).join('\n')}
            
            > Auto-generated by Self-Aware API Platform`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

#### GitLab CI

```yaml
spec-check:
  stage: validate
  image: python:3.12
  rules:
    - changes: ['specs/**']
  script:
    - uv pip install selfaware-cli
    - selfaware check specs/banking-api-v2.yaml
        --baseline banking-api:v1
        --fail-on-breaking
        --output report.json
  artifacts:
    reports:
      dotenv: spec-report.env
    paths:
      - report.json
    when: always
```

### Architecture for CLI Mode

The CLI reuses the **exact same tool layer** — no code duplication:

```mermaid
graph TB
    subgraph "CLI Mode"
        CLI[selfaware CLI<br/>Click / Typer]
        LOCAL_DB[(SQLite + sqlite-vss<br/>for standalone mode)]
    end

    subgraph "Server Mode — existing"
        API[FastAPI Routes]
        PG[(PostgreSQL + pgvector)]
    end

    subgraph "Shared Core — Zero Duplication"
        TOOLS[MCP Tool Layer<br/>search · get · validate · diff · impact]
        INGEST[Ingestion Pipeline<br/>normalize · chunk · embed]
        AGENT[Agent Orchestrator<br/>Claude tool_use loop]
    end

    CLI --> TOOLS
    CLI --> INGEST
    CLI --> AGENT
    CLI --> LOCAL_DB

    API --> TOOLS
    API --> INGEST
    API --> AGENT
    API --> PG

    style TOOLS fill:#4f46e5,color:#fff
    style INGEST fill:#4f46e5,color:#fff
    style AGENT fill:#4f46e5,color:#fff
```

### Implementation Path

| Phase | Scope | Effort |
|---|---|---|
| **Phase 1** — CLI wrapper | Wrap existing tools in a Click/Typer CLI. Use same Postgres backend. | ~2 days |
| **Phase 2** — Standalone mode | Add SQLite + `sqlite-vss` as an alternative storage backend. Allow CLI to run without a Postgres server. | ~3 days |
| **Phase 3** — CI/CD actions | Publish as a GitHub Action / GitLab CI template. Add `--fail-on-breaking` exit codes, JSON/SARIF output formats. | ~2 days |
| **Phase 4** — Spec registry | Central spec registry that CI pipelines push to. Automatic baseline tracking. Webhook notifications on breaking changes. | ~1-2 weeks |

### Why This Matters

The platform's value multiplies when it becomes part of the **daily development routine**:

- **Shift left**: Breaking changes caught at PR time, not in production at 3 AM.
- **Zero friction**: Developers don't need to open a web UI — the check runs automatically.
- **Audit trail**: Every CI run logs the same `audit_logs` entries as the web UI — single source of truth.
- **Progressive adoption**: Start with `selfaware diff` as a non-blocking check. Graduate to `--fail-on-breaking` when trust is established. Eventually enable auto-heal PR generation.

The tool-first architecture makes this transition seamless. The MCP tools don't care whether they're called by a React frontend, a CLI, or a GitHub Action — the contracts, validation, and audit trail are identical.

---

*Document generated from the actual codebase of the Self-Aware API Platform.*
*Every code reference, function name, and data flow described here maps directly to the implemented source.*
