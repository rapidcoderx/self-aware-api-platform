# Claude tool_use orchestrator — hand-rolled agent loop (no LangChain)

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Optional

import anthropic
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

from storage.schema_store import get_spec_by_id, log_audit
from tools.spec_get import get_endpoint, EndpointDetail
from tools.spec_search import search_endpoints
from tools.spec_validate import validate_request
from tools.spec_diff import DiffItem, diff_specs

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

MODEL = "claude-sonnet-4-20250514"
MAX_ITERATIONS = 10

# Module-level singleton — avoids recreating HTTP connection pool on every request
_anthropic_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _anthropic_client

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
            limit=arguments.get("limit", 3),  # 3 is enough for demo; saves input tokens
        )
        return json.dumps([r.model_dump() for r in results], default=str)

    elif name == "spec_get_endpoint":
        detail = await get_endpoint(
            operation_id=arguments["operation_id"],
            spec_id=arguments["spec_id"],
        )
        # Strip response_schemas — Claude only needs request schema; saves input tokens
        data = detail.model_dump()
        data.pop("response_schemas", None)
        return json.dumps(data, default=str)

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
    start = time.perf_counter()
    client = _get_client()

    # Inject spec context so Claude knows which spec_id to use in tool calls
    spec_info = await asyncio.to_thread(get_spec_by_id, spec_id)
    if spec_info is None:
        raise ValueError(f"spec_id={spec_id} not found")
    spec_context = (
        f"\n\n[CONTEXT: You are working with spec_id={spec_id}"
        f", spec name='{spec_info['name']}', version={spec_info['version']}"
        f". Always use this spec_id when calling tools.]"
    )

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": user_message + spec_context}
    ]
    tool_call_records: list[ToolCallRecord] = []
    provenance: Optional[ProvenanceInfo] = None

    async def _safe_dispatch(block: Any) -> tuple[str, bool]:
        try:
            return await _dispatch_tool(block.name, block.input), False
        except Exception as exc:
            logger.error(f"Tool {block.name} failed: {exc}", exc_info=True)
            return json.dumps({"error": str(exc)}), True

    for iteration in range(MAX_ITERATIONS):
        logger.info(f"Agent iteration {iteration + 1}/{MAX_ITERATIONS}")

        response = await asyncio.to_thread(
            client.messages.create,
            model=MODEL,
            max_tokens=1024,  # chat answers are concise; was 4096
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

            duration_ms = int((time.perf_counter() - start) * 1000)
            logger.info(
                f"Agent finished after {iteration + 1} iterations, "
                f"{len(tool_call_records)} tool calls"
            )
            try:
                log_audit(
                    tool_name="run_agent",
                    inputs={"user_message": user_message[:200], "spec_id": spec_id},
                    outputs={
                        "answer_length": len(answer_text),
                        "tool_calls_count": len(tool_call_records),
                        "iterations": iteration + 1,
                    },
                    spec_id=spec_id,
                    duration_ms=duration_ms,
                )
            except Exception as audit_exc:
                logger.warning(f"audit log failed (non-fatal): {audit_exc}")
            return AgentResponse(
                answer=answer_text,
                tool_calls=tool_call_records,
                provenance=provenance,
            )

        # Process tool_use blocks
        if response.stop_reason == "tool_use":
            # First, append the assistant message with ALL content blocks
            messages.append({"role": "assistant", "content": response.content})

            # Collect all tool_use blocks and dispatch them concurrently
            tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
            for block in tool_use_blocks:
                logger.info(f"Tool call: {block.name}({list(block.input.keys())})")

            dispatch_results = await asyncio.gather(
                *[_safe_dispatch(b) for b in tool_use_blocks]
            )

            tool_results: list[dict[str, Any]] = []
            for block, (result_json, is_error) in zip(tool_use_blocks, dispatch_results):
                tool_call_records.append(
                    ToolCallRecord(
                        tool_name=block.name,
                        inputs=block.input,
                        result_summary=_summarise_result(block.name, result_json),
                    )
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
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
        duration_ms = int((time.perf_counter() - start) * 1000)
        try:
            log_audit(
                tool_name="run_agent",
                inputs={"user_message": user_message[:200], "spec_id": spec_id},
                outputs={
                    "answer_length": len(answer_text),
                    "tool_calls_count": len(tool_call_records),
                    "stop_reason": response.stop_reason,
                },
                spec_id=spec_id,
                duration_ms=duration_ms,
            )
        except Exception as audit_exc:
            logger.warning(f"audit log failed (non-fatal): {audit_exc}")
        return AgentResponse(
            answer=answer_text or "Agent stopped unexpectedly.",
            tool_calls=tool_call_records,
            provenance=_extract_provenance(tool_call_records, spec_info),
        )

    duration_ms = int((time.perf_counter() - start) * 1000)
    try:
        log_audit(
            tool_name="run_agent",
            inputs={"user_message": user_message[:200], "spec_id": spec_id},
            outputs={
                "error": "max_iterations_exceeded",
                "tool_calls_count": len(tool_call_records),
                "iterations": MAX_ITERATIONS,
            },
            spec_id=spec_id,
            duration_ms=duration_ms,
        )
    except Exception as audit_exc:
        logger.warning(f"audit log failed (non-fatal): {audit_exc}")
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


# ── Self-heal constants & helpers ──────────────────────────────────────────────

SELF_HEAL_MAX_REVISIONS = 3

SELF_HEAL_SYSTEM_PROMPT = """You are a migration engineer for the Self-Aware API Platform.

Your task: generate a valid JSON payload for an API operation that has breaking changes between two spec versions.

WORKFLOW (follow exactly):
1. Call spec_get_endpoint to retrieve the NEW spec schema for the operation
2. Inspect the required fields, their types, and allowed enum values carefully
3. Construct a payload that satisfies ALL required fields with realistic values
4. Call spec_validate_request to confirm the payload is valid for the NEW spec
5. If validation fails, read the error hints carefully and revise the payload, then validate again
6. Once spec_validate_request returns valid=true, respond ONLY with this exact JSON structure:

{"payload": {<your valid payload here>}}

RULES:
- Use realistic example values (e.g. "BC-1234567" for company registration, "Acme Corp" for names)
- Never use placeholder text like "string" or "example_field"
- The payload MUST pass spec_validate_request before you respond
- Respond with ONLY the JSON object — no prose, no markdown fences
"""

# Only expose the two tools needed for self-heal — no search tool
SELF_HEAL_TOOLS: list[dict[str, Any]] = [
    t for t in TOOL_DEFINITIONS
    if t["name"] in {"spec_get_endpoint", "spec_validate_request"}
]


def _build_before_payload(old_detail: EndpointDetail) -> dict:
    """
    Construct a payload valid for the old spec but likely invalid for the new spec.
    Fills every required field with a typed dummy value.
    For enum fields, uses the first enum value (which may have been removed in v2).
    """
    schema = old_detail.request_body_schema
    if not schema:
        return {}

    properties: dict = schema.get("properties", {})
    required: list[str] = schema.get("required", [])
    payload: dict = {}

    for field in required:
        prop = properties.get(field, {})
        field_type = prop.get("type", "string")
        enum_vals: list = prop.get("enum", [])

        if enum_vals:
            payload[field] = enum_vals[0]  # first value — may be removed in new spec
        elif field_type == "string":
            # Use a readable sentinel name so before/after contrast is obvious in demo
            payload[field] = f"Example {field.replace('_', ' ').title()}"
        elif field_type == "integer":
            payload[field] = 1
        elif field_type == "number":
            payload[field] = 1.0
        elif field_type == "boolean":
            payload[field] = True
        elif field_type == "array":
            payload[field] = []
        elif field_type == "object":
            payload[field] = {}
        else:
            payload[field] = "example"

    return payload


def _build_migration_steps(diffs: list[DiffItem]) -> list[str]:
    """
    Generate human-readable migration steps from a list of DiffItem objects.
    Returns sentences suitable for display to a developer.
    """
    steps: list[str] = []
    for d in diffs:
        if d.change_type == "REQUIRED_ADDED":
            steps.append(
                f"Add required field '{d.field}' to all requests for {d.method} {d.path}. "
                f"Expected value type: {d.new_value or 'string'} — use a real value (not null)."
            )
        elif d.change_type == "ENUM_CHANGED":
            steps.append(
                f"Update all uses of '{d.field}' in {d.method} {d.path}: "
                f"old allowed values [{d.old_value}] → new allowed values [{d.new_value}]. "
                f"Replace any removed values with a currently supported one."
            )
        elif d.change_type == "FIELD_REMOVED":
            steps.append(
                f"Remove '{d.field}' from payloads sent to {d.method} {d.path} — "
                f"this field no longer exists in the new spec."
            )
        elif d.change_type == "TYPE_CHANGED":
            steps.append(
                f"Change the type of '{d.field}' in {d.method} {d.path} "
                f"from {d.old_value} to {d.new_value}."
            )
        elif d.change_type == "ENDPOINT_REMOVED":
            steps.append(
                f"Remove all client calls to {d.method} {d.path} — "
                f"this endpoint has been removed in the new spec version."
            )
        elif d.change_type == "FIELD_ADDED":
            steps.append(
                f"Optionally include the new field '{d.field}' in payloads for "
                f"{d.method} {d.path} (non-breaking addition)."
            )
    return steps if steps else ["No breaking changes require migration for this operation."]


# ── Self-heal loop ─────────────────────────────────────────────────────────────

async def run_self_heal(
    old_spec_id: int, new_spec_id: int, operation_id: str
) -> dict:
    """
    Generate a migration plan for one operation between two spec versions.

    Steps:
    1. Fetch old + new endpoint schemas via get_endpoint (each call logged to audit_logs)
    2. Compute breaking diffs for this operation only
    3. Build before_payload (valid for old spec, invalid for new) + validate against new
    4. Use a Claude tool_use loop (max SELF_HEAL_MAX_REVISIONS) to generate a valid after_payload
    5. Return: before_payload, before_validation, after_payload, after_validation, migration_steps

    Raises RuntimeError if after_payload cannot be validated within the revision limit.
    Every spec_get and spec_validate call is logged to audit_logs by the tool itself.
    """
    start = time.perf_counter()

    # ── Step 1: Fetch schemas ───────────────────────────────────────────────────
    logger.info(f"Self-heal: fetching schemas for op={operation_id}")
    try:
        old_detail = await get_endpoint(operation_id, old_spec_id)
    except Exception as exc:
        raise ValueError(
            f"operation_id='{operation_id}' not found in spec_id={old_spec_id}"
        ) from exc

    # ── Step 2: Get breaking diffs for this operation ───────────────────────────
    try:
        all_diffs = await diff_specs(old_spec_id, new_spec_id)
    except Exception as exc:
        raise ValueError(
            f"Failed to diff spec_id={old_spec_id} vs spec_id={new_spec_id}"
        ) from exc
    op_diffs = [d for d in all_diffs if d.operation_id == operation_id]
    breaking_diffs = [d for d in op_diffs if d.breaking]
    logger.info(f"Self-heal: {len(breaking_diffs)} breaking changes for op={operation_id}")

    # ── Step 3: Build before_payload and validate against NEW spec ──────────────
    before_payload = _build_before_payload(old_detail)
    try:
        before_val_result = await validate_request(operation_id, before_payload, new_spec_id)
    except Exception as exc:
        raise ValueError(
            f"Could not validate before_payload for '{operation_id}' against spec_id={new_spec_id}"
        ) from exc
    before_validation = before_val_result.model_dump()
    logger.info(
        f"Self-heal: before_payload valid={before_validation['valid']} "
        f"errors={len(before_validation['errors'])}"
    )

    # ── Step 4: Claude tool_use loop to generate a valid after_payload ──────────
    breaking_summary = "; ".join(
        f"{d.change_type} on '{d.field}' ({d.old_value!r} → {d.new_value!r})"
        for d in breaking_diffs
    ) or "No breaking changes found"

    user_message = (
        f"Generate a migration payload for operation '{operation_id}'.\n\n"
        f"NEW spec_id: {new_spec_id}  (use this for all tool calls)\n"
        f"OLD payload (INVALID for new spec): {json.dumps(before_payload)}\n"
        f"Breaking changes: {breaking_summary}\n\n"
        f"Requirements:\n"
        f"1. Call spec_get_endpoint(operation_id='{operation_id}', spec_id={new_spec_id}) "
        f"to inspect the new schema\n"
        f"2. Construct an after_payload with ALL required fields including new ones\n"
        f"3. Call spec_validate_request to confirm it is valid\n"
        f"4. Respond ONLY with: {{\"payload\": {{...}}}}"
    )

    client = _get_client()
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_message}]

    after_payload: dict = {}
    after_validation: dict = {"valid": False, "errors": []}

    for revision in range(SELF_HEAL_MAX_REVISIONS):
        logger.info(f"Self-heal revision {revision + 1}/{SELF_HEAL_MAX_REVISIONS}")

        response = await asyncio.to_thread(
            client.messages.create,
            model=MODEL,
            max_tokens=2048,
            system=SELF_HEAL_SYSTEM_PROMPT,
            tools=SELF_HEAL_TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            # Claude responded with text — extract the payload JSON
            extracted: dict = {}
            for block in response.content:
                if block.type == "text":
                    text = block.text.strip()
                    # Strip any markdown fences Claude might have added
                    text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`")
                    try:
                        parsed = json.loads(text)
                        extracted = parsed.get("payload", parsed)
                    except (json.JSONDecodeError, ValueError):
                        # Fallback: find first JSON object in the text
                        m = re.search(r'\{.*\}', text, re.DOTALL)
                        if m:
                            try:
                                parsed = json.loads(m.group())
                                extracted = parsed.get("payload", parsed)
                            except json.JSONDecodeError:
                                pass

            if extracted:
                # Always do a final validation ourselves (source of truth)
                final_val = await validate_request(operation_id, extracted, new_spec_id)
                after_validation = final_val.model_dump()
                if after_validation["valid"]:
                    after_payload = extracted
                    logger.info(
                        f"Self-heal: after_payload valid on revision {revision + 1}"
                    )
                    break

            # Payload was invalid — give Claude the error hints and loop again
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": (
                    f"The payload failed validation: {json.dumps(after_validation)}. "
                    f"Fix the errors using the hints and try again. "
                    f"Remember to call spec_validate_request before responding."
                ),
            })
            continue

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results: list[dict[str, Any]] = []

            for block in response.content:
                if block.type != "tool_use":
                    continue
                try:
                    result_json = await _dispatch_tool(block.name, block.input)
                    is_error = False

                    # Track successful spec_validate_request calls
                    if block.name == "spec_validate_request":
                        result_data = json.loads(result_json)
                        if result_data.get("valid"):
                            after_payload = block.input.get("payload", {})
                            after_validation = result_data
                            logger.info(
                                f"Self-heal: tool validated after_payload on revision {revision + 1}"
                            )
                except Exception as exc:
                    logger.error(f"Self-heal tool {block.name} error: {exc}", exc_info=True)
                    result_json = json.dumps({"error": str(exc)})
                    is_error = True

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_json,
                    "is_error": is_error,
                })

            messages.append({"role": "user", "content": tool_results})

            # If Claude already validated the payload via tool call, we're done
            if after_validation.get("valid"):
                break

    if not after_validation.get("valid"):
        logger.warning(
            f"Self-heal: op={operation_id} could not produce a valid after_payload "
            f"after {SELF_HEAL_MAX_REVISIONS} revisions"
        )
        raise RuntimeError(
            f"Self-heal could not produce a valid payload for '{operation_id}' "
            f"after {SELF_HEAL_MAX_REVISIONS} revisions"
        )

    # ── Step 5: Build migration steps from breaking diffs ──────────────────────
    migration_steps = _build_migration_steps(breaking_diffs)

    duration_ms = int((time.perf_counter() - start) * 1000)
    try:
        log_audit(
            tool_name="run_self_heal",
            inputs={
                "old_spec_id": old_spec_id,
                "new_spec_id": new_spec_id,
                "operation_id": operation_id,
            },
            outputs={
                "before_valid": before_validation.get("valid"),
                "after_valid": after_validation.get("valid"),
                "migration_steps_count": len(migration_steps),
            },
            spec_id=new_spec_id,
            duration_ms=duration_ms,
        )
    except Exception as audit_exc:
        logger.warning(f"audit log failed (non-fatal): {audit_exc}")

    logger.info(
        f"Self-heal complete: op={operation_id} "
        f"before_valid={before_validation.get('valid')} "
        f"after_valid={after_validation.get('valid')} "
        f"duration_ms={duration_ms}"
    )

    return {
        "old_spec_id": old_spec_id,
        "new_spec_id": new_spec_id,
        "operation_id": operation_id,
        "before_payload": before_payload,
        "before_validation": before_validation,
        "after_payload": after_payload,
        "after_validation": after_validation,
        "migration_steps": migration_steps,
    }
