#!/bin/bash
clear

# =============================================================================
# Self-Aware API Platform — venv Setup + Dependency Install
# Uses uv with Python 3.12.12
# Run from: ~/self-aware-api-platform/backend  OR anywhere (auto-detects)
# =============================================================================

# Auto-detect project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_DIR/backend" ]; then
  BACKEND_DIR="$SCRIPT_DIR/backend"
elif [ -f "$SCRIPT_DIR/main.py" ]; then
  BACKEND_DIR="$SCRIPT_DIR"
else
  BACKEND_DIR="$HOME/self-aware-api-platform/backend"
fi

PYTHON_VERSION="3.12.12"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- Ensure backend dir + subdirs exist before touching the log file ---
if [ ! -d "$BACKEND_DIR" ]; then
  echo -e "${YELLOW}  ⚠️  ${NC}Backend directory not found — creating project structure now..."
  mkdir -p "$BACKEND_DIR"/{ingestion,storage,tools}
  mkdir -p "$BACKEND_DIR/../frontend/src/components"
  mkdir -p "$BACKEND_DIR/../specs"
  # Touch placeholder files so the project is navigable
  for f in main.py mcp_server.py agent.py requirements.txt; do
    touch "$BACKEND_DIR/$f"
  done
  for f in ingestion/__init__.py ingestion/normalizer.py ingestion/chunker.py ingestion/embedder.py \
            storage/__init__.py storage/schema_store.py storage/vector_store.py storage/init_db.sql \
            tools/__init__.py tools/spec_search.py tools/spec_get.py tools/spec_validate.py \
            tools/spec_diff.py tools/impact_analyze.py; do
    touch "$BACKEND_DIR/$f"
  done
  echo -e "${GREEN}  ✅ ${NC}Project structure created at $BACKEND_DIR"
fi

LOGFILE="$BACKEND_DIR/setup-venv.log"
VENV_DIR="$BACKEND_DIR/.venv"

log()    { echo -e "$1" | tee -a "$LOGFILE"; }
ok()     { log "${GREEN}  ✅ ${NC}$1"; }
info()   { log "${CYAN}  →  ${NC}$1"; }
warn()   { log "${YELLOW}  ⚠️  ${NC}$1"; }
fail()   { log "${RED}  ❌ FATAL:${NC} $1"; exit 1; }
section(){ log "\n${CYAN}${BOLD}── $1 ──────────────────────────────────────────${NC}"; }

echo "" > "$LOGFILE"

log "${BOLD}"
log "============================================================"
log "  Self-Aware API Platform — venv + Deps Setup"
log "  Python: $PYTHON_VERSION (via uv)"
log "  Backend: $BACKEND_DIR"
log "  $(date)"
log "============================================================${NC}"

# ==========================================================================
# 1. Pre-flight
# ==========================================================================
section "1 — PRE-FLIGHT"

ok "Backend directory ready: $BACKEND_DIR"
cd "$BACKEND_DIR"

# Ensure .python-version pin exists
if [ ! -f "$BACKEND_DIR/.python-version" ]; then
  echo "$PYTHON_VERSION" > "$BACKEND_DIR/.python-version"
  ok "Created .python-version → $PYTHON_VERSION"
else
  PINNED=$(cat "$BACKEND_DIR/.python-version")
  ok ".python-version already set: $PINNED"
fi

# Ensure .env.example exists
if [ ! -f "$BACKEND_DIR/.env.example" ]; then
  cat > "$BACKEND_DIR/.env.example" << 'EOF'
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://localhost:5432/selfaware_api
ENVIRONMENT=development
SANDBOX_MODE=true
LOG_LEVEL=info
PRISM_MOCK_URL=http://localhost:4010
EOF
  ok "Created .env.example"
fi

# Create .env from example if missing
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn ".env created from template — add your real API keys to $BACKEND_DIR/.env"
else
  ok ".env exists"
fi

# ==========================================================================
# 2. Check uv
# ==========================================================================
section "2 — UV CHECK"

if ! command -v uv &>/dev/null; then
  warn "uv not found — installing now..."
  curl -LsSf https://astral.sh/uv/install.sh | sh 2>&1 | tee -a "$LOGFILE"
  # Reload PATH for uv
  export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
  if ! command -v uv &>/dev/null; then
    fail "uv install failed. Install manually: https://docs.astral.sh/uv/getting-started/installation/"
  fi
fi
UV_VER=$(uv --version)
ok "uv found: $UV_VER"

# ==========================================================================
# 3. Ensure Python 3.12.12 is available to uv
# ==========================================================================
section "3 — PYTHON $PYTHON_VERSION"

info "Checking uv Python list for $PYTHON_VERSION..."
if uv python list 2>/dev/null | grep -q "3\.12\.12"; then
  ok "Python $PYTHON_VERSION already available in uv"
else
  info "Downloading Python $PYTHON_VERSION via uv..."
  uv python install "$PYTHON_VERSION" 2>&1 | tee -a "$LOGFILE"
fi

# Confirm
RESOLVED=$(uv run --python "$PYTHON_VERSION" python --version 2>/dev/null)
if echo "$RESOLVED" | grep -q "3.12"; then
  ok "Python resolved: $RESOLVED"
else
  fail "Could not resolve Python $PYTHON_VERSION. Check: uv python list"
fi

# ==========================================================================
# 4. Create venv
# ==========================================================================
section "4 — VIRTUAL ENVIRONMENT"

if [ -d "$VENV_DIR" ]; then
  warn "Existing .venv found at $VENV_DIR"
  read -r -p "  Recreate it? [y/N]: " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    rm -rf "$VENV_DIR"
    info "Removed existing .venv"
  else
    info "Keeping existing .venv — will still verify/upgrade deps"
  fi
fi

if [ ! -d "$VENV_DIR" ]; then
  info "Creating .venv with Python $PYTHON_VERSION..."
  uv venv --python "$PYTHON_VERSION" "$VENV_DIR" 2>&1 | tee -a "$LOGFILE"
  ok ".venv created at $VENV_DIR"
fi

# Verify venv Python version
VENV_PY_VER=$("$VENV_DIR/bin/python" --version 2>/dev/null)
if echo "$VENV_PY_VER" | grep -q "3.12"; then
  ok "venv Python: $VENV_PY_VER ✓"
else
  fail "venv Python mismatch: $VENV_PY_VER (expected 3.12.x)"
fi

# ==========================================================================
# 5. Install Dependencies
# ==========================================================================
section "5 — INSTALL DEPENDENCIES"

info "Installing all packages via uv pip (this takes ~60–90 seconds)..."
log ""

uv pip install --python "$VENV_DIR/bin/python" \
  fastapi \
  "uvicorn[standard]" \
  python-dotenv \
  python-multipart \
  prance \
  openapi-spec-validator \
  jsonschema \
  voyageai \
  psycopg2-binary \
  pgvector \
  anthropic \
  mcp \
  httpx \
  pyyaml \
  2>&1 | tee -a "$LOGFILE"

if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  fail "Dependency install failed — check $LOGFILE for details"
fi
ok "All packages installed"

# ==========================================================================
# 6. Freeze requirements.txt
# ==========================================================================
section "6 — FREEZE REQUIREMENTS"

uv pip freeze --python "$VENV_DIR/bin/python" > "$BACKEND_DIR/requirements.txt" 2>&1
FREEZE_COUNT=$(wc -l < "$BACKEND_DIR/requirements.txt" | xargs)
ok "requirements.txt frozen — $FREEZE_COUNT packages"

# ==========================================================================
# 7. Verify Key Imports
# ==========================================================================
section "7 — VERIFY IMPORTS"

PACKAGES=(
  "fastapi:FastAPI"
  "uvicorn:uvicorn"
  "anthropic:Anthropic SDK"
  "voyageai:Voyage AI"
  "pgvector:pgvector"
  "mcp:MCP SDK"
  "prance:prance (OpenAPI resolver)"
  "jsonschema:jsonschema"
  "psycopg2:psycopg2"
  "yaml:PyYAML"
  "dotenv:python-dotenv"
)

ALL_OK=true
for entry in "${PACKAGES[@]}"; do
  PKG="${entry%%:*}"
  LABEL="${entry##*:}"
  if "$VENV_DIR/bin/python" -c "import $PKG" 2>/dev/null; then
    ok "$LABEL"
  else
    warn "IMPORT FAILED: $LABEL (import $PKG)"
    ALL_OK=false
  fi
done

if $ALL_OK; then
  log ""
  log "${GREEN}${BOLD}  All imports verified ✓${NC}"
else
  log ""
  warn "Some imports failed — run: source .venv/bin/activate && pip install <package>"
fi

# ==========================================================================
# 8. Verify API Key Loading
# ==========================================================================
section "8 — API KEY SMOKE TEST"

if [ -f "$BACKEND_DIR/.env" ]; then
  "$VENV_DIR/bin/python" - << PYEOF 2>&1 | tee -a "$LOGFILE"
from dotenv import load_dotenv
import os, sys
load_dotenv("$BACKEND_DIR/.env")
ak = os.getenv("ANTHROPIC_API_KEY", "")
vk = os.getenv("VOYAGE_API_KEY", "")
db = os.getenv("DATABASE_URL", "")
issues = []
if not ak or ak.startswith("sk-ant-xxx"):
    issues.append("ANTHROPIC_API_KEY not set")
if not vk or vk.startswith("pa-xxx"):
    issues.append("VOYAGE_API_KEY not set")
if not db:
    issues.append("DATABASE_URL not set")
if issues:
    for i in issues:
        print(f"  ⚠️  {i}")
    sys.exit(1)
else:
    print(f"  ✅ ANTHROPIC_API_KEY: {ak[:12]}...")
    print(f"  ✅ VOYAGE_API_KEY:    {vk[:8]}...")
    print(f"  ✅ DATABASE_URL:      {db}")
PYEOF
  if [ $? -ne 0 ]; then
    warn "API keys not yet set — edit $BACKEND_DIR/.env before running the app"
  fi
else
  warn ".env file not found at $BACKEND_DIR/.env"
  info "Copy template: cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env"
fi

# ==========================================================================
# SUMMARY
# ==========================================================================
section "SETUP COMPLETE"

log ""
log "${GREEN}${BOLD}  venv ready at: $VENV_DIR${NC}"
log ""
log "  To activate:"
log "  ${BOLD}  source $VENV_DIR/bin/activate${NC}"
log ""
log "  To start backend:"
log "  ${BOLD}  uvicorn main:app --reload --port 8000${NC}"
log ""
log "  To start frontend (separate terminal):"
log "  ${BOLD}  cd $SCRIPT_DIR/frontend && npm run dev${NC}"
log ""
log "  To start Prism mock (separate terminal):"
log "  ${BOLD}  prism mock $SCRIPT_DIR/specs/banking-api-v1.yaml --port 4010${NC}"
log ""
log "  Log saved to: $LOGFILE"
log ""