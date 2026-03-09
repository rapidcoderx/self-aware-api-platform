#!/usr/bin/env bash
# =============================================================================
# Self-Aware API Platform — DB Inspector (demo helper)
# =============================================================================
# Usage:
#   ./deploy/show-db.sh            Show all tables in one view
#   ./deploy/show-db.sh specs      Show specs table only
#   ./deploy/show-db.sh endpoints  Show endpoints table only
#   ./deploy/show-db.sh diffs      Show diffs table only
#   ./deploy/show-db.sh audit      Show audit_logs table only
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"

# ── DB connection (reads from .env if present) ─────────────────────────────
DB_NAME="selfaware_api"
DB_HOST="localhost"
DB_PORT="5432"

if [[ -f "$ENV_FILE" ]]; then
  RAW_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
  if [[ -n "$RAW_URL" ]]; then
    DB_NAME=$(echo "$RAW_URL" | sed 's|.*\/||')
    DB_HOST=$(echo "$RAW_URL" | sed 's|postgresql://||' | sed 's|.*@||' | cut -d: -f1 | cut -d/ -f1)
    DB_PORT=$(echo "$RAW_URL" | sed 's|postgresql://||' | sed 's|.*@||' | cut -d: -f2 | cut -d/ -f1)
    [[ "$DB_PORT" =~ ^[0-9]+$ ]] || DB_PORT=5432
  fi
fi

PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME")

# ── Colours ────────────────────────────────────────────────────────────────
BOLD='\033[1m'
CYAN='\033[0;36m'
RESET='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}━━━  $*  ━━━${RESET}"; }

# ── Checks ─────────────────────────────────────────────────────────────────
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; then
  echo "ERROR: PostgreSQL not running at $DB_HOST:$DB_PORT" >&2
  exit 1
fi

# ── Table printers ─────────────────────────────────────────────────────────
show_specs() {
  header "SPECS  (one row per ingested version)"
  "${PSQL[@]}" <<'SQL'
SELECT
  id,
  name,
  version,
  hash,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS created_at
FROM specs
ORDER BY id;
SQL
}

show_endpoints() {
  header "ENDPOINTS  (one row per operation — embedding stored but hidden)"
  "${PSQL[@]}" <<'SQL'
SELECT
  e.id,
  e.spec_id,
  s.name   AS spec_name,
  s.version,
  e.method,
  e.path,
  e.operation_id,
  left(e.summary, 60) AS summary
FROM endpoints e
JOIN specs s ON s.id = e.spec_id
ORDER BY e.spec_id, e.id;
SQL
}

show_diffs() {
  header "DIFFS  (breaking-change records)"
  "${PSQL[@]}" <<'SQL'
SELECT
  d.id,
  s_old.name || ' v' || s_old.version AS old_spec,
  s_new.name || ' v' || s_new.version AS new_spec,
  d.breaking_count,
  jsonb_array_length(d.diff_json) AS total_changes,
  to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS created_at
FROM diffs d
JOIN specs s_old ON s_old.id = d.spec_id_old
JOIN specs s_new ON s_new.id = d.spec_id_new
ORDER BY d.id;
SQL

  # Show each breaking change inline when diffs exist
  "${PSQL[@]}" <<'SQL'
SELECT
  d.id                          AS diff_id,
  item->>'operation_id'         AS operation_id,
  item->>'change_type'          AS change_type,
  item->>'field'                AS field,
  item->>'old_value'            AS old_value,
  item->>'new_value'            AS new_value,
  (item->>'breaking')::boolean  AS breaking
FROM diffs d,
     jsonb_array_elements(d.diff_json) AS item
ORDER BY d.id, breaking DESC;
SQL
}

show_audit() {
  header "AUDIT LOGS  (last 20 tool calls)"
  "${PSQL[@]}" <<'SQL'
SELECT
  id,
  tool_name,
  spec_id,
  duration_ms,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS created_at,
  left(outputs::text, 80) AS outputs_preview
FROM audit_logs
ORDER BY id DESC
LIMIT 20;
SQL
}

show_counts() {
  header "ROW COUNTS"
  "${PSQL[@]}" <<'SQL'
SELECT
  'specs'      AS "table", count(*) AS rows FROM specs
UNION ALL SELECT 'endpoints', count(*) FROM endpoints
UNION ALL SELECT 'diffs',     count(*) FROM diffs
UNION ALL SELECT 'audit_logs',count(*) FROM audit_logs
ORDER BY "table";
SQL
}

# ── Dispatch ───────────────────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
  specs)     show_specs ;;
  endpoints) show_endpoints ;;
  diffs)     show_diffs ;;
  audit)     show_audit ;;
  all)
    show_counts
    show_specs
    show_endpoints
    show_diffs
    show_audit
    echo ""
    ;;
  *)
    echo "Usage: $0 [all|specs|endpoints|diffs|audit]" >&2
    exit 1
    ;;
esac
