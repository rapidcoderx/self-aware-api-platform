# MCP tool: get_endpoint — fetch full schema for one operationId

import logging
import time
from typing import Optional

from pydantic import BaseModel

from storage.schema_store import log_audit
from storage.vector_store import fetch_endpoint_row

logger = logging.getLogger(__name__)


# ── Pydantic models (canonical from CLAUDE.md) ────────────────────────────────

class EndpointDetail(BaseModel):
    operation_id: str
    method: str
    path: str
    summary: Optional[str]
    tags: list[str]
    parameters: list[dict]
    request_body_schema: Optional[dict]
    response_schemas: dict
    spec_version: int


# ── Tool implementation ────────────────────────────────────────────────────────

async def get_endpoint(
    operation_id: str,
    spec_id: int,
) -> EndpointDetail:
    """
    Retrieve the full schema detail for one endpoint by operationId.
    Raises ValueError if not found.
    Every call is logged to audit_logs.
    """
    start = time.perf_counter()
    detail: Optional[EndpointDetail] = None

    try:
        row = fetch_endpoint_row(operation_id, spec_id)
        if row is None:
            raise ValueError(
                f"Endpoint '{operation_id}' not found in spec_id={spec_id}"
            )

        schema_json: dict = row["schema_json"]
        request_body_schema: Optional[dict] = schema_json.get("requestBodySchema")
        parameters: list[dict] = schema_json.get("parameters", [])

        # Re-derive response_schemas from schema_json responses block
        response_schemas: dict = {}
        for status_code, resp_obj in schema_json.get("responses", {}).items():
            if not isinstance(resp_obj, dict):
                continue
            content = resp_obj.get("content", {})
            json_content = content.get("application/json", {})
            schema = json_content.get("schema") if isinstance(json_content, dict) else None
            if schema:
                response_schemas[str(status_code)] = schema

        detail = EndpointDetail(
            operation_id=row["operation_id"],
            method=row["method"],
            path=row["path"],
            summary=row["summary"],
            tags=row["tags"],
            parameters=parameters,
            request_body_schema=request_body_schema,
            response_schemas=response_schemas,
            spec_version=row["spec_version"],
        )
        logger.info(f"get_endpoint op={operation_id} spec_id={spec_id} OK")
        return detail
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        log_audit(
            tool_name="get_endpoint",
            inputs={"operation_id": operation_id, "spec_id": spec_id},
            outputs={
                "found": detail is not None,
                "method": detail.method if detail else None,
                "path": detail.path if detail else None,
            },
            spec_id=spec_id,
            duration_ms=duration_ms,
        )
