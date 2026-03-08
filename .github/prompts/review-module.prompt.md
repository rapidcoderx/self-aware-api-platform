---
name: review-module
description: Review a completed module against CLAUDE.md constraints. Checks stack compliance, error handling, security, audit logging, and demo readiness.
agent: API Platform Reviewer
tools: ['codebase', 'search', 'problems']
argument-hint: 'Which file to review? e.g. backend/tools/spec_diff.py'
---

Review this file: **${input:file:Which file to review? e.g. backend/tools/spec_diff.py}**

Read the file and run it through the following checklist.
Report every issue with: **file path**, **line number**, **severity**, and **fix instruction**.

---

## Severity levels
- 🔴 **BLOCKER** — must fix before demo. Breaks functionality or violates core constraint.
- 🟡 **WARNING** — fix if time allows. Degrades quality but won't break demo.
- 🔵 **STYLE** — optional improvement.

---

## Checklist

### Stack compliance (🔴 BLOCKER if violated)
- [ ] No LangChain, LangGraph, CrewAI, AutoGen imports
- [ ] No OpenAI imports — only `anthropic`
- [ ] No Chroma, Pinecone, Weaviate — only `pgvector`
- [ ] No SQLAlchemy — raw `psycopg2` only
- [ ] Type hints on every function signature
- [ ] Pydantic v2 syntax (not v1 `class Config`)
- [ ] All FastAPI route handlers are `async def`
- [ ] Model is `claude-sonnet-4-20250514` (not any other model string)

### Security (🔴 BLOCKER if violated)
- [ ] No hardcoded API keys, passwords, or DB connection strings
- [ ] All config loaded via `python-dotenv` `os.getenv()`
- [ ] All SQL uses parameterised `%s` — no f-strings in queries
- [ ] No raw API keys or secrets in audit log entries
- [ ] `.env` in `.gitignore`

### Error handling (🟡 WARNING if missing)
- [ ] DB operations wrapped in try/except
- [ ] API failures (Voyage AI, Anthropic) handled gracefully
- [ ] HTTP routes return correct status codes (404, 422, 503)
- [ ] Agent loop has MAX_ITERATIONS guard (≤ 10)

### Audit logging (🟡 WARNING if missing)
- [ ] Every MCP tool call writes to `audit_logs` table
- [ ] Log includes: tool_name, inputs, outputs, spec_id, duration_ms
- [ ] Sensitive data redacted before logging

### MCP tool signatures (🔴 BLOCKER if wrong)
If this is a tool file, verify signature matches exactly:
```
search_endpoints(query: str, spec_id: int, limit: int = 5) -> list[EndpointSummary]
get_endpoint(operation_id: str, spec_id: int) -> EndpointDetail
validate_request(operation_id: str, payload: dict, spec_id: int) -> ValidationResult
diff_specs(old_spec_id: int, new_spec_id: int) -> list[DiffItem]
analyze_impact(diff_id: int) -> list[ImpactItem]
```

### pgvector pattern (🟡 WARNING if wrong)
```python
# Must use ::vector cast and <=> operator — no other pattern
embedding <=> %s::vector
```

### Demo readiness (🔴 BLOCKER for demo path)
- [ ] `spec_search` returns `score` field for provenance
- [ ] `spec_get` returns `spec_version` in response
- [ ] `spec_validate` returns field-level `errors` list (not just bool)
- [ ] `spec_diff` classifies each change as `BREAKING` or `NON_BREAKING`
- [ ] Agent responses include operationId and spec version

---

## Output format

```
## Review — [filename] — ${input:file}

### 🔴 BLOCKERS (fix before demo)
[list or "None"]

### 🟡 WARNINGS (fix if time allows)
[list or "None"]

### 🔵 STYLE (optional)
[list or "None"]

### Summary
X blockers · Y warnings · Z style issues
Demo path: SAFE / AT RISK / BLOCKED
Recommendation: [pass to Builder / fix now / good to ship]
```