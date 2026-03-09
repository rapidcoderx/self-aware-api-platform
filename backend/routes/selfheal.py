# POST /api/agent/self-heal — generate a migration plan for one operation between two spec versions

import asyncio
import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from agent import run_self_heal
from storage.schema_store import get_spec_by_id
from tools.spec_validate import ValidationError

logger = logging.getLogger(__name__)

selfheal_router = APIRouter()


# ── Request / Response models ─────────────────────────────────────────────────


class SelfHealRequest(BaseModel):
    old_spec_id: int
    new_spec_id: int
    operation_id: str


class ValidationResultSummary(BaseModel):
    valid: bool
    errors: list[ValidationError]


class SelfHealResponse(BaseModel):
    old_spec_id: int
    new_spec_id: int
    operation_id: str
    before_payload: dict
    before_validation: ValidationResultSummary
    after_payload: dict
    after_validation: ValidationResultSummary
    migration_steps: list[str]


# ── Route ─────────────────────────────────────────────────────────────────────


@selfheal_router.post(
    "/api/agent/self-heal",
    response_model=SelfHealResponse,
    status_code=status.HTTP_200_OK,
)
async def self_heal(request: SelfHealRequest) -> SelfHealResponse:
    """
    Generate a migration plan for a single operation between two spec versions.

    Returns before/after payloads, validation results, and step-by-step migration instructions.
    The after_payload is validated against the new spec's schema before being returned.
    """
    if request.old_spec_id == request.new_spec_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="old_spec_id and new_spec_id must be different",
        )

    try:
        old_spec = await asyncio.to_thread(get_spec_by_id, request.old_spec_id)
        new_spec = await asyncio.to_thread(get_spec_by_id, request.new_spec_id)
    except Exception:
        logger.error("Self-heal DB lookup failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )

    if old_spec is None or new_spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spec not found",
        )

    try:
        plan = await run_self_heal(
            old_spec_id=request.old_spec_id,
            new_spec_id=request.new_spec_id,
            operation_id=request.operation_id,
        )
    except ValueError as exc:
        logger.error(f"Self-heal value error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Operation not found in one or both specs",
        )
    except RuntimeError as exc:
        logger.error(f"Self-heal exceeded iterations: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Self-heal agent exceeded maximum iterations",
        )
    except Exception:
        logger.error("Self-heal unexpected error", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )

    return SelfHealResponse(
        old_spec_id=plan["old_spec_id"],
        new_spec_id=plan["new_spec_id"],
        operation_id=plan["operation_id"],
        before_payload=plan["before_payload"],
        before_validation=ValidationResultSummary(**plan["before_validation"]),
        after_payload=plan["after_payload"],
        after_validation=ValidationResultSummary(**plan["after_validation"]),
        migration_steps=plan["migration_steps"],
    )
