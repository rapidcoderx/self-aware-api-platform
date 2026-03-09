# POST /api/chat — agent chat endpoint

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from agent import AgentResponse, run_agent
from storage.schema_store import get_spec_by_id

logger = logging.getLogger(__name__)

chat_router = APIRouter()


# ── Request / Response models ──────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str
    spec_id: int


class ProvenanceResponse(BaseModel):
    spec_name: str
    spec_version: int
    operation_id: str


class ToolCallResponse(BaseModel):
    tool_name: str
    inputs: dict
    result_summary: str


class ChatResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallResponse]
    provenance: Optional[ProvenanceResponse]
    spec_id: int


# ── Route ──────────────────────────────────────────────────────────────────────


@chat_router.post(
    "/api/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Send a natural language question about an API spec.
    The agent uses tool_use to search, retrieve, and validate endpoints,
    then returns a structured answer with provenance.
    """
    # Verify spec exists
    spec_info = await asyncio.to_thread(get_spec_by_id, request.spec_id)
    if spec_info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spec with id={request.spec_id} not found",
        )

    try:
        agent_result: AgentResponse = await run_agent(
            user_message=request.message,
            spec_id=request.spec_id,
        )
    except RuntimeError as exc:
        # MAX_ITERATIONS exceeded
        logger.error(f"Agent exceeded max iterations: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Agent failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal agent error",
        )

    provenance_resp: Optional[ProvenanceResponse] = None
    if agent_result.provenance:
        provenance_resp = ProvenanceResponse(
            spec_name=agent_result.provenance.spec_name,
            spec_version=agent_result.provenance.spec_version,
            operation_id=agent_result.provenance.operation_id,
        )

    return ChatResponse(
        answer=agent_result.answer,
        tool_calls=[
            ToolCallResponse(
                tool_name=tc.tool_name,
                inputs=tc.inputs,
                result_summary=tc.result_summary,
            )
            for tc in agent_result.tool_calls
        ],
        provenance=provenance_resp,
        spec_id=request.spec_id,
    )
