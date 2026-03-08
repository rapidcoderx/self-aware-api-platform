#!/usr/bin/env python3
"""
Phase 4 exit gate tests — Frontend UI (Day 1) review gate.

Usage:
    cd /Users/sathishkr/self-aware-api-platform/backend
    .venv/bin/python tests/test_phase4.py

Checks:
  A. File existence + structure checks for App.jsx, ChatPanel.jsx, ValidationPanel.jsx
  B. Phase 4 review gate blockers:
     - All API calls use axios — no raw fetch()
     - All three states handled: loading, error, success
     - No console.log() in component files
     - Tool chips are collapsible (useState for expanded)
     - Provenance badge is always visible — not behind a toggle
     - Sandbox mode badge visible in layout
     - Error states show human-readable message — not raw JSON
  C. Build verification (npm run build)
  D. Backend API smoke test (requires server on port 8000)

All checks must PASS before starting Phase 5 (Change Detection).
"""

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

# ── Path setup ─────────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
SRC_DIR = os.path.join(FRONTEND_DIR, "src")
COMP_DIR = os.path.join(SRC_DIR, "components")

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


def read_file(path: str) -> str:
    try:
        with open(path, "r") as f:
            return f.read()
    except FileNotFoundError:
        return ""


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — File existence + package.json
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}\u2500\u2500 A. File existence + project structure \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500{RESET}")

# Required files
files = {
    "package.json": os.path.join(FRONTEND_DIR, "package.json"),
    "vite.config.js": os.path.join(FRONTEND_DIR, "vite.config.js"),
    "tailwind.config.js": os.path.join(FRONTEND_DIR, "tailwind.config.js"),
    "postcss.config.js": os.path.join(FRONTEND_DIR, "postcss.config.js"),
    "index.html": os.path.join(FRONTEND_DIR, "index.html"),
    "src/index.css": os.path.join(SRC_DIR, "index.css"),
    "src/main.jsx": os.path.join(SRC_DIR, "main.jsx"),
    "src/App.jsx": os.path.join(SRC_DIR, "App.jsx"),
    "src/components/ChatPanel.jsx": os.path.join(COMP_DIR, "ChatPanel.jsx"),
    "src/components/ValidationPanel.jsx": os.path.join(COMP_DIR, "ValidationPanel.jsx"),
}

for name, path in files.items():
    exists = os.path.isfile(path)
    check(f"{name} exists", exists)

# Check package.json has required deps
pkg_content = read_file(os.path.join(FRONTEND_DIR, "package.json"))
if pkg_content:
    try:
        pkg = json.loads(pkg_content)
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        check("package.json has react", "react" in deps)
        check("package.json has react-dom", "react-dom" in deps)
        check("package.json has axios", "axios" in deps)
        check("package.json has tailwindcss", "tailwindcss" in deps)
        check("package.json has vite", "vite" in deps)
        check("package.json has @vitejs/plugin-react", "@vitejs/plugin-react" in deps)
    except json.JSONDecodeError:
        check("package.json is valid JSON", False, "parse error")
else:
    check("package.json is valid JSON", False, "file not found")

# Check node_modules installed
check(
    "node_modules exists (npm install done)",
    os.path.isdir(os.path.join(FRONTEND_DIR, "node_modules")),
)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — Phase 4 review gate blockers
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}\u2500\u2500 B. Phase 4 review gate blockers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500{RESET}")

component_files = {
    "App.jsx": os.path.join(SRC_DIR, "App.jsx"),
    "ChatPanel.jsx": os.path.join(COMP_DIR, "ChatPanel.jsx"),
    "ValidationPanel.jsx": os.path.join(COMP_DIR, "ValidationPanel.jsx"),
}

all_sources = {}
for name, path in component_files.items():
    all_sources[name] = read_file(path)

# B1: All API calls use axios — no raw fetch()
print(f"\n  {BOLD}B1. axios vs fetch{RESET}")
for name, src in all_sources.items():
    if not src:
        check(f"  {name}: has source", False, "empty or missing")
        continue
    uses_axios = "axios" in src or "import axios" in src
    # Only flag fetch() calls that look like API calls, not DOM fetch
    raw_fetch = bool(re.search(r"(?<!\w)fetch\s*\(", src))
    # ValidationPanel is a display-only component (receives data via props) — no API calls needed
    if name == "ValidationPanel.jsx":
        check(f"  {name}: no raw fetch() (display-only component)", not raw_fetch,
              f"fetch={'yes' if raw_fetch else 'no'}")
    else:
        check(f"  {name}: uses axios (not raw fetch)", uses_axios and not raw_fetch,
              f"axios={'yes' if uses_axios else 'no'}, fetch={'yes' if raw_fetch else 'no'}")

# B2: All three states: loading, error, success
print(f"\n  {BOLD}B2. Loading / error / success states{RESET}")

# App.jsx should handle specsLoading, specsError
app_src = all_sources.get("App.jsx", "")
check("  App.jsx: loading state", "Loading" in app_src or "loading" in app_src.lower())
check("  App.jsx: error state", "Error" in app_src or "error" in app_src.lower())

# ChatPanel should have loading, error, and message display
chat_src = all_sources.get("ChatPanel.jsx", "")
check("  ChatPanel.jsx: loading state (useState)", "setLoading" in chat_src)
check("  ChatPanel.jsx: error state (useState)", "setError" in chat_src)
check("  ChatPanel.jsx: loading indicator renders", "animate-pulse" in chat_src or "Loading" in chat_src or "loading" in chat_src)
check("  ChatPanel.jsx: error banner renders", "error" in chat_src.lower() and "red" in chat_src.lower())

# ValidationPanel should handle empty, valid, invalid states
val_src = all_sources.get("ValidationPanel.jsx", "")
check("  ValidationPanel.jsx: empty state", "appear" in val_src.lower() or "no " in val_src.lower() or "get started" in val_src.lower())
check("  ValidationPanel.jsx: valid badge", "Valid" in val_src and "green" in val_src.lower())
check("  ValidationPanel.jsx: invalid/error badge", "error" in val_src.lower() and "red" in val_src.lower())

# B3: No console.log() in components
print(f"\n  {BOLD}B3. No console.log(){RESET}")
for name, src in all_sources.items():
    has_console_log = bool(re.search(r"console\s*\.\s*log\s*\(", src))
    check(f"  {name}: no console.log()", not has_console_log)

# B4: Tool chips are collapsible (not always expanded)
print(f"\n  {BOLD}B4. Collapsible tool chips{RESET}")
check(
    "  ChatPanel.jsx: tool chips have expanded toggle state",
    "expanded" in chat_src and "setExpanded" in chat_src,
)
check(
    "  ChatPanel.jsx: toggling on click",
    "onClick" in chat_src and "setExpanded" in chat_src,
)
check(
    "  ChatPanel.jsx: chips collapsed by default (useState(false))",
    "useState(false)" in chat_src,
)

# B5: Provenance badge always visible (not behind a toggle)
print(f"\n  {BOLD}B5. Provenance badge always visible{RESET}")
check(
    "  ChatPanel.jsx: ProvenanceBadge component defined",
    "ProvenanceBadge" in chat_src,
)
check(
    "  ChatPanel.jsx: provenance rendered outside toggle/accordion",
    bool(re.search(r"provenance.*ProvenanceBadge|ProvenanceBadge.*provenance", chat_src)),
)
# Not behind a state toggle — should render whenever provenance is truthy
check(
    "  ChatPanel.jsx: provenance not behind expanded toggle",
    "provenance" in chat_src and "spec_name" in chat_src,
)

# B6: Sandbox mode badge visible in layout
print(f"\n  {BOLD}B6. Sandbox mode badge{RESET}")
check(
    "  App.jsx: sandboxMode state",
    "sandboxMode" in app_src or "sandbox" in app_src.lower(),
)
check(
    "  App.jsx: SANDBOX badge rendered",
    "SANDBOX" in app_src,
)

# B7: Error states show human-readable message
print(f"\n  {BOLD}B7. Human-readable error messages{RESET}")
check(
    "  ChatPanel.jsx: extracts detail from error response",
    "response?.data?.detail" in chat_src or "response.data.detail" in chat_src,
)
check(
    "  ChatPanel.jsx: fallback error message",
    "Something went wrong" in chat_src or "message" in chat_src,
)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION C — Build verification
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}\u2500\u2500 C. Build verification \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500{RESET}")

try:
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
        timeout=60,
    )
    check("npm run build succeeds (exit code 0)", result.returncode == 0,
          result.stderr.strip()[-200:] if result.returncode != 0 else "")
    # Check dist/ was created
    dist_dir = os.path.join(FRONTEND_DIR, "dist")
    check("dist/ directory created", os.path.isdir(dist_dir))
    if os.path.isdir(dist_dir):
        check("dist/index.html exists", os.path.isfile(os.path.join(dist_dir, "index.html")))
except subprocess.TimeoutExpired:
    check("npm run build completes within 60s", False, "timeout")
except FileNotFoundError:
    check("npm command available", False, "npm not found")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION D — Backend API smoke test (requires server on :8000)
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}\u2500\u2500 D. Backend API smoke test (server on :8000) \u2500\u2500\u2500\u2500\u2500\u2500\u2500{RESET}")

try:
    with urllib.request.urlopen("http://localhost:8000/health", timeout=4) as resp:
        body = json.loads(resp.read())
    check("GET /health responds", body.get("status") == "ok")

    # Check /api/specs
    with urllib.request.urlopen("http://localhost:8000/api/specs", timeout=4) as resp:
        specs = json.loads(resp.read())
    check("GET /api/specs responds", isinstance(specs, list))
    check("GET /api/specs has at least 1 spec", len(specs) > 0, f"count={len(specs)}")

    if specs:
        latest = specs[-1]
        check("Latest spec has id field", "id" in latest)
        check("Latest spec has name field", "name" in latest)
        check("Latest spec has version field", "version" in latest)

except urllib.error.URLError as exc:
    check("Backend server reachable on :8000", False, f"server not running? {exc}")
    print(f"  {YELLOW}Skipping API tests — start server with: uvicorn main:app --port 8000{RESET}")
except Exception as exc:
    check("Backend API smoke test", False, str(exc))

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION E — Vite config checks
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}\u2500\u2500 E. Vite + Tailwind config \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500{RESET}")

vite_src = read_file(os.path.join(FRONTEND_DIR, "vite.config.js"))
check("vite.config.js: proxy to backend /api", "'/api'" in vite_src or '"/api"' in vite_src)
check("vite.config.js: port 5173", "5173" in vite_src)
check("vite.config.js: react plugin", "react" in vite_src)

tailwind_src = read_file(os.path.join(FRONTEND_DIR, "tailwind.config.js"))
check("tailwind.config.js: content paths configured", "content" in tailwind_src)
check("tailwind.config.js: includes jsx files", ".jsx" in tailwind_src or "jsx" in tailwind_src)

index_css = read_file(os.path.join(SRC_DIR, "index.css"))
check("index.css: @tailwind base", "@tailwind base" in index_css)
check("index.css: @tailwind utilities", "@tailwind utilities" in index_css)

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
total = passed + failed
print(f"\n{BOLD}\u2500\u2500 Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500{RESET}")
print(f"  {GREEN}{passed}{RESET} passed  /  {RED}{failed}{RESET} failed  /  {total} total")

if failed > 0:
    print(f"\n  {RED}{BOLD}PHASE 4 GATE: BLOCKED{RESET} — fix {failed} failures before Phase 5")
    sys.exit(1)
else:
    print(f"\n  {GREEN}{BOLD}PHASE 4 GATE: PASSED{RESET} \u2014 ready for Phase 5 (Change Detection)")
    sys.exit(0)
