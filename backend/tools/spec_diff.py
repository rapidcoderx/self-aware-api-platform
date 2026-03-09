# MCP tool: diff_specs — compare requestBody schemas between two spec versions
# Classifies changes as BREAKING or NON_BREAKING using canonical change_type values

import asyncio
import logging
import time
from typing import Optional

from pydantic import BaseModel

from storage.schema_store import get_db, log_audit

logger = logging.getLogger(__name__)


# ── Pydantic model (canonical from CLAUDE.md) ────────────────────────────────

class DiffItem(BaseModel):
    operation_id: str
    method: str
    path: str
    breaking: bool
    change_type: str  # FIELD_ADDED | FIELD_REMOVED | ENDPOINT_REMOVED | TYPE_CHANGED | ENUM_CHANGED | REQUIRED_ADDED
    field: str
    old_value: Optional[str]
    new_value: Optional[str]


# ── Tool implementation ────────────────────────────────────────────────────────

async def diff_specs(old_spec_id: int, new_spec_id: int) -> list[DiffItem]:
    """
    Compare requestBody schemas for all operations between two spec versions.
    Classifies each change as BREAKING (breaking=True) or NON_BREAKING (breaking=False).

    Change types:
    - REQUIRED_ADDED : field newly added to "required" list — BREAKING
    - FIELD_REMOVED  : field dropped from "properties" — BREAKING
    - TYPE_CHANGED   : field type changed — BREAKING
    - ENUM_CHANGED   : enum values changed — BREAKING if any value removed, else NON_BREAKING
    - FIELD_ADDED    : new optional field — NON_BREAKING

    Every call is logged to audit_logs.
    """
    start = time.perf_counter()
    diffs: list[DiffItem] = []

    try:
        old_endpoints = await asyncio.to_thread(_fetch_endpoints_for_spec, old_spec_id)
        new_endpoints = await asyncio.to_thread(_fetch_endpoints_for_spec, new_spec_id)

        # Compare operations present in the old spec
        for op_id, old_ep in old_endpoints.items():
            new_ep = new_endpoints.get(op_id)
            if new_ep is None:
                # Entire operation removed — BREAKING
                diffs.append(
                    DiffItem(
                        operation_id=op_id,
                        method=old_ep["method"],
                        path=old_ep["path"],
                        breaking=True,
                        change_type="ENDPOINT_REMOVED",
                        field="(endpoint)",
                        old_value="exists",
                        new_value=None,
                    )
                )
                continue

            old_schema: Optional[dict] = old_ep["schema_json"].get("requestBodySchema")
            new_schema: Optional[dict] = new_ep["schema_json"].get("requestBodySchema")

            diffs.extend(
                _compare_request_body(
                    op_id, old_ep["method"], old_ep["path"], old_schema, new_schema
                )
            )

        # Operations added in new spec — NON_BREAKING
        for op_id, new_ep in new_endpoints.items():
            if op_id not in old_endpoints:
                diffs.append(
                    DiffItem(
                        operation_id=op_id,
                        method=new_ep["method"],
                        path=new_ep["path"],
                        breaking=False,
                        change_type="FIELD_ADDED",
                        field="(endpoint)",
                        old_value=None,
                        new_value="exists",
                    )
                )

        breaking_count = sum(1 for d in diffs if d.breaking)
        logger.info(
            f"diff_specs old={old_spec_id} new={new_spec_id} → "
            f"{len(diffs)} changes ({breaking_count} breaking)"
        )
        return diffs

    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        log_audit(
            tool_name="diff_specs",
            inputs={"old_spec_id": old_spec_id, "new_spec_id": new_spec_id},
            outputs={
                "total_changes": len(diffs),
                "breaking_count": sum(1 for d in diffs if d.breaking),
                "non_breaking_count": sum(1 for d in diffs if not d.breaking),
            },
            spec_id=new_spec_id,
            duration_ms=duration_ms,
        )


# ── Internal DB helpers ───────────────────────────────────────────────────────

def _fetch_endpoints_for_spec(spec_id: int) -> dict[str, dict]:
    """Return {operation_id: {method, path, schema_json}} for a spec."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT operation_id, method, path, schema_json
                FROM endpoints
                WHERE spec_id = %s
                """,
                (spec_id,),
            )
            return {
                row[0]: {"method": row[1], "path": row[2], "schema_json": row[3]}
                for row in cur.fetchall()
            }


# ── Schema comparison logic ───────────────────────────────────────────────────

def _compare_request_body(
    operation_id: str,
    method: str,
    path: str,
    old_schema: Optional[dict],
    new_schema: Optional[dict],
) -> list[DiffItem]:
    """
    Compare two requestBody JSON Schemas for a single operation.
    Returns a list of DiffItem for every detected change.
    """
    items: list[DiffItem] = []

    if old_schema is None and new_schema is None:
        return items

    if old_schema is None:
        # requestBody newly added — non-breaking new capability
        return items

    if new_schema is None:
        # requestBody removed — BREAKING
        items.append(
            DiffItem(
                operation_id=operation_id, method=method, path=path,
                breaking=True, change_type="FIELD_REMOVED",
                field="(requestBody)", old_value="exists", new_value=None,
            )
        )
        return items

    old_props: dict = old_schema.get("properties", {})
    new_props: dict = new_schema.get("properties", {})
    old_required: set[str] = set(old_schema.get("required", []))
    new_required: set[str] = set(new_schema.get("required", []))

    # 1. Fields newly added to "required" — BREAKING (REQUIRED_ADDED)
    newly_required = new_required - old_required
    for field in sorted(newly_required):
        items.append(
            DiffItem(
                operation_id=operation_id, method=method, path=path,
                breaking=True, change_type="REQUIRED_ADDED",
                field=field, old_value=None, new_value="required",
            )
        )

    # 2. Fields dropped from properties — BREAKING (FIELD_REMOVED)
    removed_fields = set(old_props.keys()) - set(new_props.keys())
    for field in sorted(removed_fields):
        items.append(
            DiffItem(
                operation_id=operation_id, method=method, path=path,
                breaking=True, change_type="FIELD_REMOVED",
                field=field,
                old_value=str(old_props[field].get("type", "unknown")),
                new_value=None,
            )
        )

    # 3. Compare fields present in both
    for field in sorted(set(old_props.keys()) & set(new_props.keys())):
        old_f = old_props[field]
        new_f = new_props[field]

        # 3a. Type changed — BREAKING (TYPE_CHANGED)
        old_type = old_f.get("type")
        new_type = new_f.get("type")
        if old_type and new_type and old_type != new_type:
            items.append(
                DiffItem(
                    operation_id=operation_id, method=method, path=path,
                    breaking=True, change_type="TYPE_CHANGED",
                    field=field, old_value=old_type, new_value=new_type,
                )
            )
            continue  # skip enum check when type already differs

        # 3b. Enum values changed (ENUM_CHANGED)
        old_enum = old_f.get("enum")
        new_enum = new_f.get("enum")
        if old_enum is not None or new_enum is not None:
            old_set: set = set(old_enum or [])
            new_set: set = set(new_enum or [])
            if old_set != new_set:
                removed_values = old_set - new_set
                # BREAKING if any previously valid value is removed
                is_breaking = bool(removed_values)
                items.append(
                    DiffItem(
                        operation_id=operation_id, method=method, path=path,
                        breaking=is_breaking, change_type="ENUM_CHANGED",
                        field=field,
                        old_value=", ".join(sorted(str(v) for v in old_set)) if old_set else None,
                        new_value=", ".join(sorted(str(v) for v in new_set)) if new_set else None,
                    )
                )

    # 4. New fields in properties that are NOT newly required — NON_BREAKING (FIELD_ADDED)
    new_fields = set(new_props.keys()) - set(old_props.keys())
    for field in sorted(new_fields):
        if field not in newly_required:
            items.append(
                DiffItem(
                    operation_id=operation_id, method=method, path=path,
                    breaking=False, change_type="FIELD_ADDED",
                    field=field,
                    old_value=None,
                    new_value=str(new_props[field].get("type", "unknown")),
                )
            )

    return items
