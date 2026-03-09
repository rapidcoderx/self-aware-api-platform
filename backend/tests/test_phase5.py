#!/usr/bin/env python3
"""
Phase 5 exit gate tests — Change Detection.

Usage:
    cd /Users/sathishkr/self-aware-api-platform/backend
    .venv/bin/python tests/test_phase5.py

Requires:
  - Both spec versions ingested: BankingAPI v1 + v2
  - PostgreSQL running with selfaware_api DB

Sections:
  A. spec_diff.py — static source checks
  B. Live diff_specs() — 2 breaking + 1 non-breaking for demo specs
  C. DB persistence — save_diff / get_diff_by_id round-trip
  D. compare route — compare.py static checks
  E. DiffPanel.jsx — frontend static checks
  F. Live route test (requires server on port 8000 — optional)

All checks must PASS before starting Phase 6 (Self-Healing).
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

# ── Path / env setup ──────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(BACKEND_DIR, ".env"))
warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)

# ── Colour helpers ────────────────────────────────────────────────────
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


# ── Resolve spec_ids ────────────────────────────────────────────────────
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
        print("Ingest banking-api-v2.yaml first:")
        print("  curl -X POST http://localhost:8000/api/specs/ingest \\")
        print("    -F 'file=@../specs/banking-api-v2.yaml' -F 'name=BankingAPI'\n")
        sys.exit(1)
    else:
        print(f"{RED}No BankingAPI specs found. Run Phase 1 ingest first.{RESET}")
        sys.exit(1)
except Exception as exc:
    print(f"{RED}Cannot connect to DB: {exc}{RESET}")
    sys.exit(1)

SPEC_DIFF_PATH = os.path.join(BACKEND_DIR, "tools", "spec_diff.py")
COMPARE_ROUTE_PATH = os.path.join(BACKEND_DIR, "routes", "compare.py")
SCHEMA_STORE_PATH = os.path.join(BACKEND_DIR, "storage", "schema_store.py")
MAIN_PATH = os.path.join(BACKEND_DIR, "main.py")
DIFF_PANEL_PATH = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "DiffPanel.jsx")


# =============================================================================
# SECTION A — spec_diff.py static checks
# =============================================================================
print(f"{BOLD}\u2500\u2500 A. spec_diff.py — static source checks {RESET}")

src = read_src(SPEC_DIFF_PATH)

check("spec_diff.py exists", bool(src), SPEC_DIFF_PATH)
check("DiffItem model defined", "class DiffItem(BaseModel)" in src)
check("DiffItem has operation_id field", "operation_id" in src)
check("DiffItem has breaking field", "breaking" in src)
check("DiffItem has change_type field", "change_type" in src)
check("DiffItem has old_value field", "old_value" in src)
check("DiffItem has new_value field", "new_value" in src)
check("REQUIRED_ADDED change_type", '"REQUIRED_ADDED"' in src)
check("FIELD_REMOVED change_type", '"FIELD_REMOVED"' in src)
check("TYPE_CHANGED change_type", '"TYPE_CHANGED"' in src)
check("ENUM_CHANGED change_type", '"ENUM_CHANGED"' in src)
check("FIELD_ADDED change_type", '"FIELD_ADDED"' in src)
check("diff_specs is async", "async def diff_specs" in src)
check("diff_specs return type annotated", "-> list[DiffItem]" in src)
check("log_audit called", "log_audit(" in src)
check("No f-string SQL", re.search(r'f["\'].*SELECT|f["\'].*INSERT', src) is None)
check("Parameterised SQL (%s)", "= %s" in src or "(%s)" in src)
check("No print()", "print(" not in src)
check("logging used", "logger" in src)

print()

# =============================================================================
# SECTION B — Live diff_specs() computation
# =============================================================================
print(f"{BOLD}\u2500\u2500 B. Live diff_specs() — v1 → v2 demo specs {RESET}")

try:
    from tools.spec_diff import DiffItem, diff_specs

    diffs = asyncio.run(diff_specs(old_spec_id, new_spec_id))

    check("diff_specs() returns a list", isinstance(diffs, list), f"{len(diffs)} items")
    check("All items are DiffItem", all(isinstance(d, DiffItem) for d in diffs))

    breaking = [d for d in diffs if d.breaking]
    non_breaking = [d for d in diffs if not d.breaking]

    check(
        "Exactly 2 breaking changes",
        len(breaking) == 2,
        f"got {len(breaking)}: {[d.field for d in breaking]}",
    )
    check(
        "At least 1 non-breaking change",
        len(non_breaking) >= 1,
        f"got {len(non_breaking)}",
    )

    b_fields = [d.field for d in breaking]
    check("companyRegistrationNumber in breaking", "companyRegistrationNumber" in b_fields, str(b_fields))
    check("accountType in breaking", "accountType" in b_fields, str(b_fields))
    check("kycStatus in non-breaking", "kycStatus" in [d.field for d in non_breaking])

    crn = next((d for d in breaking if d.field == "companyRegistrationNumber"), None)
    check(
        "companyRegistrationNumber.change_type == REQUIRED_ADDED",
        crn is not None and crn.change_type == "REQUIRED_ADDED",
        crn.change_type if crn else "not found",
    )

    at = next((d for d in breaking if d.field == "accountType"), None)
    check(
        "accountType.change_type == ENUM_CHANGED",
        at is not None and at.change_type == "ENUM_CHANGED",
        at.change_type if at else "not found",
    )
    if at:
        check("accountType old_value contains 'deposit'", at.old_value is not None and "deposit" in at.old_value, repr(at.old_value))
        check("accountType new_value contains 'corporate'", at.new_value is not None and "corporate" in at.new_value, repr(at.new_value))

    kyc = next((d for d in non_breaking if d.field == "kycStatus"), None)
    check(
        "kycStatus.change_type == FIELD_ADDED",
        kyc is not None and kyc.change_type == "FIELD_ADDED",
        kyc.change_type if kyc else "not found",
    )

    sample = diffs[0].model_dump()
    check(
        "DiffItem.model_dump() has all keys",
        all(k in sample for k in ["operation_id", "method", "path", "breaking", "change_type", "field"]),
    )

except Exception as exc:
    check("diff_specs() runs without exception", False, str(exc))

print()

# =============================================================================
# SECTION C — DB persistence
# =============================================================================
print(f"{BOLD}\u2500\u2500 C. DB persistence — save_diff / get_diff_by_id {RESET}")

saved_diff_id = None

try:
    from storage.schema_store import get_diff_by_id, save_diff
    from tools.spec_diff import diff_specs

    diffs = asyncio.run(diff_specs(old_spec_id, new_spec_id))
    breaking_count = sum(1 for d in diffs if d.breaking)

    diff_id = save_diff(
        old_spec_id=old_spec_id,
        new_spec_id=new_spec_id,
        diffs=[d.model_dump() for d in diffs],
        breaking_count=breaking_count,
    )
    saved_diff_id = diff_id

    check("save_diff() returns int > 0", isinstance(diff_id, int) and diff_id > 0, str(diff_id))

    rec = get_diff_by_id(diff_id)
    check("get_diff_by_id returns dict", isinstance(rec, dict))
    check("spec_id_old correct", rec.get("spec_id_old") == old_spec_id)
    check("spec_id_new correct", rec.get("spec_id_new") == new_spec_id)
    check("breaking_count correct", rec.get("breaking_count") == breaking_count)
    check("diff_json is list", isinstance(rec.get("diff_json"), list))
    check("diff_json length matches", len(rec.get("diff_json", [])) == len(diffs))
    check("get_diff_by_id(999999) is None", get_diff_by_id(999999) is None)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT breaking_count FROM diffs WHERE id = %s", (diff_id,))
        row = cur.fetchone()
    check("diffs table row persisted", row is not None and row[0] == breaking_count)

except Exception as exc:
    check("save_diff/get_diff_by_id run without error", False, str(exc))

print()

# =============================================================================
# SECTION D — compare route static checks
# =============================================================================
print(f"{BOLD}\u2500\u2500 D. compare.py route — static checks {RESET}")

compare_src = read_src(COMPARE_ROUTE_PATH)
main_src = read_src(MAIN_PATH)
schema_src = read_src(SCHEMA_STORE_PATH)

check("compare.py exists", bool(compare_src))
check("compare_router = APIRouter()", "compare_router = APIRouter()" in compare_src)
check('POST "/api/specs/compare" route', '"/api/specs/compare"' in compare_src)
check("CompareRequest model", "class CompareRequest(BaseModel)" in compare_src)
check("CompareResponse model", "class CompareResponse(BaseModel)" in compare_src)
check("CompareResponse.diff_id", "diff_id" in compare_src)
check("CompareResponse.breaking_count", "breaking_count" in compare_src)
check("CompareResponse.non_breaking_count", "non_breaking_count" in compare_src)
check("async def compare_specs", "async def compare_specs" in compare_src)
check("diff_specs imported", "diff_specs" in compare_src)
check("save_diff imported", "save_diff" in compare_src)
check("404 raised for missing spec", "HTTP_404_NOT_FOUND" in compare_src)
check("400 raised for same spec_id", "HTTP_400_BAD_REQUEST" in compare_src)
check("No print() in compare.py", "print(" not in compare_src)
check("compare_router in main.py", "compare_router" in main_src)
check("compare imported in main.py", "compare" in main_src)
check("save_diff in schema_store.py", "def save_diff(" in schema_src)
check("get_diff_by_id in schema_store.py", "def get_diff_by_id(" in schema_src)
check("list_audit_logs in schema_store.py", "def list_audit_logs(" in schema_src)
check("/api/audit-logs in main.py", "/api/audit-logs" in main_src)
check("No f-string SQL in save_diff", re.search(r'f["\'].*INSERT.*diffs', schema_src) is None)

print()

# =============================================================================
# SECTION E — DiffPanel.jsx static checks
# =============================================================================
print(f"{BOLD}\u2500\u2500 E. DiffPanel.jsx — frontend static checks {RESET}")

jsx_src = read_src(DIFF_PANEL_PATH)
app_src = read_src(os.path.join(PROJECT_ROOT, "frontend", "src", "App.jsx"))

check("DiffPanel.jsx exists", bool(jsx_src))
check("No console.log()", "console.log(" not in jsx_src)
check("No raw fetch()", re.search(r'\bfetch\s*\(', jsx_src) is None)
check("BREAKING label visible", "BREAKING" in jsx_src)
check("NON-BREAKING label visible", "NON-BREAKING" in jsx_src or "non-breaking" in jsx_src.lower())
check("Red styling for breaking", "red" in jsx_src)
check("Yellow styling for non-breaking", "yellow" in jsx_src)
check("breaking_count in summary", "breaking_count" in jsx_src)
check("non_breaking_count in summary", "non_breaking_count" in jsx_src)
check("diff_id displayed", "diff_id" in jsx_src)
check("change_type rendered", "change_type" in jsx_src)
check("old_value displayed", "old_value" in jsx_src)
check("new_value displayed", "new_value" in jsx_src)
check("Rows use useState (collapsible)", "useState" in jsx_src)
check("onClose prop supported", "onClose" in jsx_src)
check("DiffPanel imported in App.jsx", "import DiffPanel" in app_src)
check("diffData state in App.jsx", "diffData" in app_src)
check("Compare button in App.jsx", "Compare" in app_src)
check("/api/specs/compare called in App.jsx", "/api/specs/compare" in app_src)
check("DiffPanel rendered conditionally", "DiffPanel" in app_src and "diffData" in app_src)

print()

# =============================================================================
# SECTION F — Live route test (optional)
# =============================================================================
print(f"{BOLD}\u2500\u2500 F. Live route test (port 8000) {RESET}")


def http_post_json(path: str, body: dict) -> tuple[int, dict]:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"http://localhost:8000{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def http_get_json(path: str) -> tuple[int, object]:
    req = urllib.request.Request(f"http://localhost:8000{path}", method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read())
    except Exception as e:
        return 0, {"error": str(e)}


health_status, _ = http_get_json("/health")
if health_status != 200:
    print(f"{YELLOW}Server not on port 8000 — skipping live tests{RESET}")
    print("  Start: cd backend && .venv/bin/uvicorn main:app --port 8000")
else:
    status_code, result = http_post_json(
        "/api/specs/compare",
        {"old_spec_id": old_spec_id, "new_spec_id": new_spec_id},
    )
    check("POST /api/specs/compare returns 200", status_code == 200, f"status={status_code} body={str(result)[:120]}")
    if status_code == 200:
        check("response.diff_id present", "diff_id" in result)
        check("response.breaking_count == 2", result.get("breaking_count") == 2, str(result.get("breaking_count")))
        check("response.non_breaking_count >= 1", result.get("non_breaking_count", 0) >= 1)
        check("response.diffs is list", isinstance(result.get("diffs"), list))

    bad_status, _ = http_post_json(
        "/api/specs/compare", {"old_spec_id": old_spec_id, "new_spec_id": old_spec_id}
    )
    check("Same spec_id → 400", bad_status == 400, f"got {bad_status}")

    al_status, al_data = http_get_json("/api/audit-logs?limit=10")
    check("GET /api/audit-logs returns 200", al_status == 200)
    if al_status == 200 and isinstance(al_data, list):
        tool_names = [e.get("tool_name") for e in al_data]
        check("spec_diff in recent audit_logs", "spec_diff" in tool_names, str(tool_names[:5]))

print()

# =============================================================================
# Summary
# =============================================================================
total = passed + failed
print(f"{BOLD}{'=' * 55}{RESET}")
print(f"{BOLD}Results: {passed}/{total} passed{RESET}  ", end="")
if failed == 0:
    print(f"{GREEN}ALL PASS — Phase 5 complete, ready for Phase 6{RESET}")
else:
    print(f"{RED}{failed} FAILED — fix blockers before Phase 6{RESET}")
print()

sys.exit(0 if failed == 0 else 1)
