-- =============================================================================
-- Self-Aware API Platform — Demo Data Cleanup
-- Data only — DDL / schema / extensions are NOT touched
-- =============================================================================
-- Run via:
--   psql -h localhost -p 5432 -d selfaware_api -f deploy/db-clean.sql
-- Or via the management script:
--   ./deploy/manage.sh clean-db
-- =============================================================================

BEGIN;

-- CASCADE propagates truncation to all FK-referencing tables in dependency order

TRUNCATE TABLE
    audit_logs,
    diffs,
    endpoints,
    specs
RESTART IDENTITY
CASCADE;

COMMIT;

-- Confirm row counts (should all be 0)
SELECT
    'specs'      AS "table", COUNT(*) AS "rows" FROM specs
UNION ALL
SELECT
    'endpoints'  AS "table", COUNT(*) AS "rows" FROM endpoints
UNION ALL
SELECT
    'diffs'      AS "table", COUNT(*) AS "rows" FROM diffs
UNION ALL
SELECT
    'audit_logs' AS "table", COUNT(*) AS "rows" FROM audit_logs
ORDER BY 1;
