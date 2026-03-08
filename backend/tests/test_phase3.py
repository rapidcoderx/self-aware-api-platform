#!/usr/bin/env python3
"""
Phase 3 exit gate tests — MCP server + Agent + Chat route.

Usage:
    cd /Users/sathishkr/self-aware-api-platform/backend
    .venv/bin/python tests/test_phase3.py

Requires Phase 1+2 complete (spec ingested, tools working).
Sections A-C run without a server. Section D requires the server on port 8000.
All checks must PASS before starting Phase 4 (frontend UI).
"""

import asyncio
import inspect
import json
import logging
import os
import sys
import urllib.error
import urllib.request
import warnings

# ── Path / env setup ──────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(BACKEND_DIR, ".env"))
warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"

passed = 0
failed = 0


def check(name: str, result: bool, detail: str = "") -> None:
    global passed, failed
    if result:
        passed += 1
        print(f"{GREEN}✅ PASS{RESET}  {name}" + (f"  [{detail}]" if detail else ""))
    else:
        failed += 1
        print(f"{RED}❌ FAIL{RESET}  {name}" + (f"  [{detail}]" if detail else ""))


# ── Resolve spec_id from DB ────────────────────────────────────────────────────
spec_id = None
try:
    from storage.schema_store import get_db

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT MAX(id) FROM specs")
        row = cur.fetchone()
        spec_id = row[0] if row and row[0] else None

    if spec_id is None:
        print(f"{RED}No spec found in DB. Run Phase 1 ingest first.{RESET}")
        sys.exit(1)
    print(f"Using spec_id={spec_id} (auto-detected from DB)\n")
except Exception as exc:
    print(f"{RED}Cannot connect to DB: {exc}{RESET}")
    sys.exit(1)


# ═════════════════════════════════════════════════════════════════════════════
# SECTION A — mcp_server.py static checks
# ═════════════════════════════════════════════════════════════════════════════
print(f"{BOLD}── A. mcp_server.py — static checks ───────────────────────{RESET}")

try:
    import mcp_server  # noqa: F401

    check("mcp_server.py imports cleanly", True)
except Exception as exc:
    check("mcp_server.py imports cleanly", False, str(exc))

try:
    src = inspect.getsource(mcp_server)
    check("Source contains 'spec_search'", "spec_search" in src)
    check("Source contains 'spec_get_endpoint'", "spec_get_endpoint" in src)
    check("Source contains 'spec_validate_request'", "spec_validate_request" in src)
    check("Source uses stdio_server", "stdio_server" in src)
    check("Source uses Server pattern", "Server(" in src)
    check("list_tools handler present", "list_tools" in src)
    check("call_tool handler present", "call_tool" in src)
except Exception as exc:
    check("mcp_server source inspection", False, str(exc))

try:
    tools = mcp_server.TOOLS
    check("TOOLS is a non-empty list", isinstance(tools, list) and len(tools) > 0, f"len={len(tools)}")
    tool_names = [t.name for t in tools]
    check("TOOLS contains spec_search", "spec_search" in tool_names)
    check("TOOLS contains spec_get_endpoint", "spec_get_endpoint" in tool_names)
    check("TOOLS contains spec_validate_request", "spec_validate_request" in tool_names)
except Exception as exc:
    check("TOOLS list inspection", False, str(exc))


# ═════════════════════════════════════════════════════════════════════════════
# SECTION B — agent.py unit checks (no network calls)
# ═════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── B. agent.py — unit checks ──────────────────────────────{RESET}")

try:
    import agent  # noqa: F401

    check("agent.py imports cleanly", True)
except Exception as exc:
    check("agent.py imports cleanly", False, str(exc))

try:
    src = inspect.getsource(agent)
    check("MAX_ITERATIONS = 10 in source", "MAX_ITERATIONS = 10" in src)
    check("RuntimeError raised on max iterations", "raise RuntimeError" in src)
    check("SYSTEM_PROMPT contains 'provenance'", "provenance" in src.lower())
    check("SYSTEM_PROMPT contains 'sandbox'", "sandbox" in src.lower())
except Exception as exc:
    check("agent.py source inspection", False, str(exc))

try:
    check("AgentResponse class exists", hasattr(agent, "AgentResponse"))
    check("ProvenanceInfo class exists", hasattr(agent, "ProvenanceInfo"))
    check("ToolCallRecord class exists", hasattr(agent, "ToolCallRecord"))
except Exception as exc:
    check("agent.py Pydantic models", False, str(exc))

try:
    sig = inspect.signature(agent.run_agent)
    params = list(sig.parameters.keys())
    check(
        "run_agent signature has user_message and spec_id",
        "user_message" in params and "spec_id" in params,
        f"params={params}",
    )
except Exception as exc:
    check("run_agent signature", False, str(exc))

try:
    defs = agent.TOOL_DEFINITIONS
    check(
        "TOOL_DEFINITIONS is non-empty list",
        isinstance(defs, list) and len(defs) >= 3,
        f"len={len(defs)}",
    )
    tool_names = [d["name"] for d in defs]
    check("TOOL_DEFINITIONS has spec_search", "spec_search" in tool_names)
    check("TOOL_DEFINITIONS has spec_get_endpoint", "spec_get_endpoint" in tool_names)
    check("TOOL_DEFINITIONS has spec_validate_request", "spec_validate_request" in tool_names)
    for d in defs:
        has_schema = "input_schema" in d and isinstance(d["input_schema"], dict)
        check(f"  {d['name']} has input_schema", has_schema)
except Exception as exc:
    check("TOOL_DEFINITIONS inspection", False, str(exc))


# ═════════════════════════════════════════════════════════════════════════════
# SECTION C — agent.py live call (calls Claude API + tools)
# ═════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── C. agent.py — live agent call ──────────────────────────{RESET}")

logging.disable(logging.NOTSET)
logging.basicConfig(level=logging.WARNING, force=True)

agent_result = None
try:
    agent_result = asyncio.run(
        agent.run_agent(
            "How do I create a corporate deposit account?",
            spec_id=spec_id,
        )
    )
    check("run_agent returns AgentResponse", isinstance(agent_result, agent.AgentResponse))
except Exception as exc:
    check("run_agent executes without error", False, str(exc))

logging.disable(logging.CRITICAL)

if agent_result is not None:
    check("answer is non-empty", bool(agent_result.answer), f"len={len(agent_result.answer)}")
    check(
        "answer mentions createAccount or /accounts",
        "createAccount" in agent_result.answer or "/accounts" in agent_result.answer,
        f"answer preview: {agent_result.answer[:100]}",
    )
    check("provenance is not None", agent_result.provenance is not None)
    if agent_result.provenance:
        check(
            "provenance.operation_id == 'createAccount'",
            agent_result.provenance.operation_id == "createAccount",
            f"got {agent_result.provenance.operation_id}",
        )
        check(
            "provenance.spec_version >= 1",
            agent_result.provenance.spec_version >= 1,
            f"got v{agent_result.provenance.spec_version}",
        )
        check(
            "provenance.spec_name is non-empty",
            bool(agent_result.provenance.spec_name),
            f"got '{agent_result.provenance.spec_name}'",
        )

    tc_names = [tc.tool_name for tc in agent_result.tool_calls]
    check(
        "tool_calls has >= 2 entries",
        len(agent_result.tool_calls) >= 2,
        f"got {len(agent_result.tool_calls)}",
    )
    check(
        "tool_calls includes search_endpoints or spec_search",
        "search_endpoints" in tc_names or "spec_search" in tc_names,
        f"names={tc_names}",
    )
    check(
        "tool_calls includes get_endpoint or spec_get_endpoint",
        "get_endpoint" in tc_names or "spec_get_endpoint" in tc_names,
        f"names={tc_names}",
    )
    check(
        "tool_calls includes validate_request or spec_validate_request",
        "validate_request" in tc_names or "spec_validate_request" in tc_names,
        f"names={tc_names}",
    )
else:
    for _ in range(9):
        check("(skipped — agent call failed)", False)


# ═════════════════════════════════════════════════════════════════════════════
# SECTION D — /api/chat HTTP route (server must be on port 8000)
# ═════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── D. /api/chat HTTP checks ───────────────────────────────{RESET}")

server_ok = False
try:
    req = urllib.request.Request("http://localhost:8000/health")
    with urllib.request.urlopen(req, timeout=3) as resp:
        server_ok = resp.status == 200
except Exception:
    pass

if not server_ok:
    print(f"{YELLOW}⚠ Server not running on port 8000 — skipping HTTP checks.{RESET}")
    print(f"{YELLOW}  Start with: .venv/bin/uvicorn main:app --port 8000{RESET}")
else:
    try:
        payload = json.dumps({
            "message": "How do I create a corporate deposit account?",
            "spec_id": spec_id,
        }).encode()
        req = urllib.request.Request(
            "http://localhost:8000/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            check("POST /api/chat returns 200", resp.status == 200, f"status={resp.status}")
            body = json.loads(resp.read())

        check("Response has 'answer' key (non-empty)", bool(body.get("answer")))
        check(
            "Response has 'tool_calls' (list, >= 2)",
            isinstance(body.get("tool_calls"), list) and len(body["tool_calls"]) >= 2,
            f"len={len(body.get('tool_calls', []))}",
        )
        check("Response has 'provenance' (not null)", body.get("provenance") is not None)
        check("Response has 'spec_id'", "spec_id" in body, f"spec_id={body.get('spec_id')}")

        prov = body.get("provenance", {})
        if prov:
            check(
                "provenance.operation_id == 'createAccount'",
                prov.get("operation_id") == "createAccount",
                f"got {prov.get('operation_id')}",
            )
    except Exception as exc:
        check("POST /api/chat", False, str(exc))

    # Test 404 for non-existent spec
    try:
        payload_404 = json.dumps({"message": "test", "spec_id": 99999}).encode()
        req_404 = urllib.request.Request(
            "http://localhost:8000/api/chat",
            data=payload_404,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(req_404, timeout=10)
            check("Non-existent spec_id returns 404", False, "got 200 instead")
        except urllib.error.HTTPError as e:
            check("Non-existent spec_id returns 404", e.code == 404, f"status={e.code}")
    except Exception as exc:
        check("404 test", False, str(exc))


# ═════════════════════════════════════════════════════════════════════════════
# SECTION E — Audit log verification
# ═════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}── E. Audit log — blocker checks ──────────────────────────{RESET}")

try:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT DISTINCT tool_name FROM audit_logs
               WHERE tool_name IN ('search_endpoints', 'get_endpoint', 'validate_request')
               ORDER BY tool_name"""
        )
        logged_tools = [row[0] for row in cur.fetchall()]

    check(
        "audit_logs has search_endpoints entry",
        "search_endpoints" in logged_tools,
        f"found: {logged_tools}",
    )
    check(
        "audit_logs has get_endpoint entry",
        "get_endpoint" in logged_tools,
        f"found: {logged_tools}",
    )
    check(
        "audit_logs has validate_request entry",
        "validate_request" in logged_tools,
        f"found: {logged_tools}",
    )

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT duration_ms FROM audit_logs ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
    if row:
        check(
            "Latest audit entry has non-null duration_ms",
            row[0] is not None,
            f"duration_ms={row[0]}",
        )
    else:
        check("Latest audit entry has non-null duration_ms", False, "no rows")

except Exception as exc:
    check("Audit log checks", False, str(exc))


# ═════════════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════════════
print(f"\n{'─' * 60}")
total = passed + failed
if failed == 0:
    print(f"{GREEN}{BOLD}Phase 3: ALL {passed}/{total} checks passed ✅{RESET}")
else:
    print(f"{RED}{BOLD}Phase 3: {passed}/{total} passed, {failed} FAILED ❌{RESET}")
    print(f"{YELLOW}Fix all failures before starting Phase 4.{RESET}")
sys.exit(0 if failed == 0 else 1)
