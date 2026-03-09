# MCP tool: analyze_impact — map breaking diff changes to downstream services
# Loads specs/dependencies.yaml, never hardcodes service names

import asyncio
import logging
import os
import time
from typing import Optional

import yaml
from pydantic import BaseModel

from storage.schema_store import get_diff_by_id, log_audit
from tools.spec_diff import DiffItem

logger = logging.getLogger(__name__)

# Path to dependency graph — relative to project root (two levels up from this file)
_DEPS_PATH = os.path.join(
    os.path.dirname(__file__),  # backend/tools/
    "..",                        # backend/
    "..",                        # project root
    "specs",
    "dependencies.yaml",
)


class ImpactItem(BaseModel):
    operation_id: str
    affected_service: str
    team: str
    severity: str  # HIGH | MEDIUM | LOW
    breaking_changes: list[DiffItem]


def _load_dependencies() -> dict:
    """Load and return the dependency graph from specs/dependencies.yaml."""
    path = os.path.normpath(_DEPS_PATH)
    with open(path) as f:
        return yaml.safe_load(f)


async def analyze_impact(diff_id: int) -> list[ImpactItem]:
    """
    Load breaking changes from diffs table for diff_id, then cross-reference
    against specs/dependencies.yaml to produce a list of ImpactItem records —
    one per (operation_id, affected_service) pair.

    Every call is logged to audit_logs.
    """
    start = time.perf_counter()
    impacts: list[ImpactItem] = []

    try:
        # Load the diff record
        record = await asyncio.to_thread(get_diff_by_id, diff_id)
        if record is None:
            raise ValueError(f"diff_id={diff_id} not found in diffs table")

        diff_items = [DiffItem(**d) for d in record["diff_json"]]
        breaking = [d for d in diff_items if d.breaking]

        if not breaking:
            logger.info("analyze_impact: no breaking changes in diff_id=%d", diff_id)
            return impacts

        # Load dependency graph
        deps = await asyncio.to_thread(_load_dependencies)

        # Group breaking changes by operation_id
        by_op: dict[str, list[DiffItem]] = {}
        for item in breaking:
            by_op.setdefault(item.operation_id, []).append(item)

        # For each affected operation, look up downstream services
        for op_id, breaking_items in by_op.items():
            consumers = deps.get(op_id, [])
            for consumer in consumers:
                impacts.append(
                    ImpactItem(
                        operation_id=op_id,
                        affected_service=consumer["service"],
                        team=consumer["team"],
                        severity=consumer["severity"],
                        breaking_changes=breaking_items,
                    )
                )

        logger.info(
            "analyze_impact diff_id=%d: %d breaking changes → %d service impacts",
            diff_id,
            len(breaking),
            len(impacts),
        )

    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        log_audit(
            tool_name="analyze_impact",
            inputs={"diff_id": diff_id},
            outputs={"impact_count": len(impacts)},
            spec_id=None,
            duration_ms=duration_ms,
        )

    return impacts