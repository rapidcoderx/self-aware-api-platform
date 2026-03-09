# Self-Aware API Platform — UI Guide

> Open the app at **http://localhost:5173** with the backend running on **http://localhost:8000**.

---

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER — spec selector | compare controls | Audit Log button | SANDBOX badge│
│  SPEC UPLOADER — drag-drop zone (always visible in header)                  │
├─────────────────────────────────────┬───────────────────────────────────────┤
│                                     │  RIGHT PANEL                          │
│  LEFT PANEL — CHAT                  │  (switches based on context)          │
│                                     │  • Endpoint Details + Validation      │
│  Type a question, see tool calls,   │    (after any chat message)           │
│  read the answer with provenance    │  • Diff + Impact + Migration          │
│  badge.                             │    (after Compare is clicked)         │
│                                     │                                       │
│                                     ├───────────────────────────────────────┤
│                                     │  RESPONSIBLE AI PANEL (bottom strip)  │
└─────────────────────────────────────┴───────────────────────────────────────┘
```

---

## Header Controls

| Control | What it does |
|---|---|
| **Spec dropdown** (left of "vs") | Select the active spec the agent queries against. All chat messages use this spec. |
| **"vs" dropdown** (right of "vs") | Select a second spec to compare against. Only appears when 2+ specs are ingested. |
| **Compare button** | Runs `POST /api/specs/compare`, populates DiffPanel + ImpactPanel + MigrationPanel in the right column. |
| **Audit Log button** | Opens a modal showing the last 20 MCP tool calls with inputs, outputs, and duration. |
| **SANDBOX badge** | Confirms all API calls route to the Prism mock (port 4010), not production. Always amber during development. |

---

## Spec Uploader (in header)

1. **Drag and drop** a `.yaml`, `.yml`, or `.json` OpenAPI spec onto the dashed zone — or click it to open a file picker.
2. The file is parsed and ingested server-side (normalise → chunk → embed → store).
3. On success, a green badge appears: **`BankingAPI v2  ✓ ingested`**.
4. The spec dropdown auto-updates — the newly uploaded spec is auto-selected.
5. Accepted formats: `.yaml`, `.yml`, `.json`. Other file types are rejected client-side with an error message.
6. If the same spec name already exists, the version is **auto-incremented** (never overwrites).

---

## Demo Flow 1 — Discover & Validate

**Goal:** Ask a question about an API endpoint and get a schema-validated answer.

### Steps

1. Select **BankingAPI v1** in the left spec dropdown.
2. In the chat box, type:
   ```
   How do I create a bank account?
   ```
3. Press **Enter** or click Send.

### What happens

- The agent calls 3 MCP tools in sequence:
  - `spec_search` — finds the most relevant endpoint by semantic similarity
  - `spec_get_endpoint` — fetches the full schema for that endpoint
  - `spec_validate_request` — validates an example payload against the schema
- The chat panel shows **collapsible tool chips** (blue dots, one per tool call):
  - Click any chip to expand it and see the exact inputs and result summary.
- Below the chips, the **answer text** appears with the endpoint details.
- A purple **provenance badge** shows: `BankingAPI v1 · createAccount`
- The **right panel** switches to **Endpoint Details**:
  - Method badge (blue `POST`) + path `/accounts`
  - Spec version `v1`
  - Green **Valid ✓** badge — the example payload passed schema validation

---

## Demo Flow 2 — Breaking Change Detection

**Goal:** Upload v2, compare with v1, and see the 2 breaking changes surfaced.

### Steps

1. Drag `specs/banking-api-v2.yaml` onto the uploader zone.
2. Wait for the green **`BankingAPI v2  ✓ ingested`** badge.
3. In the **left dropdown**, keep **BankingAPI v1** selected.
4. In the **"vs" dropdown**, select **BankingAPI v2**.
5. Click **Compare**.

### What happens

The right panel switches to the **Diff + Impact + Migration** view:

**DiffPanel** (top of right column):
- 🔴 `companyRegistrationNumber` — **BREAKING** — Required Added
- 🔴 `accountType` — **BREAKING** — Enum Changed (removed `deposit`)
- 🟡 `kycStatus` — **NON-BREAKING** — Field Added
- Summary bar: `2 breaking · 1 non-breaking · 3 services affected`
- Click any row to expand it and see old value → new value.

**ImpactPanel** (below DiffPanel):
- Three downstream services all show **HIGH** severity (red badge):
  - `onboarding-service` — Platform Team
  - `crm-integration` — CRM Team
  - `mobile-app-backend` — Mobile Team

---

## Demo Flow 3 — Self-Healing Migration

**Goal:** Generate a before/after migration plan that produces a valid v2 payload.

### Prerequisite
Complete Demo Flow 2 first (DiffPanel must be visible).

### Steps

1. Scroll down in the right column to **MigrationPanel**.
2. The first breaking operation (`createAccount`) is pre-selected.
3. Click **Generate Migration Plan**.
4. Wait 15–45 seconds (live Anthropic API call).

### What happens

**Before payload** (red box):
```json
{
  "accountName": "Acme Corp",
  "accountType": "deposit"
}
```
- Red **2 errors** badge
- Error list: `accountType` invalid enum value, `companyRegistrationNumber` is required

**After payload** (green box):
```json
{
  "accountName": "Acme Corp",
  "accountType": "current",
  "companyRegistrationNumber": "BC-1234567"
}
```
- Green **✓ Valid** badge — passed schema validation against v2

**Migration steps** (numbered list below):
1. Add required field: `companyRegistrationNumber`
2. Change `accountType` from `deposit` → `current` (enum restricted in v2)

### Export and Apply buttons

| Button | Action |
|---|---|
| **Export as JSON** | Downloads `migration-plan.json` with before, after, steps, and validation results |
| **Apply Migration** | Opens a confirmation dialog with a SANDBOX notice — no auto-apply ever happens |
| **Reset** | Clears the result and re-enables the Generate button to regenerate |

---

## Audit Log Modal

Click **Audit Log** in the header at any time.

- Shows the last 20 MCP tool calls in a table:

| Column | Content |
|---|---|
| Tool | `spec_search`, `spec_get_endpoint`, `spec_validate_request`, `spec_diff`, `impact_analyze`, `run_self_heal` |
| Inputs | Sanitised summary (no raw payloads, no API keys) |
| Duration | Milliseconds — useful to spot slow embedding calls |
| Timestamp | UTC, ISO 8601 |

- After a full demo run, all tool calls from all 3 flows appear here in sequence.
- Click **×** or press **Escape** to close.

---

## Responsible AI Panel (bottom strip)

Always visible at the bottom of the right column. Click the strip to expand/collapse.

| Guardrail | When it turns green |
|---|---|
| ✅ Sandbox Mode Active | Always — reads `environment` from `/health` |
| ✅ Schema Validation Enforced | Once any spec is selected (spec_id is not null) |
| ✅ Provenance on Every Answer | After the first chat message returns a provenance badge |
| ✅ Human-in-the-Loop for Migration | Always — hardcoded, no auto-apply exists |
| ✅ Audit Log Active | On load — checks that `audit_logs` has at least 1 entry |
| ✅ Breaking Changes Explained | After Compare runs and diffData is populated |

All 6 are green once you have completed Demo Flows 1 and 2.

---

## Switching Between Views

The right panel **automatically switches** based on your last action:

| Last action | Right panel shows |
|---|---|
| App just loaded | "Ask a question to get started" placeholder |
| Chat message sent | Endpoint Details + Validation |
| Compare button clicked | Diff + Impact + Migration |
| Chat message sent again (after compare) | Switches back to Endpoint Details + Validation |
| DiffPanel × close button clicked | Switches back to Endpoint Details / placeholder |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send chat message |
| `Shift+Enter` | New line in chat input (does not send) |
| `Escape` | Close Audit Log modal |

---

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Chat sends but right panel stays empty | No `endpoint` in agent response — question did not match an endpoint | Ask about a specific operation: *"How do I create an account?"* |
| Compare button is greyed out | `compareSpecId` is null — "vs" dropdown is blank | Select a second spec in the "vs" dropdown |
| Compare button is greyed out even after selecting | Both dropdowns have the same spec selected | Select different spec versions in each dropdown |
| Responsible AI panel shows 4/6 | Provenance and Breaking Changes guardrails are not yet active | Send a chat message (→ #3 green), then run Compare (→ #6 green) |
| Upload fails with "Only .yaml, .yml, or .json files" | Wrong file type | Use the YAML files from the `specs/` folder |
| Self-heal shows "Service temporarily unavailable" | Anthropic API rate limit or network error | Wait 30 seconds and click Reset → Generate again |
