#!/usr/bin/env python3
"""
Phase 2 exit gate tests — run from the backend/ directory.

Usage:
    cd /Users/sathishkr/self-aware-api-platform/backend
    .venv/bin/python tests/test_phase2.py

Requires Phase 1 complete (spec ingested in DB).
All checks must PASS before starting Phase 3 (MCP server + agent).
"""

import asyncio
import logging
import os
import sys
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
spec_id: int | None = None
try:
    from storage.schema_store import get_db

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT MAX(id) FROM specs")
        row = cur.fetchone()
        spec_id = row[0] if row and row[0] else None

    if spec_id is None:
        print(f"{RED}No spec found in DB. Run Phase 1 ingest first:{RESET}")
        print(
            "  curl -X POST http://localhost:8000/api/specs/ingest"
            " -F 'file=@../specs/banking-api-v1.yaml' -F 'name=BankingAPI'"
        )
        sys.exit(1)
    print(f"Using spec_id={spec_id} (auto-detected from DB)\n")
except Exception as exc:
    print(f"{RED}Cannot connect to DB: {exc}{RESET}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# TODO 2.1 — spec_search
# ─────────────────────────────────────────────────────────────────────────────
print(f"{BOLD}── TODO 2.1  spec_search ───────────────────────────────────{RESET}")
try:
    from tools.spec_search import search_endpoints

    results = asyncio.run(search_endpoints("create bank account", spec_id=spec_id, limit=3))
    check("search_endpoints returns ≥ 1 result", len(results) >= 1, f"got {len(results)}")
    if results:
        check(
            "Top result is createAccount",
            results[0].operation_id == "createAccount",
            f"got {results[0].operation_id}",
        )
        check("Top result score > 0.005 (voyage-4 asymmetric)", results[0].score >= 0.005, f"score={results[0].score:.3f}")
        check(
            "Results carry method and path",
            bool(results[0].method) and bool(results[0].path),
            f"{results[0].method} {results[0].path}",
        )
except Exception as exc:
    check("spec_search", False, str(exc))

# ─────────────────────────────────────────────────────────────────────────────
# TODO 2.2 — spec_get
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}── TODO 2.2  spec_get ──────────────────────────────────────{RESET}")
try:
    from tools.spec_get import get_endpoint

    ep = asyncio.run(get_endpoint("createAccount", spec_id=spec_id))
    check(
        "get_endpoint returns POST /accounts",
        ep.method == "POST" and ep.path == "/accounts",
        f"got {ep.method} {ep.path}",
    )
    check("spec_version = 1", ep.spec_version == 1, f"got {ep.spec_version}")
    check("request_body_schema not None", ep.request_body_schema is not None)
    check("tags is a list", isinstance(ep.tags, list))
except Exception as exc:
    check("spec_get", False, str(exc))

# ─────────────────────────────────────────────────────────────────────────────
# TODO 2.3 — spec_validate
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}── TODO 2.3  spec_validate ─────────────────────────────────{RESET}")
try:
    from tools.spec_validate import validate_request

    # Case 1: valid payload
    r1 = asyncio.run(
        validate_request(
            "createAccount",
            {"accountName": "Acme Corp", "accountType": "current"},
            spec_id=spec_id,
        )
    )
    check("Valid payload → valid=True", r1.valid, f"errors={r1.errors}")

    # Case 2: missing required field
    r2 = asyncio.run(
        validate_request("createAccount", {"accountType": "current"}, spec_id=spec_id)
    )
    check("Missing accountName → valid=False", not r2.valid)
    check(
        "Error targets accountName field",
        any(e.field == "accountName" for e in r2.errors),
        f"fields={[e.field for e in r2.errors]}",
    )

    # Case 3: bad enum value
    r3 = asyncio.run(
        validate_request(
            "createAccount",
            {"accountName": "Acme", "accountType": "invalid_type"},
            spec_id=spec_id,
        )
    )
    check("Bad enum → valid=False", not r3.valid)
    check(
        "Error targets accountType field",
        any(e.field == "accountType" for e in r3.errors),
        f"fields={[e.field for e in r3.errors]}",
    )
except Exception as exc:
    check("spec_validate", False, str(exc))

# ─────────────────────────────────────────────────────────────────────────────
# TODO 2.4 — Audit log
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{BOLD}── TODO 2.4  Audit log ─────────────────────────────────────{RESET}")
try:
    from storage.schema_store import get_db

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM audit_logs")
        count = cur.fetchone()[0]
    check("audit_logs has ≥ 1 row after tool calls", count >= 1, f"got {count} rows")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT tool_name,
                      inputs IS NOT NULL      AS has_inputs,
                      outputs IS NOT NULL     AS has_outputs,
                      duration_ms IS NOT NULL AS has_duration
               FROM audit_logs ORDER BY id DESC LIMIT 1"""
        )
        row = cur.fetchone()
    if row:
        check(
            "Latest log has tool_name + inputs + outputs + duration_ms",
            all(row[1:]),
            f"tool={row[0]}",
        )
except Exception as exc:
    check("Audit log", False, str(exc))

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{'─' * 60}")
total = passed + failed
if failed == 0:
    print(f"{GREEN}{BOLD}Phase 2: ALL {passed}/{total} checks passed ✅{RESET}")
    print("Safe to proceed to Phase 3 (MCP server + agent).\n")
else:
    print(f"{RED}{BOLD}Phase 2: {failed}/{total} checks FAILED ❌{RESET}")
    print(f"{YELLOW}Fix the blockers above before starting Phase 3.{RESET}\n")

sys.exit(0 if failed == 0 else 1)
