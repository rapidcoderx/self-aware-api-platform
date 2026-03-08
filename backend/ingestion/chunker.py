# TODO-4: Endpoint text chunker — canonical endpoint dict → rich embedding text ✅

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def chunk_endpoint(endpoint: dict) -> str:
    """
    Convert a canonical endpoint dict into a rich, human-readable text chunk
    suitable for Voyage AI embedding.

    Includes: METHOD PATH, operationId, summary, tags, parameters (name/in/type/required),
    requestBody fields (name/type/required/enum), response field names.
    """
    parts: list[str] = []

    method: str = endpoint.get("method", "")
    path: str = endpoint.get("path", "")
    operation_id: str = endpoint.get("operation_id", "")
    summary: Optional[str] = endpoint.get("summary")
    tags: list[str] = endpoint.get("tags", [])

    parts.append(f"{method} {path}")

    if operation_id:
        parts.append(f"operationId: {operation_id}")

    if summary:
        parts.append(f"summary: {summary}")

    if tags:
        parts.append(f"tags: {', '.join(tags)}")

    # Parameters
    params: list[dict] = endpoint.get("parameters", [])
    if params:
        param_strs: list[str] = []
        for p in params:
            name = p.get("name", "")
            location = p.get("in", "")
            required = "required" if p.get("required") else "optional"
            schema = p.get("schema") or {}
            p_type = schema.get("type", "string")
            param_strs.append(f"{name} ({location}, {p_type}, {required})")
        parts.append(f"parameters: {'; '.join(param_strs)}")

    # Request body schema fields
    req_schema: Optional[dict] = endpoint.get("request_body_schema")
    if req_schema:
        _append_schema_fields(parts, req_schema)

    # Response schemas (field names only for brevity)
    response_schemas: dict = endpoint.get("response_schemas", {})
    for status_code, schema in response_schemas.items():
        if schema and isinstance(schema, dict):
            field_names = _get_field_names(schema)
            if field_names:
                parts.append(f"response {status_code} fields: {', '.join(field_names)}")

    text = "\n".join(parts)
    logger.debug(f"Chunked {operation_id}: {len(text)} chars")
    return text


# ── Helpers ────────────────────────────────────────────────────────────────────

def _append_schema_fields(parts: list[str], schema: dict) -> None:
    """Extract requestBody properties and append to parts list."""
    properties: dict = schema.get("properties", {})
    required_fields: list[str] = schema.get("required", [])

    if not properties:
        return

    field_strs: list[str] = []
    for field_name, field_schema in properties.items():
        if not isinstance(field_schema, dict):
            continue
        f_type = field_schema.get("type", "string")
        is_req = "required" if field_name in required_fields else "optional"
        enum_vals = field_schema.get("enum")
        if enum_vals:
            enum_str = ", ".join(str(v) for v in enum_vals)
            field_strs.append(f"{field_name} ({f_type}, {is_req}, enum: {enum_str})")
        else:
            field_strs.append(f"{field_name} ({f_type}, {is_req})")

    if field_strs:
        parts.append(f"requestBody fields: {'; '.join(field_strs)}")


def _get_field_names(schema: dict) -> list[str]:
    return list(schema.get("properties", {}).keys())


# Runbook alias — endpoint_to_text is the name used in exit checks
endpoint_to_text = chunk_endpoint
