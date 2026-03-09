#!/usr/bin/env bash
# =============================================================================
# Self-Aware API Platform — Master Management Script
# =============================================================================
# Usage:
#   ./deploy/manage.sh start         Start backend and frontend
#   ./deploy/manage.sh stop          Stop all running services
#   ./deploy/manage.sh restart       Stop then start all services
#   ./deploy/manage.sh status        Show which services are running
#   ./deploy/manage.sh logs [svc]    Tail logs (backend|frontend|all)
#   ./deploy/manage.sh clean-db      Wipe demo data, reset sequences (keeps schema)
#   ./deploy/manage.sh demo-reset    clean-db + start (one-command demo prep)
# =============================================================================

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOGS_DIR="$SCRIPT_DIR/logs"
PIDS_DIR="$SCRIPT_DIR/pids"
DB_CLEAN_SQL="$SCRIPT_DIR/db-clean.sql"

BACKEND_PID="$PIDS_DIR/backend.pid"
FRONTEND_PID="$PIDS_DIR/frontend.pid"

BACKEND_LOG="$LOGS_DIR/backend.log"
FRONTEND_LOG="$LOGS_DIR/frontend.log"

# ── Ports ──────────────────────────────────────────────────────────────────
BACKEND_PORT=8000
FRONTEND_PORT=5173

# ── DB connection (reads from .env if present) ─────────────────────────────
ENV_FILE="$BACKEND_DIR/.env"
DB_NAME="selfaware_api"
DB_HOST="localhost"
DB_PORT="5432"

if [[ -f "$ENV_FILE" ]]; then
  # Extract DATABASE_URL components if set
  RAW_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
  if [[ -n "$RAW_URL" ]]; then
    # postgresql://user:pass@host:port/dbname  OR  postgresql://host:port/dbname
    DB_NAME=$(echo "$RAW_URL" | sed 's|.*\/||')
    DB_HOST=$(echo "$RAW_URL" | sed 's|postgresql://||' | sed 's|.*@||' | cut -d: -f1 | cut -d/ -f1)
    DB_PORT=$(echo "$RAW_URL" | sed 's|postgresql://||' | sed 's|.*@||' | cut -d: -f2 | cut -d/ -f1)
    DB_PORT=${DB_PORT:-5432}
    # Guard: if parsing produced a non-numeric value (e.g. user@host/db with no port)
    [[ "$DB_PORT" =~ ^[0-9]+$ ]] || DB_PORT=5432
  fi
fi

PSQL_CMD=(psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME")

# ── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ────────────────────────────────────────────────────────────────
log()     { echo -e "${CYAN}[manage]${RESET} $*"; }
ok()      { echo -e "${GREEN}[  OK  ]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[ WARN ]${RESET} $*"; }
err()     { echo -e "${RED}[ ERR  ]${RESET} $*" >&2; }
section() { echo -e "\n${BOLD}── $* ──${RESET}"; }

mkdir -p "$LOGS_DIR" "$PIDS_DIR"

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

check_svc() {
  local label="$1" pid_file="$2" port="$3"
  if is_running "$pid_file"; then
    printf "  ${GREEN}%-12s${RESET} %-8s port %s  pid %s\n" \
      "$label" "RUNNING" "$port" "$(cat "$pid_file")"
  elif lsof -i ":$port" -sTCP:LISTEN -t &>/dev/null; then
    printf "  ${YELLOW}%-12s${RESET} %-8s port %s  (unmanaged process)\n" \
      "$label" "UP*" "$port"
  else
    printf "  ${RED}%-12s${RESET} %-8s port %s\n" \
      "$label" "STOPPED" "$port"
  fi
}

wait_for_port() {
  local port="$1" label="$2" retries=20
  for ((i=1; i<=retries; i++)); do
    if lsof -i ":$port" -sTCP:LISTEN -t &>/dev/null; then
      ok "$label is up on port $port"
      return 0
    fi
    sleep 0.5
  done
  warn "$label did not become ready on port $port within ${retries} attempts"
  return 1
}

stop_service() {
  local pid_file="$1" label="$2"
  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    kill "$pid" 2>/dev/null && ok "Stopped $label (pid $pid)" || warn "Could not kill $label (pid $pid)"
    sleep 0.3
    rm -f "$pid_file"
  else
    warn "$label is not running (no pid file or stale)"
    rm -f "$pid_file"
  fi
}

# ── Command: start ─────────────────────────────────────────────────────────
cmd_start() {
  section "Starting Self-Aware API Platform"

  # ── Backend ──────────────────────────────────────────────────────────────
  if is_running "$BACKEND_PID"; then
    warn "Backend already running (pid $(cat "$BACKEND_PID")). Skipping."
  else
    log "Starting FastAPI backend on port $BACKEND_PORT..."
    [[ -f "$BACKEND_DIR/.env" ]] || warn "backend/.env not found — app may fail to start (missing API keys)"
    local uvicorn_bin="$BACKEND_DIR/.venv/bin/uvicorn"
    if [[ ! -x "$uvicorn_bin" ]]; then
      err "uvicorn not found at $uvicorn_bin. Run: cd backend && uv pip install -r requirements.txt"
      exit 1
    fi
    (
      cd "$BACKEND_DIR"
      VIRTUAL_ENV="$BACKEND_DIR/.venv"
      export VIRTUAL_ENV
      PATH="$VIRTUAL_ENV/bin:$PATH"
      export PATH
      "$uvicorn_bin" main:app --reload \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --log-level info \
        > "$BACKEND_LOG" 2>&1 &
      echo $! > "$BACKEND_PID"
    )
    wait_for_port "$BACKEND_PORT" "Backend" || true
  fi

  # ── Frontend ─────────────────────────────────────────────────────────────
  if is_running "$FRONTEND_PID"; then
    warn "Frontend already running (pid $(cat "$FRONTEND_PID")). Skipping."
  else
    log "Starting React/Vite frontend on port $FRONTEND_PORT..."
    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
      err "node_modules missing. Run: cd frontend && npm install"
      exit 1
    fi
    (
      cd "$FRONTEND_DIR"
      npx vite --port "$FRONTEND_PORT" --host \
        > "$FRONTEND_LOG" 2>&1 &
      echo $! > "$FRONTEND_PID"
    )
    wait_for_port "$FRONTEND_PORT" "Frontend" || true
  fi

  section "All services launched"
  cmd_status
  echo ""
  echo -e "  ${BOLD}Frontend:${RESET}  ${GREEN}http://localhost:$FRONTEND_PORT${RESET}"
  echo -e "  ${BOLD}Backend:${RESET}   ${GREEN}http://localhost:$BACKEND_PORT${RESET}"
  echo -e "  ${BOLD}API Docs:${RESET}  ${GREEN}http://localhost:$BACKEND_PORT/docs${RESET}"
  echo ""
}

# ── Command: stop ──────────────────────────────────────────────────────────
cmd_stop() {
  section "Stopping all services"
  local pids
  stop_service "$BACKEND_PID"  "Backend"
  stop_service "$FRONTEND_PID" "Frontend"

  # Belt-and-suspenders: kill anything still holding the ports
  for port in $BACKEND_PORT $FRONTEND_PORT; do
    pids=$(lsof -i ":$port" -sTCP:LISTEN -t 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      warn "Port $port still in use by pids [$pids] — sending SIGTERM"
      kill $pids 2>/dev/null || true
    fi
  done
  ok "All services stopped."
}

# ── Command: status ────────────────────────────────────────────────────────
cmd_status() {
  section "Service Status"
  local fmt="  %-12s %-8s %s\n"
  printf "$fmt" "SERVICE" "STATUS" "PORT / PID"

  check_svc "Backend"  "$BACKEND_PID"  "$BACKEND_PORT"
  check_svc "Frontend" "$FRONTEND_PID" "$FRONTEND_PORT"

  # PostgreSQL
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; then
    printf "  ${GREEN}%-12s${RESET} %-8s %s:%s/%s\n" \
      "PostgreSQL" "RUNNING" "$DB_HOST" "$DB_PORT" "$DB_NAME"
  else
    printf "  ${RED}%-12s${RESET} %-8s %s:%s\n" \
      "PostgreSQL" "STOPPED" "$DB_HOST" "$DB_PORT"
  fi
}

# ── Command: logs ──────────────────────────────────────────────────────────
cmd_logs() {
  local target="${1:-all}"
  case "$target" in
    backend)
      [[ -f "$BACKEND_LOG" ]] || { err "No log yet for backend — has it been started?"; exit 1; }
      tail -f "$BACKEND_LOG"
      ;;
    frontend)
      [[ -f "$FRONTEND_LOG" ]] || { err "No log yet for frontend — has it been started?"; exit 1; }
      tail -f "$FRONTEND_LOG"
      ;;
    all)
      section "Tailing all logs (Ctrl+C to exit)"
      for _log in "$BACKEND_LOG" "$FRONTEND_LOG"; do
        [[ -f "$_log" ]] || { warn "Log file missing, skipping: $_log"; }
      done
      tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null || true
      ;;
    *)
      err "Unknown service '$target'. Use: backend | frontend | all"
      exit 1
      ;;
  esac
}

# ── Command: clean-db ──────────────────────────────────────────────────────
cmd_clean_db() {
  section "Database Cleanup (data only — schema preserved)"
  if [[ ! -f "$DB_CLEAN_SQL" ]]; then
    err "Cleanup script not found: $DB_CLEAN_SQL"
    exit 1
  fi

  if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; then
    err "PostgreSQL is not running at $DB_HOST:$DB_PORT"
    exit 1
  fi

  read -rp "$(echo -e "${YELLOW}This will delete ALL demo data in '$DB_NAME'. Continue? (y/N): ${RESET}")" confirm
  if [[ "${confirm,,}" != "y" ]]; then
    log "Aborted."
    return 0
  fi

  log "Running $DB_CLEAN_SQL against $DB_NAME..."
  "${PSQL_CMD[@]}" -f "$DB_CLEAN_SQL" && ok "Database cleaned. Ready for a fresh demo run." \
    || { err "Cleanup failed. Check PostgreSQL logs."; exit 1; }
}

# ── Command: clean-db-force (non-interactive, used by demo-reset) ──────────
cmd_clean_db_force() {
  section "Database Cleanup (non-interactive)"
  if [[ ! -f "$DB_CLEAN_SQL" ]]; then
    err "Cleanup script not found: $DB_CLEAN_SQL"
    exit 1
  fi
  if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; then
    err "PostgreSQL is not running at $DB_HOST:$DB_PORT"
    exit 1
  fi
  log "Wiping demo data in $DB_NAME..."
  "${PSQL_CMD[@]}" -f "$DB_CLEAN_SQL" && ok "Database cleaned." \
    || { err "Cleanup failed."; exit 1; }
}

# ── Command: restart ───────────────────────────────────────────────────────
cmd_restart() {
  cmd_stop
  sleep 1
  cmd_start
}

# ── Command: demo-reset ────────────────────────────────────────────────────
cmd_demo_reset() {
  section "Demo Reset — clean DB + start all services"
  cmd_clean_db_force
  echo ""
  cmd_start
  echo ""
  ok "Platform is clean and running. Ready for the hackathon demo!"
  echo ""
  echo -e "  ${BOLD}Next steps:${RESET}"
  echo -e "   1. Open ${GREEN}http://localhost:$FRONTEND_PORT${RESET}"
  echo -e "   2. Upload ${BOLD}specs/banking-api-v1.yaml${RESET} via the Spec Uploader"
  echo -e "   3. Ask: \"How do I create a corporate deposit account?\""
  echo -e "   4. Upload ${BOLD}specs/banking-api-v2.yaml${RESET} and click Compare"
  echo -e "   5. Click Generate Migration Plan"
  echo ""
}

# ── Command: help ──────────────────────────────────────────────────────────
cmd_help() {
  echo ""
  echo -e "${BOLD}Self-Aware API Platform — manage.sh${RESET}"
  echo ""
  echo -e "  ${CYAN}./deploy/manage.sh start${RESET}            Start backend and frontend"
  echo -e "  ${CYAN}./deploy/manage.sh stop${RESET}             Stop all running services"
  echo -e "  ${CYAN}./deploy/manage.sh restart${RESET}          Stop then start all services"
  echo -e "  ${CYAN}./deploy/manage.sh status${RESET}           Show service status"
  echo -e "  ${CYAN}./deploy/manage.sh logs [svc]${RESET}       Tail logs (backend|frontend|all)"
  echo -e "  ${CYAN}./deploy/manage.sh clean-db${RESET}         Wipe demo data (interactive confirm)"
  echo -e "  ${CYAN}./deploy/manage.sh demo-reset${RESET}       clean-db + start (full one-command reset)"
  echo ""
}

# ── Entrypoint ─────────────────────────────────────────────────────────────
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  start)      cmd_start ;;
  stop)       cmd_stop ;;
  restart)    cmd_restart ;;
  status)     cmd_status ;;
  logs)       cmd_logs "${1:-all}" ;;
  clean-db)   cmd_clean_db ;;
  demo-reset) cmd_demo_reset ;;
  help|--help|-h) cmd_help ;;
  *)
    err "Unknown command: $COMMAND"
    cmd_help
    exit 1
    ;;
esac
