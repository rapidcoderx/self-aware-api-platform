# POST /api/specs/compare — compute and store a diff between two spec versions

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from storage.schema_store import get_spec_by_id, save_diff
from tools.spec_diff import DiffItem, diff_specs

logger = logging.getLogger(__name__)

compare_router = APIRouter()


# ── Request / Response models ────────────────────────────────────────────────


class CompareRequest(BaseModel):
    old_spec_id: int
    new_spec_id: int


class CompareResponse(BaseModel):
    diff_id: int
    old_spec_id: int
    new_spec_id: int
    breaking_count: int
    non_breaking_count: int
    diffs: list[DiffItem]


# ── Route ──────────────────────────────────────────────────────────────


@compare_router.post(
    "/api/specs/compare",
    response_model=CompareResponse,
)
async def compare_specs(request: CompareRequest) -> CompareResponse:
    """
    Compare two ingested spec versions.
    Computes a structured requestBody diff, saves it to the diffs table,
    and returns the full result with diff_id and change counts.
    """
    if request.old_spec_id == request.new_spec_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="old_spec_id and new_spec_id must be different",
        )

    old_spec = get_spec_by_id(request.old_spec_id)
    if old_spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec id={request.old_spec_id} not found",
        )

    new_spec = get_spec_by_id(request.new_spec_id)
    if new_spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec id={request.new_spec_id} not found",
        )

    try:
        diffs = await diff_specs(request.old_spec_id, request.new_spec_id)
    except Exception as exc:
        logger.error(f"diff_specs failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Diff computation failed",
        )

    breaking_count = sum(1 for d in diffs if d.breaking)
    non_breaking_count = sum(1 for d in diffs if not d.breaking)

    try:
        diff_id = save_diff(
            old_spec_id=request.old_spec_id,
            new_spec_id=request.new_spec_id,
            diffs=[d.model_dump() for d in diffs],
            breaking_count=breaking_count,
        )
    except Exception as exc:
        logger.error(f"save_diff failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist diff",
        )

    logger.info(
        f"Compare spec_id {request.old_spec_id} vs {request.new_spec_id}: "
        f"diff_id={diff_id} breaking={breaking_count} non_breaking={non_breaking_count}"
    )

    return CompareResponse(
        diff_id=diff_id,
        old_spec_id=request.old_spec_id,
        new_spec_id=request.new_spec_id,
        breaking_count=breaking_count,
        non_breaking_count=non_breaking_count,
        diffs=diffs,
    )
