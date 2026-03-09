# MCP tool: validate_request — validate a payload against an operationId's requestBody schema

import asyncio
import logging
import time
from typing import Optional

import jsonschema
from pydantic import BaseModel

from storage.schema_store import log_audit
from storage.vector_store import fetch_endpoint_row

logger = logging.getLogger(__name__)


# ── Pydantic models (canonical from CLAUDE.md) ────────────────────────────────

class ValidationError(BaseModel):
    field: str
    message: str
    hint: Optional[str]


class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationError]


# ── Tool implementation ────────────────────────────────────────────────────────

async def validate_request(
    operation_id: str,
    payload: dict,
    spec_id: int,
) -> ValidationResult:
    """
    Fetch the requestBody JSON Schema for `operation_id`, then run
    jsonschema.validate() against `payload`. Returns a ValidationResult
    with field-level errors. Every call is logged to audit_logs.

    Returns valid=True with empty errors if the endpoint has no requestBody schema
    (e.g. GET requests).
    """
    start = time.perf_counter()
    result: Optional[ValidationResult] = None

    try:
        # Fetch directly from DB — avoids double audit log entry that get_endpoint() would produce
        row = await asyncio.to_thread(fetch_endpoint_row, operation_id, spec_id)
        if row is None:
            raise ValueError(f"Endpoint '{operation_id}' not found in spec_id={spec_id}")

        schema_json: dict = row["schema_json"]
        request_body_schema: Optional[dict] = schema_json.get("requestBodySchema")

        if request_body_schema is None:
            result = ValidationResult(valid=True, errors=[])
            logger.info(
                f"validate_request op={operation_id}: no requestBody schema — auto-valid"
            )
            return result

        schema = request_body_schema
        errors: list[ValidationError] = []

        # Use iter_errors() directly — single validation pass, collects all errors at once
        validator = jsonschema.Draft7Validator(schema)
        for ve in sorted(validator.iter_errors(payload), key=str):
            errors.append(
                ValidationError(
                    field=_format_field_path(ve),
                    message=ve.message,
                    hint=_build_hint(ve),
                )
            )

        result = ValidationResult(valid=len(errors) == 0, errors=errors)
        logger.info(
            f"validate_request op={operation_id} spec_id={spec_id} "
            f"valid={result.valid} errors={len(errors)}"
        )
        return result
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        log_audit(
            tool_name="validate_request",
            inputs={
                "operation_id": operation_id,
                "spec_id": spec_id,
                # payload may contain user data — store only key names, not values
                "payload_keys": list(payload.keys()) if isinstance(payload, dict) else [],
            },
            outputs={
                "valid": result.valid if result else None,
                "error_count": len(result.errors) if result else None,
                "error_fields": [e.field for e in result.errors] if result else [],
            },
            spec_id=spec_id,
            duration_ms=duration_ms,
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_field_path(ve: jsonschema.ValidationError) -> str:
    """Convert jsonschema absolute_path deque to a dot-notation field string."""
    if ve.absolute_path:
        return ".".join(str(p) for p in ve.absolute_path)
    # Root-level errors (e.g. missing required field) — extract from message
    if ve.validator == "required" and ve.validator_value:
        # message is like: "'fieldName' is a required property"
        parts = ve.message.split("'")
        return parts[1] if len(parts) > 1 else "(root)"
    return "(root)"


def _build_hint(ve: jsonschema.ValidationError) -> Optional[str]:
    """Generate a human-readable hint based on the validator type."""
    if ve.validator == "required":
        parts = ve.message.split("'")
        field = parts[1] if len(parts) > 1 else ""
        return f"Add required field '{field}' to the request payload"
    if ve.validator == "enum":
        allowed = ", ".join(repr(v) for v in (ve.validator_value or []))
        return f"Allowed values: {allowed}"
    if ve.validator == "type":
        return f"Expected type: {ve.validator_value}"
    if ve.validator == "minLength":
        return f"Minimum length: {ve.validator_value}"
    if ve.validator == "maxLength":
        return f"Maximum length: {ve.validator_value}"
    if ve.validator == "pattern":
        return f"Must match pattern: {ve.validator_value}"
    return None
