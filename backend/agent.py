# Claude tool_use orchestrator — hand-rolled agent loop (no LangChain)

import asyncio
import json
import logging
import os
from typing import Any, Optional

import anthropic
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

from storage.schema_store import get_db, get_spec_by_id
from tools.spec_get import get_endpoint
from tools.spec_search import search_endpoints
from tools.spec_validate import validate_request

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

MODEL = "claude-sonnet-4-20250514"
MAX_ITERATIONS = 10

SYSTEM_PROMPT = """You are an API intelligence assistant for the Self-Aware API Platform.

RULES:
1. TOOLS ONLY: Always use the provided tools to look up API information. Never guess endpoint schemas, fields, or validation rules.
2. PROVENANCE: Always include the spec version and operationId in your answers so users can trace information back to the source.
3. SANDBOX: You are running in sandbox mode. All API calls go to a mock server. No production systems are affected.
4. VALIDATION: When you find a relevant endpoint, always generate an example payload and validate it using spec_validate_request before presenting it to the user.

WORKFLOW:
- Use spec_search to find relevant endpoints by natural language query
- Use spec_get_endpoint to retrieve full schema details
- Use spec_validate_request to validate example payloads against the schema
- Always show the user: HTTP method, path, required fields, and a validated example payload
"""

# ── Pydantic models ────────────────────────────────────────────────────────────


class ToolCallRecord(BaseModel):
    tool_name: str
    inputs: dict
    result_summary: str


class ProvenanceInfo(BaseModel):
    spec_name: str
    spec_version: int
    operation_id: str


class AgentResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallRecord]
    provenance: Optional[ProvenanceInfo]


# ── Tool definitions for Claude API ────────────────────────────────────────────

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "spec_search",
        "description": (
            "Search for API endpoints by natural language query. "
            "Uses vector similarity over ingested OpenAPI specs. "
            "Returns ranked endpoint summaries with operationId, method, path, summary, and score."
        ),
        "input_schema": {
            "type": "object",
            "required": ["query", "spec_id"],
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language search query",
                },
                "spec_id": {
                    "type": "integer",
                    "description": "The spec ID to search within",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 5)",
                    "default": 5,
                },
            },
        },
    },
    {
        "name": "spec_get_endpoint",
        "description": (
            "Retrieve the full schema for one endpoint by operationId. "
            "Returns method, path, parameters, request body schema, response schemas, and spec version."
        ),
        "input_schema": {
            "type": "object",
            "required": ["operation_id", "spec_id"],
            "properties": {
                "operation_id": {
                    "type": "string",
                    "description": "The operationId to retrieve",
                },
                "spec_id": {
                    "type": "integer",
                    "description": "The spec ID the endpoint belongs to",
                },
            },
        },
    },
    {
        "name": "spec_validate_request",
        "description": (
            "Validate a JSON payload against the requestBody schema of an endpoint. "
            "Returns valid: true/false and any field-level errors with hints."
        ),
        "input_schema": {
            "type": "object",
            "required": ["operation_id", "payload", "spec_id"],
            "properties": {
                "operation_id": {
                    "type": "string",
                    "description": "The operationId to validate against",
                },
                "payload": {
                    "type": "object",
                    "description": "The JSON payload to validate",
                },
                "spec_id": {
                    "type": "integer",
                    "description": "The spec ID the endpoint belongs to",
                },
            },
        },
    },
]


# ── Tool dispatch ──────────────────────────────────────────────────────────────

async def _dispatch_tool(name: str, arguments: dict) -> str:
    """Call the actual tool function and return a JSON string result."""
    if name == "spec_search":
        results = await search_endpoints(
            query=arguments["query"],
            spec_id=arguments["spec_id"],
            limit=arguments.get("limit", 5),
        )
        return json.dumps([r.model_dump() for r in results], default=str)

    elif name == "spec_get_endpoint":
        detail = await get_endpoint(
            operation_id=arguments["operation_id"],
            spec_id=arguments["spec_id"],
        )
        return json.dumps(detail.model_dump(), default=str)

    elif name == "spec_validate_request":
        result = await validate_request(
            operation_id=arguments["operation_id"],
            payload=arguments["payload"],
            spec_id=arguments["spec_id"],
        )
        return json.dumps(result.model_dump(), default=str)

    else:
        raise ValueError(f"Unknown tool: {name}")


def _summarise_result(name: str, result_json: str) -> str:
    """Build a short summary for the ToolCallRecord."""
    try:
        data = json.loads(result_json)
    except (json.JSONDecodeError, TypeError):
        return result_json[:200]

    if name == "spec_search":
        if isinstance(data, list):
            ops = [r.get("operation_id", "?") for r in data[:3]]
            return f"{len(data)} results: {', '.join(ops)}"
        return str(data)[:200]

    elif name == "spec_get_endpoint":
        return f"{data.get('method', '?')} {data.get('path', '?')} (v{data.get('spec_version', '?')})"

    elif name == "spec_validate_request":
        valid = data.get("valid", None)
        errs = data.get("errors", [])
        if valid:
            return "valid=True"
        return f"valid=False, {len(errs)} errors: {[e.get('field') for e in errs[:3]]}"

    return str(data)[:200]


# ── Agent loop ─────────────────────────────────────────────────────────────────

async def run_agent(user_message: str, spec_id: int) -> AgentResponse:
    """
    Run the Claude tool_use agent loop.
    Returns AgentResponse with answer, tool_calls, and provenance.
    Raises RuntimeError if MAX_ITERATIONS exceeded.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Inject spec context so Claude knows which spec_id to use in tool calls
    spec_info = await asyncio.to_thread(get_spec_by_id, spec_id)
    spec_context = (
        f"\n\n[CONTEXT: You are working with spec_id={spec_id}"
        + (f", spec name='{spec_info['name']}', version={spec_info['version']}" if spec_info else "")
        + ". Always use this spec_id when calling tools.]"
    )

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": user_message + spec_context}
    ]
    tool_call_records: list[ToolCallRecord] = []
    provenance: Optional[ProvenanceInfo] = None

    for iteration in range(MAX_ITERATIONS):
        logger.info(f"Agent iteration {iteration + 1}/{MAX_ITERATIONS}")

        response = await asyncio.to_thread(
            client.messages.create,
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=messages,
        )

        # Check for end of turn — extract text answer
        if response.stop_reason == "end_turn":
            answer_text = ""
            for block in response.content:
                if block.type == "text":
                    answer_text += block.text

            # Build provenance from tool call history
            provenance = _extract_provenance(tool_call_records, spec_info)

            logger.info(
                f"Agent finished after {iteration + 1} iterations, "
                f"{len(tool_call_records)} tool calls"
            )
            return AgentResponse(
                answer=answer_text,
                tool_calls=tool_call_records,
                provenance=provenance,
            )

        # Process tool_use blocks
        if response.stop_reason == "tool_use":
            # First, append the assistant message with ALL content blocks
            messages.append({"role": "assistant", "content": response.content})

            # Then process each tool_use block and collect results
            tool_results: list[dict[str, Any]] = []
            for block in response.content:
                if block.type == "tool_use":
                    tool_name = block.name
                    tool_input = block.input
                    tool_use_id = block.id

                    logger.info(f"Tool call: {tool_name}({list(tool_input.keys())})")

                    try:
                        result_json = await _dispatch_tool(tool_name, tool_input)
                        is_error = False
                    except Exception as exc:
                        logger.error(f"Tool {tool_name} failed: {exc}", exc_info=True)
                        result_json = json.dumps({"error": str(exc)})
                        is_error = True

                    # Record the tool call
                    tool_call_records.append(
                        ToolCallRecord(
                            tool_name=tool_name,
                            inputs=tool_input,
                            result_summary=_summarise_result(tool_name, result_json),
                        )
                    )

                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use_id,
                            "content": result_json,
                            "is_error": is_error,
                        }
                    )

            # Append all tool results as a single user message
            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop reason — return whatever we got
        logger.warning(f"Unexpected stop_reason: {response.stop_reason}")
        answer_text = ""
        for block in response.content:
            if block.type == "text":
                answer_text += block.text
        return AgentResponse(
            answer=answer_text or "Agent stopped unexpectedly.",
            tool_calls=tool_call_records,
            provenance=_extract_provenance(tool_call_records, spec_info),
        )

    raise RuntimeError(
        f"Agent exceeded maximum iterations ({MAX_ITERATIONS}). "
        f"Completed {len(tool_call_records)} tool calls before limit."
    )


def _extract_provenance(
    tool_calls: list[ToolCallRecord], spec_info: Optional[dict]
) -> Optional[ProvenanceInfo]:
    """
    Extract provenance from tool call history.
    Looks for spec_get_endpoint calls to determine the primary operation.
    Falls back to spec_search top result if no get was performed.
    """
    # Try to find operation_id from spec_get_endpoint calls
    operation_id: Optional[str] = None
    for tc in tool_calls:
        if tc.tool_name == "spec_get_endpoint":
            operation_id = tc.inputs.get("operation_id")
            break

    # Fall back to spec_search top result
    if operation_id is None:
        for tc in tool_calls:
            if tc.tool_name == "spec_search" and "results:" in tc.result_summary:
                # Extract first operation from summary like "3 results: createAccount, ..."
                parts = tc.result_summary.split(": ", 1)
                if len(parts) > 1:
                    first_op = parts[1].split(",")[0].strip()
                    if first_op:
                        operation_id = first_op
                        break

    if operation_id is None:
        return None

    if spec_info is None:
        return ProvenanceInfo(
            spec_name="Unknown",
            spec_version=0,
            operation_id=operation_id,
        )

    return ProvenanceInfo(
        spec_name=spec_info["name"],
        spec_version=spec_info["version"],
        operation_id=operation_id,
    )
