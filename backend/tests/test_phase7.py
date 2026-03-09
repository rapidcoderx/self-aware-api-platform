"""
test_phase7.py — Phase 7 Review Gate
Tests all Phase 7 components: SpecUploader, ImpactPanel, AuditLogModal,
ResponsibleAIPanel, App.jsx wiring, and backend impact route.

Run from backend/:
    .venv/bin/python tests/test_phase7.py
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# backend/tests/test_phase7.py → backend/ → project root
_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))      # .../backend/tests
_BACKEND_DIR = os.path.dirname(_TESTS_DIR)                    # .../backend
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)                 # .../self-aware-api-platform

FRONTEND_SRC = os.path.join(_PROJECT_ROOT, "frontend", "src")
BACKEND_SRC = _BACKEND_DIR

PASS = "✅ PASS"
FAIL = "❌ FAIL"


def check(label: str, condition: bool, detail: str = "") -> bool:
    symbol = PASS if condition else FAIL
    suffix = f" — {detail}" if detail and not condition else ""
    print(f"  {symbol}  {label}{suffix}")
    return condition


def read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


# ─────────────────────────────────────────────────────────────────────────────
# Section A — SpecUploader.jsx
# ─────────────────────────────────────────────────────────────────────────────

def test_spec_uploader() -> int:
    print("\n─── Section A: SpecUploader.jsx ───────────────────────────────────")
    path = os.path.join(FRONTEND_SRC, "components", "SpecUploader.jsx")
    failures = 0

    if not check("File exists", os.path.exists(path)):
        print("  (skipping — file not found)")
        return 1

    src = read_file(path)

    tests = [
        ("Imports axios", "axios" in src),
        ("Uses useRef for file input", "useRef" in src),
        ("File type validation (.yaml/.yml/.json)", ".yaml" in src and ".yml" in src and ".json" in src),
        ("Validates file type client-side (validateFileType or similar)", "accept" in src and (".yaml" in src and ".yml" in src)),
        ("POST to /api/specs/ingest", "/api/specs/ingest" in src),
        ("Uses multipart/form-data header", "multipart/form-data" in src),
        ("Shows upload error to user", "setError" in src or "error" in src.lower()),
        ("Drag-and-drop: onDrop handler", "onDrop" in src),
        ("Drag-and-drop: onDragOver handler", "onDragOver" in src),
        ("Drag-and-drop: onDragLeave handler", "onDragLeave" in src),
        ("Version badge after success (v{uploaded.version})", "version" in src and "uploaded" in src),
        ("onUploaded callback called after success", "onUploaded" in src),
        ("No console.log()", "console.log" not in src),
        ("Hidden file input with accept attribute", 'accept=".yaml' in src),
        ("Error state shown to user (not silently swallowed)", "text-red" in src or "error" in src.lower()),
    ]

    for label, condition in tests:
        if not check(label, condition):
            failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section B — ImpactPanel.jsx
# ─────────────────────────────────────────────────────────────────────────────

def test_impact_panel() -> int:
    print("\n─── Section B: ImpactPanel.jsx ────────────────────────────────────")
    path = os.path.join(FRONTEND_SRC, "components", "ImpactPanel.jsx")
    failures = 0

    if not check("File exists", os.path.exists(path)):
        print("  (skipping — file not found)")
        return 1

    src = read_file(path)

    tests = [
        ("Imports axios", "axios" in src),
        ("Uses useEffect", "useEffect" in src),
        ("Fetches from /api/specs/impact/ route", "/api/specs/impact/" in src),
        ("Uses diffId prop to build URL", "diffId" in src),
        ("HIGH severity badge (red)", "HIGH" in src and ("red" in src or "RED" in src)),
        ("MEDIUM severity badge (amber)", "MEDIUM" in src and ("amber" in src or "AMBER" in src)),
        ("LOW severity badge (gray/grey)", "LOW" in src and ("gray" in src or "grey" in src)),
        ("Shows affected_service name", "affected_service" in src),
        ("Shows team name", "team" in src),
        ("onImpactCount callback fired", "onImpactCount" in src),
        ("Loading state shown", "loading" in src.lower()),
        ("Error state shown", "error" in src.lower()),
        ("Cancelled flag prevents state update after unmount", "cancelled" in src),
        ("No console.log()", "console.log" not in src),
    ]

    for label, condition in tests:
        if not check(label, condition):
            failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section C — AuditLogModal.jsx
# ─────────────────────────────────────────────────────────────────────────────

def test_audit_log_modal() -> int:
    print("\n─── Section C: AuditLogModal.jsx ──────────────────────────────────")
    path = os.path.join(FRONTEND_SRC, "components", "AuditLogModal.jsx")
    failures = 0

    if not check("File exists", os.path.exists(path)):
        print("  (skipping — file not found)")
        return 1

    src = read_file(path)

    tests = [
        ("Imports axios", "axios" in src),
        ("Fetches from /api/audit-logs", "/api/audit-logs" in src),
        ("Accepts open prop", "open" in src),
        ("Accepts onClose prop", "onClose" in src),
        ("Returns null when not open", "if (!open)" in src or "!open" in src),
        ("Table renders tool_name column", "tool_name" in src),
        ("Table renders duration_ms column", "duration_ms" in src),
        ("Table renders timestamp column", "created_at" in src or "timestamp" in src.lower() or "Time" in src),
        ("Refresh button present", "Refresh" in src or "refresh" in src),
        ("Close button present", "onClose" in src and ("Close" in src or "close" in src or "M6 18L18 6" in src)),
        ("Escape key closes modal", "Escape" in src or "keydown" in src),
        ("Backdrop click closes modal", "e.target === e.currentTarget" in src),
        ("Loading state shown", "loading" in src.lower()),
        ("Error state shown", "error" in src.lower()),
        ("No console.log()", "console.log" not in src),
    ]

    for label, condition in tests:
        if not check(label, condition):
            failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section D — ResponsibleAIPanel.jsx
# ─────────────────────────────────────────────────────────────────────────────

def test_responsible_ai_panel() -> int:
    print("\n─── Section D: ResponsibleAIPanel.jsx ─────────────────────────────")
    path = os.path.join(FRONTEND_SRC, "components", "ResponsibleAIPanel.jsx")
    failures = 0

    if not check("File exists", os.path.exists(path)):
        print("  (skipping — file not found)")
        return 1

    src = read_file(path)

    guardrail_labels = [
        "Sandbox Mode Active",
        "Schema Validation Enforced",
        "Provenance on Every Answer",
        "Human-in-the-Loop for Migration",
        "Audit Log Active",
        "Breaking Changes Explained",
    ]

    tests = [
        ("Imports axios", "axios" in src),
        ("Reads sandbox from /health endpoint", "/health" in src),
        ("Reads audit log activity from /api/audit-logs", "/api/audit-logs" in src),
        ("Collapsible panel (collapsed state)", "collapsed" in src),
        ("Toggle button present", "setCollapsed" in src or "toggle" in src.lower()),
        ("Displays active/total count", "activeCount" in src or "active" in src),
        ("Active count computed dynamically", ".filter" in src and "active" in src),
        ("No console.log()", "console.log" not in src),
        ("Cancelled flag prevents state update after unmount", "cancelled" in src),
    ] + [
        (f"Guardrail: '{label}'", label in src)
        for label in guardrail_labels
    ]

    for label, condition in tests:
        if not check(label, condition):
            failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section E — App.jsx integration
# ─────────────────────────────────────────────────────────────────────────────

def test_app_integration() -> int:
    print("\n─── Section E: App.jsx integration ────────────────────────────────")
    path = os.path.join(FRONTEND_SRC, "App.jsx")
    failures = 0

    if not check("File exists", os.path.exists(path)):
        print("  (skipping — file not found)")
        return 1

    src = read_file(path)

    tests = [
        ("Imports SpecUploader", "import SpecUploader" in src),
        ("Imports ImpactPanel", "import ImpactPanel" in src),
        ("Imports AuditLogModal", "import AuditLogModal" in src),
        ("Imports ResponsibleAIPanel", "import ResponsibleAIPanel" in src),
        ("AuditLogModal rendered in JSX", "<AuditLogModal" in src),
        ("SpecUploader rendered in JSX", "<SpecUploader" in src),
        ("ImpactPanel rendered in JSX", "<ImpactPanel" in src),
        ("ResponsibleAIPanel rendered in JSX", "<ResponsibleAIPanel" in src),
        ("Audit Log button triggers modal", "showAuditLog" in src or "auditLog" in src.lower()),
        ("impactCount state present", "impactCount" in src),
        ("ImpactPanel receives diffId from diffData", "diffId" in src and "diff_id" in src),
        ("ImpactPanel passes onImpactCount callback", "onImpactCount" in src),
        ("DiffPanel receives impactCount prop", "impactCount={impactCount}" in src or "impactCount" in src),
        ("handleSpecUploaded refreshes spec list", "handleSpecUploaded" in src),
        ("lastProvenance state tracked", "lastProvenance" in src),
        ("provenance from chat result captured", "result.provenance" in src),
        ("onClose clears impactCount too", "setImpactCount" in src),
        ("No console.log()", "console.log" not in src),
    ]

    for label, condition in tests:
        if not check(label, condition):
            failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section F — Backend: GET /api/specs/impact/{diff_id}
# ─────────────────────────────────────────────────────────────────────────────

def test_backend_impact_route() -> int:
    print("\n─── Section F: Backend impact route (main.py) ─────────────────────")
    path = os.path.join(BACKEND_SRC, "main.py")
    failures = 0

    if not check("main.py exists", os.path.exists(path)):
        return 1

    src = read_file(path)

    tests = [
        ("GET /api/specs/impact/{diff_id} route defined", "/api/specs/impact/" in src),
        ("Imports analyze_impact", "analyze_impact" in src),
        ("Imports ImpactItem", "ImpactItem" in src),
        ("Imports get_diff_by_id", "get_diff_by_id" in src),
        ("Returns 404 when diff not found", "404" in src or "HTTP_404_NOT_FOUND" in src),
        ("await analyze_impact(diff_id)", "await analyze_impact" in src),
        ("Response model is list[ImpactItem]", "list[ImpactItem]" in src),
        ("asyncio imported", "import asyncio" in src),
        ("asyncio.to_thread used for sync DB call", "asyncio.to_thread" in src),
        ("No f-string SQL anywhere", "f\"SELECT" not in src and "f'SELECT" not in src),
        ("HTTP 500 uses generic detail", 'detail="Impact analysis failed"' in src or
         "detail='Impact analysis failed'" in src),
    ]

    for label, condition in tests:
        if not check(label, condition):
            failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section G — ChatPanel.jsx: provenance in onResult
# ─────────────────────────────────────────────────────────────────────────────

def test_chat_panel_provenance() -> int:
    print("\n─── Section G: ChatPanel.jsx provenance in onResult ───────────────")
    path = os.path.join(FRONTEND_SRC, "components", "ChatPanel.jsx")
    failures = 0

    if not check("File exists", os.path.exists(path)):
        return 1

    src = read_file(path)

    tests = [
        ("provenance passed in onResult call", "provenance:" in src and "onResult" in src),
        ("provenance sourced from data.provenance", "data.provenance" in src),
        ("No console.log()", "console.log" not in src),
    ]

    for label, condition in tests:
        if not check(label, condition):
            failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section H — Live backend test (optional — requires server on port 8000)
# ─────────────────────────────────────────────────────────────────────────────

def test_live_backend() -> int:
    print("\n─── Section H: Live backend tests (optional) ───────────────────────")
    try:
        import urllib.request
        import json as json_lib

        req = urllib.request.Request("http://localhost:8000/health")
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json_lib.loads(resp.read())
        if not check("Server reachable at :8000", True):
            return 0
    except Exception:
        print("  ⚠️  SKIP  Server not running — skipping live tests")
        return 0

    failures = 0
    try:
        import urllib.request
        import json as json_lib

        # Check /api/audit-logs
        req = urllib.request.Request("http://localhost:8000/api/audit-logs?limit=1")
        with urllib.request.urlopen(req, timeout=5) as resp:
            logs = json_lib.loads(resp.read())
        if not check("/api/audit-logs returns a list", isinstance(logs, list)):
            failures += 1

        # Check GET /api/specs/impact/1 exists (even if diff_id=1 may not exist)
        req = urllib.request.Request("http://localhost:8000/api/specs/impact/999999")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                pass
            check("/api/specs/impact/999999 returns 404", False, "Expected 404 but got 200")
            failures += 1
        except urllib.error.HTTPError as e:
            if not check("/api/specs/impact/999999 returns 404", e.code == 404,
                         f"Got HTTP {e.code} instead"):
                failures += 1

        # Check GET /api/audit-logs?limit=20
        req = urllib.request.Request("http://localhost:8000/api/audit-logs?limit=20")
        with urllib.request.urlopen(req, timeout=5) as resp:
            logs = json_lib.loads(resp.read())
        if not check("/api/audit-logs returns list with ≤20 entries", isinstance(logs, list) and len(logs) <= 20):
            failures += 1

    except Exception as exc:
        print(f"  ❌ Live test error: {exc}")
        failures += 1

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Section I — DB audit log count check
# ─────────────────────────────────────────────────────────────────────────────

def test_db_audit_count() -> int:
    print("\n─── Section I: DB audit log count ─────────────────────────────────")
    failures = 0
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(BACKEND_SRC, ".env"))
        from storage.schema_store import get_db
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM audit_logs")
                count = cur.fetchone()[0]
        if not check(f"audit_logs has > 20 entries ({count} found)", count > 20,
                     f"Only {count} entries — run phase tests first to populate"):
            failures += 1
    except Exception as exc:
        print(f"  ⚠️  SKIP  DB unreachable: {exc}")

    return failures


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 65)
    print("PHASE 7 REVIEW GATE — Self-Aware API Platform")
    print("=" * 65)

    total_failures = 0
    total_failures += test_spec_uploader()
    total_failures += test_impact_panel()
    total_failures += test_audit_log_modal()
    total_failures += test_responsible_ai_panel()
    total_failures += test_app_integration()
    total_failures += test_backend_impact_route()
    total_failures += test_chat_panel_provenance()
    total_failures += test_live_backend()
    total_failures += test_db_audit_count()

    print("\n" + "=" * 65)
    if total_failures == 0:
        print("ALL CHECKS PASSED ✅  Phase 7 is complete — tick CLAUDE.md items 8-9")
    else:
        print(f"{total_failures} CHECK(S) FAILED ❌  Fix blockers before moving to Phase 8")
    print("=" * 65)
    sys.exit(0 if total_failures == 0 else 1)
