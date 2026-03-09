# MCP tool: search_endpoints — vector similarity search over ingested spec endpoints

import asyncio
import logging
import time
from typing import Optional

from pydantic import BaseModel

from ingestion.embedder import embed_single
from storage.schema_store import log_audit
from storage.vector_store import cosine_search

logger = logging.getLogger(__name__)


# ── Pydantic model (canonical from CLAUDE.md) ─────────────────────────────────

class EndpointSummary(BaseModel):
    operation_id: str
    method: str
    path: str
    summary: Optional[str]
    score: float


# ── Tool implementation ────────────────────────────────────────────────────────

async def search_endpoints(
    query: str,
    spec_id: int,
    limit: int = 5,
) -> list[EndpointSummary]:
    """
    Embed `query` with Voyage AI voyage-4, run cosine search against pgvector,
    return the top-N matching endpoints as EndpointSummary objects.
    Every call is logged to audit_logs.
    """
    start = time.perf_counter()
    results: list[EndpointSummary] = []
    error: Optional[str] = None

    try:
        embedding = await asyncio.to_thread(embed_single, query, "query")
        rows = await asyncio.to_thread(cosine_search, embedding, spec_id, limit)
        results = [
            EndpointSummary(
                operation_id=row["operation_id"],
                method=row["method"],
                path=row["path"],
                summary=row["summary"],
                score=row["score"],
            )
            for row in rows
        ]
        logger.info(
            f"search_endpoints spec_id={spec_id} query={query!r} → {len(results)} results"
        )
        return results
    except Exception as exc:
        error = type(exc).__name__
        logger.error(f"search_endpoints failed: {exc}", exc_info=True)
        raise
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        log_audit(
            tool_name="search_endpoints",
            inputs={"query": query, "spec_id": spec_id, "limit": limit},
            outputs={
                "count": len(results),
                "top_score": results[0].score if results else None,
                "error": error,
            },
            spec_id=spec_id,
            duration_ms=duration_ms,
        )
