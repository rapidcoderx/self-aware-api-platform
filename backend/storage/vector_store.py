# pgvector cosine similarity search — canonical query layer

import logging
from typing import Optional

import psycopg2.extensions

from storage.schema_store import get_db

logger = logging.getLogger(__name__)


def cosine_search(
    embedding: list[float],
    spec_id: int,
    limit: int = 5,
    conn: Optional[psycopg2.extensions.connection] = None,
) -> list[dict]:
    """
    Run a cosine similarity search against the endpoints table using pgvector.
    Returns a list of dicts ordered by descending similarity score.
    Each dict has: id, operation_id, method, path, summary, score.
    Accepts an optional `conn` for test injection — uses pool otherwise.
    """
    # pgvector text-literal format required for %s::vector cast
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

    def _run(c) -> list[dict]:
        with c.cursor() as cur:
            cur.execute(
                """
                SELECT id, operation_id, method, path, summary,
                       1 - (embedding <=> %s::vector) AS score
                FROM endpoints
                WHERE spec_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (embedding_str, spec_id, embedding_str, limit),
            )
            rows = cur.fetchall()
        return [
            {
                "id": row[0],
                "operation_id": row[1],
                "method": row[2],
                "path": row[3],
                "summary": row[4],
                "score": float(row[5]),
            }
            for row in rows
        ]

    if conn is not None:
        results = _run(conn)
    else:
        with get_db() as managed_conn:
            results = _run(managed_conn)

    logger.debug(
        f"cosine_search spec_id={spec_id} limit={limit} → {len(results)} results"
    )
    return results


def similarity_search(
    embedding: list[float],
    spec_id: int,
    limit: int = 5,
    conn: Optional[psycopg2.extensions.connection] = None,
) -> list[dict]:
    """
    Canonical public alias for cosine_search — exposed as `similarity_search`
    per the runbook contract. Accepts optional `conn` for test injection.
    """
    return cosine_search(embedding, spec_id, limit, conn)


def fetch_endpoint_row(operation_id: str, spec_id: int) -> Optional[dict]:
    """
    Fetch one endpoint row joined with its spec version.
    Returns dict with all endpoint fields + spec_version, or None if not found.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.id, e.operation_id, e.method, e.path, e.summary,
                       e.tags, e.schema_json, s.version AS spec_version
                FROM endpoints e
                JOIN specs s ON s.id = e.spec_id
                WHERE e.operation_id = %s
                  AND e.spec_id = %s
                LIMIT 1
                """,
                (operation_id, spec_id),
            )
            row = cur.fetchone()

    if not row:
        return None
    return {
        "id": row[0],
        "operation_id": row[1],
        "method": row[2],
        "path": row[3],
        "summary": row[4],
        "tags": row[5] or [],
        "schema_json": row[6],
        "spec_version": row[7],
    }
