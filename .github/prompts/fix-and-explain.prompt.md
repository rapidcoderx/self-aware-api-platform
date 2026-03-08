---
name: fix-and-explain
description: Debug an error in the Self-Aware API Platform. Paste the error and get a root cause diagnosis, minimal fix, and a plain-English explanation of what went wrong.
agent: API Platform Debugger
tools: ['search/codebase', 'execute/getTerminalOutput', 'execute/runInTerminal', 'read/terminalLastCommand', 'read/terminalSelection', 'read/terminalLastCommand', 'read/problems', 'search']
argument-hint: 'Paste the error message or describe what broke'
---

Debug this error: **${input:error:Paste the error message or describe what broke}**

## Diagnosis approach

### 1. Read the full error
- Identify: error type, file, line number
- Classify: import error / runtime error / config error / DB error / API error

### 2. Check known failure patterns for this project

**Python import errors** → check venv is activated, package is installed
```bash
which python          # must show .venv/bin/python
uv pip show <package> # verify installed
```

**psycopg2 / DB errors** → check Postgres is running and DB exists
```bash
pg_isready
psql -lqt | grep selfaware_api
```

**pgvector dimension mismatch** → verify embedding dim is 1024
```bash
python3 -c "import voyageai, os; from dotenv import load_dotenv; load_dotenv(); c = voyageai.Client(api_key=os.getenv('VOYAGE_API_KEY')); r = c.embed(['test'], model='voyage-3'); print('dim:', len(r.embeddings[0]))"
```

**Claude tool_use loop not terminating** → check stop_reason handling and MAX_ITERATIONS guard

**MCP server not starting** → run directly to see error
```bash
cd ~/self-aware-api-platform/backend && source .venv/bin/activate && python mcp_server.py
```

**FastAPI 422** → check request body matches Pydantic model

**CORS error** → check CORSMiddleware allows `http://localhost:5173`

**Prism mock errors** → check YAML has no duplicate path keys

### 3. Run targeted verification
Use `#tool:execute/runInTerminal` and `#tool:execute/getTerminalOutput` to confirm the diagnosis before prescribing a fix.

### 4. Prescribe the minimal fix
The smallest possible change that resolves the issue.
Do not refactor working code to fix a localised problem.

---

## Output format

```
## Debug Report

### Error
[exact error message]

### Root Cause
[one sentence — what actually went wrong]

### Why it happened
[plain English — 2–3 sentences explaining the underlying cause]

### Minimal fix
[code change or command — as small as possible]

### Verify with
[command to confirm it's fixed]

### Does this affect anything else?
[yes/no — if yes, what]
```