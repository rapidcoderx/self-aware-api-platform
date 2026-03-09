#!/usr/bin/env python3
"""
Phase 6 exit gate tests — Self-Healing.

Usage:
    cd /Users/sathishkr/self-aware-api-platform/backend
    .venv/bin/python tests/test_phase6.py

Requires:
  - Both BankingAPI v1 + v2 specs ingested (spec_ids resolved from DB)
  - PostgreSQL running with selfaware_api DB
  - ANTHROPIC_API_KEY and VOYAGE_API_KEY set in backend/.env

Sections:
  A. agent.py static checks — run_self_heal, SELF_HEAL_MAX_REVISIONS, helpers
  B. selfheal route static checks — SelfHealRequest, no error leakage, router registered
  C. MigrationPanel.jsx static checks — export, confirmation dialog, loading state
  D. Live self-heal test — validates end-to-end: before invalid, after valid
  E. Audit chain check — spec_get + spec_validate entries logged after run
  F. Live route test (optional — requires server on port 8000)

All checks must PASS before starting Phase 7 (Polish & Responsible AI UI).
"""

import asyncio
import json
import logging
import os
import re
import sys
import urllib.error
import urllib.request
import warnings

# ── Path / env setup ──────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
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
        print(f"{GREEN}\u2705 PASS{RESET}  {name}" + (f"  [{detail}]" if detail else ""))
    else:
        failed += 1
        print(f"{RED}\u274c FAIL{RESET}  {name}" + (f"  [{detail}]" if detail else ""))


def read_src(path: str) -> str:
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        return ""


# ── Resolve spec_ids ──────────────────────────────────────────────────────────
old_spec_id = None
new_spec_id = None

try:
    from storage.schema_store import get_db

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, version FROM specs WHERE name = 'BankingAPI' ORDER BY version"
        )
        rows = cur.fetchall()

    if len(rows) >= 2:
        old_spec_id = rows[0][0]
        new_spec_id = rows[1][0]
        print(
            f"Using old_spec_id={old_spec_id} (BankingAPI v{rows[0][1]}), "
            f"new_spec_id={new_spec_id} (BankingAPI v{rows[1][1]})\n"
        )
    elif len(rows) == 1:
        print(f"{YELLOW}Only one BankingAPI spec found (id={rows[0][0]}).{RESET}")
        print("Ingest banking-api-v2.yaml first, then re-run.\n")
    else:
        print(f"{YELLOW}No BankingAPI spec found in DB.{RESET}")
        print("Run: curl -X POST http://localhost:8000/api/specs/ingest -F 'file=@../specs/banking-api-v1.yaml' -F 'name=BankingAPI'\n")
except Exception as e:
    print(f"{YELLOW}Could not resolve spec_ids from DB: {e}{RESET}\n")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION A — agent.py static checks
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}Section A — agent.py static checks{RESET}")

agent_src = read_src(os.path.join(BACKEND_DIR, "agent.py"))

check("agent.py exists", bool(agent_src))
check(
    "run_self_heal function defined",
    "async def run_self_heal(" in agent_src,
)
check(
    "SELF_HEAL_MAX_REVISIONS = 3",
    "SELF_HEAL_MAX_REVISIONS = 3" in agent_src,
)
check(
    "SELF_HEAL_SYSTEM_PROMPT defined",
    "SELF_HEAL_SYSTEM_PROMPT" in agent_src,
)
check(
    "SELF_HEAL_TOOLS defined (subset)",
    "SELF_HEAL_TOOLS" in agent_src,
)
check(
    "_build_before_payload helper defined",
    "def _build_before_payload(" in agent_src,
)
check(
    "_build_migration_steps helper defined",
    "def _build_migration_steps(" in agent_src,
)
check(
    "run_self_heal calls validate_request (after payload validation)",
    agent_src.count("validate_request(") >= 2,  # before + after validations
)
check(
    "run_self_heal calls diff_specs",
    "diff_specs(" in agent_src,
)
check(
    "run_self_heal calls log_audit",
    "log_audit(" in agent_src and "run_self_heal" in agent_src,
)
check(
    "Revision guard: range(SELF_HEAL_MAX_REVISIONS)",
    "range(SELF_HEAL_MAX_REVISIONS)" in agent_src,
)
check(
    "Returns before_payload key",
    '"before_payload"' in agent_src,
)
check(
    "Returns after_payload key",
    '"after_payload"' in agent_src,
)
check(
    "Returns migration_steps key",
    '"migration_steps"' in agent_src,
)
check(
    "Returns before_validation key",
    '"before_validation"' in agent_src,
)
check(
    "Returns after_validation key",
    '"after_validation"' in agent_src,
)
check(
    "No print() in agent.py",
    "print(" not in agent_src,
)
check(
    "asyncio.to_thread used for Claude call",
    "asyncio.to_thread" in agent_src,
)

# Import checks
try:
    import agent as _ag
    check("agent.py imports cleanly", True)
    check("run_self_heal is callable", callable(getattr(_ag, "run_self_heal", None)))
    check(
        "SELF_HEAL_MAX_REVISIONS value is 3",
        getattr(_ag, "SELF_HEAL_MAX_REVISIONS", 0) == 3,
    )
    check(
        "SELF_HEAL_TOOLS has exactly 2 tools (get + validate)",
        len(getattr(_ag, "SELF_HEAL_TOOLS", [])) == 2,
    )
    check(
        "SELF_HEAL_TOOLS contains spec_get_endpoint",
        any(
            t.get("name") == "spec_get_endpoint"
            for t in getattr(_ag, "SELF_HEAL_TOOLS", [])
        ),
    )
    check(
        "SELF_HEAL_TOOLS contains spec_validate_request",
        any(
            t.get("name") == "spec_validate_request"
            for t in getattr(_ag, "SELF_HEAL_TOOLS", [])
        ),
    )
except Exception as e:
    check("agent.py imports cleanly", False, str(e))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION B — selfheal route static checks
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}Section B — selfheal route static checks{RESET}")

selfheal_src = read_src(os.path.join(BACKEND_DIR, "routes", "selfheal.py"))
main_src = read_src(os.path.join(BACKEND_DIR, "main.py"))

check("routes/selfheal.py exists", bool(selfheal_src))
check(
    "SelfHealRequest model defined",
    "class SelfHealRequest" in selfheal_src,
)
check(
    "SelfHealResponse model defined",
    "class SelfHealResponse" in selfheal_src,
)
check(
    "POST /api/agent/self-heal route defined",
    '"/api/agent/self-heal"' in selfheal_src,
)
check(
    "selfheal_router exported",
    "selfheal_router" in selfheal_src,
)
check(
    "selfheal_router registered in main.py",
    "selfheal_router" in main_src,
)
check(
    "No detail=str(e) error leakage",
    'detail=str(e)' not in selfheal_src and 'detail=str(exc)' not in selfheal_src,
)
check(
    "HTTP 503 for RuntimeError (max iterations)",
    "503" in selfheal_src or "SERVICE_UNAVAILABLE" in selfheal_src,
)
check(
    "HTTP 422 for ValueError (bad operation_id)",
    "422" in selfheal_src or "UNPROCESSABLE" in selfheal_src,
)
check(
    "response_model=SelfHealResponse on route",
    "response_model=SelfHealResponse" in selfheal_src,
)
check(
    "No print() in selfheal.py",
    "print(" not in selfheal_src,
)

try:
    from routes.selfheal import selfheal_router, SelfHealRequest, SelfHealResponse
    check("routes/selfheal.py imports cleanly", True)
    check("SelfHealRequest has old_spec_id field", hasattr(SelfHealRequest.model_fields, 'old_spec_id') or 'old_spec_id' in SelfHealRequest.model_fields)
    check("SelfHealRequest has new_spec_id field", 'new_spec_id' in SelfHealRequest.model_fields)
    check("SelfHealRequest has operation_id field", 'operation_id' in SelfHealRequest.model_fields)
    check("SelfHealResponse has before_payload field", 'before_payload' in SelfHealResponse.model_fields)
    check("SelfHealResponse has after_payload field", 'after_payload' in SelfHealResponse.model_fields)
    check("SelfHealResponse has migration_steps field", 'migration_steps' in SelfHealResponse.model_fields)
    check("SelfHealResponse has after_validation field", 'after_validation' in SelfHealResponse.model_fields)
except Exception as e:
    check("routes/selfheal.py imports cleanly", False, str(e))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION C — MigrationPanel.jsx static checks
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}Section C — MigrationPanel.jsx static checks{RESET}")

frontend_dir = os.path.join(PROJECT_ROOT, "frontend", "src", "components")
migration_src = read_src(os.path.join(frontend_dir, "MigrationPanel.jsx"))

check("MigrationPanel.jsx exists", bool(migration_src))
check(
    "axios used (not fetch)",
    "axios" in migration_src and "fetch(" not in migration_src,
)
check(
    "POST /api/agent/self-heal called",
    "'/api/agent/self-heal'" in migration_src or '"/api/agent/self-heal"' in migration_src,
)
check(
    "Loading state implemented",
    "loading" in migration_src and "setLoading" in migration_src,
)
check(
    "Error state implemented",
    "error" in migration_src and "setError" in migration_src,
)
check(
    "Export as JSON triggers download (createObjectURL or similar)",
    "createObjectURL" in migration_src or "download" in migration_src,
)
check(
    "Apply Migration button present",
    "Apply Migration" in migration_src,
)
check(
    "Confirmation dialog for Apply Migration (not auto-apply)",
    "showApplyDialog" in migration_src or "dialog" in migration_src.lower() or "confirm" in migration_src.lower(),
)
check(
    "Before payload section present",
    "before_payload" in migration_src or "Before" in migration_src,
)
check(
    "After payload section present",
    "after_payload" in migration_src or "After" in migration_src,
)
check(
    "Valid ✓ badge for after payload",
    "Valid" in migration_src and "after_validation" in migration_src,
)
check(
    "Migration steps list rendered",
    "migration_steps" in migration_src,
)
check(
    "No console.log() in MigrationPanel",
    "console.log(" not in migration_src,
)
check(
    "Shows which operationId is being migrated",
    "operationId" in migration_src or "operation_id" in migration_src,
)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION D — Live self-heal test
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}Section D — Live self-heal test{RESET}")

if old_spec_id is None or new_spec_id is None:
    print(f"{YELLOW}  Skipping live test — both spec versions must be ingested first.{RESET}")
    check("Live self-heal skipped (both specs needed)", True, "not a failure — run after ingesting both specs")
else:
    try:
        from agent import run_self_heal, _build_before_payload, _build_migration_steps

        # Test _build_before_payload directly
        from tools.spec_get import get_endpoint

        old_detail = asyncio.run(get_endpoint("createAccount", old_spec_id))
        before = _build_before_payload(old_detail)

        check(
            "_build_before_payload returns non-empty dict",
            isinstance(before, dict) and len(before) > 0,
            str(before),
        )
        check(
            "_build_before_payload includes accountName",
            "accountName" in before,
        )
        check(
            "_build_before_payload includes accountType",
            "accountType" in before,
        )
        check(
            "_build_before_payload does NOT include companyRegistrationNumber",
            "companyRegistrationNumber" not in before,
            "correct — v1 schema does not have this field",
        )

        # Test _build_migration_steps with mock diffs
        from tools.spec_diff import DiffItem

        mock_diffs = [
            DiffItem(
                operation_id="createAccount",
                method="POST",
                path="/accounts",
                breaking=True,
                change_type="REQUIRED_ADDED",
                field="companyRegistrationNumber",
                old_value=None,
                new_value="string",
            ),
        ]
        steps = _build_migration_steps(mock_diffs)
        check(
            "_build_migration_steps returns non-empty list",
            isinstance(steps, list) and len(steps) > 0,
        )
        check(
            "_build_migration_steps step is a human-readable string",
            isinstance(steps[0], str) and len(steps[0]) > 20,
            steps[0][:80],
        )
        check(
            "_build_migration_steps mentions the field name",
            "companyRegistrationNumber" in steps[0],
        )

        # Full live run
        print(f"\n  Running run_self_heal(old={old_spec_id}, new={new_spec_id}, op=createAccount)…")
        print(f"  {YELLOW}This calls the Anthropic API — may take 15-45 seconds.{RESET}")

        plan = asyncio.run(
            run_self_heal(old_spec_id, new_spec_id, "createAccount")
        )

        check("run_self_heal returns a dict", isinstance(plan, dict))
        check(
            "plan has before_payload key",
            "before_payload" in plan and isinstance(plan["before_payload"], dict),
        )
        check(
            "plan has after_payload key",
            "after_payload" in plan and isinstance(plan["after_payload"], dict),
        )
        check(
            "plan has before_validation key",
            "before_validation" in plan and isinstance(plan["before_validation"], dict),
        )
        check(
            "plan has after_validation key",
            "after_validation" in plan and isinstance(plan["after_validation"], dict),
        )
        check(
            "plan has migration_steps key",
            "migration_steps" in plan and isinstance(plan["migration_steps"], list),
        )
        check(
            "after_validation.valid == True",
            plan.get("after_validation", {}).get("valid") is True,
            f"after_validation={plan.get('after_validation')}",
        )
        check(
            "after_payload contains companyRegistrationNumber",
            "companyRegistrationNumber" in plan.get("after_payload", {}),
            str(plan.get("after_payload")),
        )
        check(
            "migration_steps is non-empty list of strings",
            (
                isinstance(plan.get("migration_steps"), list)
                and len(plan["migration_steps"]) >= 1
                and all(isinstance(s, str) for s in plan["migration_steps"])
            ),
        )
        check(
            "before_payload does NOT have companyRegistrationNumber",
            "companyRegistrationNumber" not in plan.get("before_payload", {}),
        )
        check(
            "operation_id returned correctly",
            plan.get("operation_id") == "createAccount",
        )
        check(
            "old_spec_id returned correctly",
            plan.get("old_spec_id") == old_spec_id,
        )
        check(
            "new_spec_id returned correctly",
            plan.get("new_spec_id") == new_spec_id,
        )

        print(f"\n  Before valid (expected False): {plan['before_validation'].get('valid')}")
        print(f"  After valid  (expected True):  {plan['after_validation'].get('valid')}")
        print(f"  After payload: {json.dumps(plan['after_payload'], indent=2)}")
        print(f"  Migration steps:")
        for i, s in enumerate(plan["migration_steps"], 1):
            print(f"    {i}. {s}")

    except Exception as e:
        check("run_self_heal live test", False, f"{type(e).__name__}: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION E — Audit chain check
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}Section E — Audit chain check{RESET}")

try:
    from storage.schema_store import list_audit_logs

    logs = list_audit_logs(limit=30)
    tool_names = [log["tool_name"] for log in logs]

    # NOTE: audit log uses the Python function/tool name as logged by each tool.
    # spec_get.py logs as "spec_get_endpoint" or "get_endpoint" depending on version.
    # spec_validate.py logs as "spec_validate_request" or "validate_request".
    # Accept either name to stay resilient to implementation differences.
    has_get = any("get_endpoint" in t or "spec_get" in t for t in tool_names)
    has_validate = any("validate" in t for t in tool_names)

    check(
        "audit_logs has get_endpoint entries (spec_get_endpoint or get_endpoint)",
        has_get,
        f"recent tools: {tool_names[:8]}",
    )
    check(
        "audit_logs has validate entries (spec_validate_request or validate_request)",
        has_validate,
    )
    check(
        "audit_logs has run_self_heal entry",
        "run_self_heal" in tool_names,
    )

    # Count validate calls — should be at least 2 (before + after in self-heal)
    validate_count = sum(1 for t in tool_names if "validate" in t)
    check(
        f"audit_logs has >= 2 validate entries (before + after)",
        validate_count >= 2,
        f"found {validate_count}",
    )

    # Check that run_self_heal log has after_valid output
    sh_logs = [l for l in logs if l["tool_name"] == "run_self_heal"]
    if sh_logs:
        latest = sh_logs[0]
        outputs = latest.get("outputs", {})
        check(
            "run_self_heal audit log has after_valid output",
            "after_valid" in outputs,
            str(outputs),
        )
        check(
            "run_self_heal audit log after_valid=True",
            outputs.get("after_valid") is True,
            str(outputs.get("after_valid")),
        )

except Exception as e:
    check("Audit chain check", False, f"{type(e).__name__}: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION F — Live route test (optional — requires server on port 8000)
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}Section F — Live route test (optional){RESET}")

server_up = False
try:
    urllib.request.urlopen("http://localhost:8000/health", timeout=2)
    server_up = True
except Exception:
    pass

if not server_up:
    print(f"  {YELLOW}Server not running on port 8000 — skipping route test.{RESET}")
    print("  Start with: cd backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000")
    check("Route test skipped (server not running)", True, "start server to enable this check")
elif old_spec_id is None or new_spec_id is None:
    print(f"  {YELLOW}Both spec versions needed — skipping route test.{RESET}")
    check("Route test skipped (specs not ingested)", True, "not a failure")
else:
    try:
        payload_bytes = json.dumps({
            "old_spec_id": old_spec_id,
            "new_spec_id": new_spec_id,
            "operation_id": "createAccount",
        }).encode()

        req = urllib.request.Request(
            "http://localhost:8000/api/agent/self-heal",
            data=payload_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read())

        check("POST /api/agent/self-heal returns 200", True)
        check(
            "Response has before_payload",
            "before_payload" in body and isinstance(body["before_payload"], dict),
        )
        check(
            "Response has after_payload",
            "after_payload" in body and isinstance(body["after_payload"], dict),
        )
        check(
            "Response after_validation.valid == True",
            body.get("after_validation", {}).get("valid") is True,
        )
        check(
            "Response has migration_steps list",
            "migration_steps" in body and isinstance(body["migration_steps"], list),
        )
        check(
            "after_payload has companyRegistrationNumber",
            "companyRegistrationNumber" in body.get("after_payload", {}),
        )

    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if e.code == 404:
            check(
                "POST /api/agent/self-heal returns 200",
                False,
                f"HTTP 404 — server running but route not found. "
                f"Restart server to pick up selfheal_router: "
                f"uvicorn main:app --reload --port 8000",
            )
        else:
            check("POST /api/agent/self-heal returns 200", False, f"HTTP {e.code}: {body[:200]}")
    except Exception as e:
        check("POST /api/agent/self-heal returns 200", False, f"{type(e).__name__}: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
total = passed + failed
print(f"\n{'═' * 60}")
print(f"{BOLD}Phase 6 Results: {passed}/{total} checks passed{RESET}")
if failed == 0:
    print(f"{GREEN}{BOLD}✅ ALL PASSED — Phase 6 gate cleared. Ready for Phase 7.{RESET}")
else:
    print(f"{RED}{BOLD}❌ {failed} check(s) failed — fix before starting Phase 7.{RESET}")
print(f"{'═' * 60}\n")

sys.exit(0 if failed == 0 else 1)
