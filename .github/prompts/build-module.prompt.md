---
name: build-module
description: Generate a complete, runnable module for the Self-Aware API Platform. Provide the module name and it produces a full implementation with no placeholders.
agent: API Platform Builder
tools: ['edit/editFiles', 'search/codebase', 'execute/getTerminalOutput', 'execute/runInTerminal', 'read/terminalLastCommand', 'read/terminalSelection', 'read/problems']
argument-hint: 'Which module? e.g. tools/spec_search.py, ingestion/normalizer.py, agent.py'
---

Build the module: **${input:module:Which module to build? e.g. tools/spec_search.py}**

## Before writing any code
1. Read `CLAUDE.md` — confirm this module is not already ticked as complete
2. Check the file does not already exist with content at the correct path
3. Identify which imports this module depends on (are they complete yet?)

## Requirements for this module
Produce a **complete, runnable implementation** — no `# TODO`, no stubs, no placeholders.

Follow these constraints exactly:
- Python 3.12.12, Pydantic v2, async FastAPI patterns, raw psycopg2
- Voyage AI `voyage-3` for embeddings (dim=1024)
- Anthropic `claude-sonnet-4-20250514` for LLM calls
- pgvector `<=>` operator with `::vector` cast
- All config from `.env` via `python-dotenv`
- `logging` module only — no `print()`
- Type hints on every function signature
- Audit log every MCP tool call to `audit_logs` table

## Module-specific context

### If building a tool (tools/*.py)
Use this canonical pattern:
```python
async def tool_name(param: type, ...) -> ReturnModel:
    start = time.time()
    try:
        # implementation
        result = ...
        log_tool_call(conn, "tool_name", {"param": param}, result.dict(), duration_ms=...)
        return result
    except Exception as e:
        logger.error(f"tool_name failed: {e}")
        raise
```

### If building ingestion (ingestion/*.py)
- normalizer.py: use `prance.ResolvingParser` for $ref resolution
- embedder.py: batch texts in groups of 50 before calling Voyage AI
- chunker.py: combine method + path + summary + tags into embedding text

### If building storage (storage/*.py)
- schema_store.py: CRUD ops for `specs` and `endpoints` tables
- vector_store.py: cosine similarity search using `<=> %s::vector`
- Always use parameterised `%s` queries — never f-string SQL

### If building agent.py
- Max 10 iterations guard
- System prompt must include: provenance instruction + sandbox notice
- Tool definitions must match MCP tool signatures exactly
- Append tool results as `tool_result` blocks before next turn

### If building a React component (frontend/src/components/*.jsx)
- Functional component with hooks only
- axios for all HTTP calls (no fetch)
- Tailwind utility classes only
- Show loading state while waiting for API
- Show error state if API fails

## After writing the code
1. Run the file with `#tool:execute/runInTerminal` and `#tool:execute/getTerminalOutput` to confirm it imports cleanly:
   ```bash
   cd ~/self-aware-api-platform/backend && source .venv/bin/activate && python -c "import [module]"
   ```
2. List any new `.env` keys this module requires
3. Tick the completed checkbox in `CLAUDE.md` build progress tracker
4. State clearly: "Ready to integrate — next dependency is [module]"