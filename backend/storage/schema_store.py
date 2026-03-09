# TODO-1: DB connection + schema verify ✅
# TODO-2: upsert_spec — auto-increment version, idempotent on same hash
# TODO-3: insert_endpoint — batch-friendly, pgvector cast
# TODO-4: list_specs / get_spec_by_id helpers
# TODO-5: log_audit — write every MCP tool call to audit_logs

import json
import hashlib
import logging
import os
import re
import threading
from contextlib import contextmanager
from typing import Generator, Optional

import psycopg2
import psycopg2.errors
import psycopg2.pool
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None
_pool_lock: threading.Lock = threading.Lock()


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    """Thread-safe lazy pool initialisation."""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:  # double-checked locking
                database_url = os.getenv("DATABASE_URL", "postgresql://localhost:5432/selfaware_api")
                _pool = psycopg2.pool.ThreadedConnectionPool(2, 10, database_url)
                logger.info("DB connection pool initialised")
    return _pool


@contextmanager
def get_db() -> Generator[psycopg2.extensions.connection, None, None]:
    """Context manager / FastAPI dependency for DB connections."""
    conn = _get_pool().getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)


# Runbook alias — get_db_connection() is the name used in exit checks
get_db_connection = get_db


def verify_schema() -> bool:
    """Verify all required tables exist. Returns True if schema is OK."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ANY(%s)
            """, (["specs", "endpoints", "diffs", "audit_logs"],))
            found = {row[0] for row in cur.fetchall()}
            required = {"specs", "endpoints", "diffs", "audit_logs"}
            missing = required - found
            if missing:
                logger.error(f"Missing DB tables: {missing}")
                return False
            logger.info("DB schema verified — all tables present")
            return True


def compute_hash(spec_json: dict) -> str:
    content = json.dumps(spec_json, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()


def upsert_spec(name: str, spec_json: dict) -> tuple[int, int, bool]:
    """
    Insert a new spec version. Auto-increments version for same name.
    Returns (spec_id, version, is_new).
    is_new=False means identical hash already exists — no re-embedding needed.
    Retries once on UNIQUE(name, version) race to handle concurrent uploads.
    """
    hash_val = compute_hash(spec_json)
    for attempt in range(2):  # retry once on version collision
        with get_db() as conn:
            with conn.cursor() as cur:
                # Idempotent: same hash → return existing
                cur.execute("SELECT id, version FROM specs WHERE hash = %s", (hash_val,))
                existing = cur.fetchone()
                if existing:
                    logger.info(f"Spec '{name}' already stored (hash match), spec_id={existing[0]}")
                    return existing[0], existing[1], False

                # Auto-increment version
                cur.execute(
                    "SELECT COALESCE(MAX(version), 0) + 1 FROM specs WHERE name = %s",
                    (name,),
                )
                next_version: int = cur.fetchone()[0]

                try:
                    cur.execute(
                        """
                        INSERT INTO specs (name, version, spec_json, hash)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                        """,
                        (name, next_version, json.dumps(spec_json), hash_val),
                    )
                    spec_id: int = cur.fetchone()[0]
                    conn.commit()
                    logger.info(f"Spec '{name}' v{next_version} stored — spec_id={spec_id}")
                    return spec_id, next_version, True
                except psycopg2.errors.UniqueViolation:
                    conn.rollback()
                    if attempt == 1:
                        raise  # both attempts failed — genuine conflict
                    logger.warning(f"Version collision for '{name}' v{next_version}, retrying")
    # unreachable — loop always returns or raises
    raise RuntimeError("upsert_spec: exhausted retry loop")


def insert_endpoint(
    spec_id: int,
    operation_id: str,
    method: str,
    path: str,
    summary: Optional[str],
    tags: list[str],
    schema_json: dict,
    embedding: list[float],
) -> int:
    """Insert one endpoint row with its pgvector embedding. Returns new row id."""
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO endpoints
                    (spec_id, operation_id, method, path, summary, tags, schema_json, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                RETURNING id
                """,
                (
                    spec_id,
                    operation_id,
                    method,
                    path,
                    summary,
                    tags,
                    json.dumps(schema_json),
                    embedding_str,
                ),
            )
            endpoint_id: int = cur.fetchone()[0]
            conn.commit()
            return endpoint_id


def bulk_insert_endpoints(
    spec_id: int,
    endpoints: list[dict],
    embeddings: list[list[float]],
) -> None:
    """
    Insert all endpoints for a spec in a single DB connection + single commit.
    Each entry in `endpoints` must be a canonical endpoint dict from normalizer.
    `embeddings` must be parallel to `endpoints`.
    """
    rows = [
        (
            spec_id,
            ep["operation_id"],
            ep["method"],
            ep["path"],
            ep.get("summary"),
            ep.get("tags", []),
            json.dumps(ep["schema_json"]),
            "[" + ",".join(str(v) for v in emb) + "]",
        )
        for ep, emb in zip(endpoints, embeddings)
    ]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO endpoints
                    (spec_id, operation_id, method, path, summary, tags, schema_json, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                """,
                rows,
            )
        conn.commit()
    logger.info(f"Bulk inserted {len(rows)} endpoints for spec_id={spec_id}")


def delete_spec(spec_id: int) -> None:
    """Delete a spec row (and cascade-delete its endpoints). Used for orphan cleanup."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM specs WHERE id = %s", (spec_id,))
        conn.commit()
    logger.info(f"Deleted orphaned spec spec_id={spec_id}")


def get_spec_by_id(spec_id: int) -> Optional[dict]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, version, spec_json FROM specs WHERE id = %s",
                (spec_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"id": row[0], "name": row[1], "version": row[2], "spec_json": row[3]}


def list_specs() -> list[dict]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, version, hash, created_at FROM specs ORDER BY name, version"
            )
            return [
                {
                    "id": r[0],
                    "name": r[1],
                    "version": r[2],
                    "hash": r[3],
                    "created_at": r[4].isoformat(),
                }
                for r in cur.fetchall()
            ]


_SENSITIVE_KEY_RE = re.compile(
    r"password|secret|\btoken\b|api[_-]?key|authorization|\bauth\b", re.IGNORECASE
)


def _sanitise(data: dict) -> dict:
    """Recursively redact values whose key matches known sensitive patterns."""
    out: dict = {}
    for k, v in data.items():
        if _SENSITIVE_KEY_RE.search(str(k)):
            out[k] = "[REDACTED]"
        elif isinstance(v, dict):
            out[k] = _sanitise(v)
        elif isinstance(v, list):
            out[k] = [_sanitise(item) if isinstance(item, dict) else item for item in v]
        else:
            out[k] = v
    return out


def log_audit(
    tool_name: str,
    inputs: dict,
    outputs: dict,
    spec_id: Optional[int],
    duration_ms: int,
) -> None:
    """Write one audit log entry. Never raises — failure is logged and swallowed."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_logs (tool_name, inputs, outputs, spec_id, duration_ms)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        tool_name,
                        json.dumps(_sanitise(inputs)),
                        json.dumps(_sanitise(outputs)),
                        spec_id,
                        duration_ms,
                    ),
                )
                conn.commit()
    except Exception as e:
        logger.error(f"Audit log write failed: {e}")


def save_diff(
    old_spec_id: int,
    new_spec_id: int,
    diffs: list[dict],
    breaking_count: int,
) -> int:
    """Persist a computed diff to the diffs table. Returns the new diff_id."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO diffs (spec_id_old, spec_id_new, diff_json, breaking_count)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (old_spec_id, new_spec_id, json.dumps(diffs), breaking_count),
            )
            diff_id: int = cur.fetchone()[0]
        conn.commit()
    logger.info(
        f"Saved diff id={diff_id} old={old_spec_id} new={new_spec_id} breaking={breaking_count}"
    )
    return diff_id


def get_diff_by_id(diff_id: int) -> Optional[dict]:
    """Load a diff record from the diffs table. Returns None if not found."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, spec_id_old, spec_id_new, diff_json, breaking_count
                FROM diffs
                WHERE id = %s
                """,
                (diff_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "spec_id_old": row[1],
        "spec_id_new": row[2],
        "diff_json": row[3],
        "breaking_count": row[4],
    }


def list_audit_logs(limit: int = 20) -> list[dict]:
    """Return the most recent audit_log entries, newest-first."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, tool_name, inputs, outputs, spec_id, duration_ms, created_at
                FROM audit_logs
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [
                {
                    "id": r[0],
                    "tool_name": r[1],
                    "inputs": r[2],
                    "outputs": r[3],
                    "spec_id": r[4],
                    "duration_ms": r[5],
                    "created_at": r[6].isoformat() if r[6] else None,
                }
                for r in cur.fetchall()
            ]
