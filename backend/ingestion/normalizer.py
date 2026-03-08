# TODO-3: OpenAPI normalizer — prance $ref resolution → canonical endpoint dicts ✅

import logging
import re
from typing import Optional

import prance

logger = logging.getLogger(__name__)


def normalize_spec(spec_path: str) -> tuple[dict, list[dict]]:
    """
    Parse and fully resolve (all $ref) an OpenAPI 3.x or Swagger 2.x spec.
    Returns (raw_resolved_spec_dict, list_of_canonical_endpoint_dicts).
    """
    parser = prance.ResolvingParser(spec_path, strict=False)
    parser.parse()
    spec: dict = parser.specification

    endpoints: list[dict] = []
    paths: dict = spec.get("paths", {})

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        # Path-level parameters shared across all methods
        path_params: list[dict] = path_item.get("parameters", [])

        for method in ("get", "post", "put", "patch", "delete", "head", "options"):
            operation: Optional[dict] = path_item.get(method)
            if not isinstance(operation, dict):
                continue

            operation_id = operation.get("operationId") or _auto_operation_id(method, path)
            summary = operation.get("summary") or operation.get("description") or None
            tags: list[str] = operation.get("tags", [])

            # Merge path-level params with operation-level (op wins on name+in clash)
            op_params: list[dict] = operation.get("parameters", [])
            all_params = _merge_parameters(path_params, op_params)

            request_body: dict = operation.get("requestBody", {})
            request_body_schema = _extract_request_body_schema(request_body)

            responses: dict = operation.get("responses", {})
            response_schemas = _extract_response_schemas(responses)

            schema_json = {
                "parameters": all_params,
                "requestBody": request_body,
                "responses": responses,
                "requestBodySchema": request_body_schema,
            }

            endpoints.append(
                {
                    "operation_id": operation_id,
                    "method": method.upper(),
                    "path": path,
                    "summary": summary,
                    "tags": tags,
                    "parameters": all_params,
                    "request_body_schema": request_body_schema,
                    "response_schemas": response_schemas,
                    "schema_json": schema_json,
                }
            )
            logger.debug(f"Normalised: {method.upper()} {path} → {operation_id}")

    logger.info(f"Normalised {len(endpoints)} endpoints from {spec_path}")
    return spec, endpoints


# ── Helpers ────────────────────────────────────────────────────────────────────

def _auto_operation_id(method: str, path: str) -> str:
    """Generate a deterministic operationId when the spec omits one."""
    sanitised = re.sub(r"[{}]", "", path).replace("/", "_").strip("_")
    return f"{method}_{sanitised}"


def _merge_parameters(
    path_params: list[dict], op_params: list[dict]
) -> list[dict]:
    """Merge, with op-level params overriding path-level on (name, in) key."""
    merged: dict[tuple, dict] = {
        (p.get("name"), p.get("in")): p for p in path_params
    }
    for p in op_params:
        merged[(p.get("name"), p.get("in"))] = p
    return list(merged.values())


def _extract_request_body_schema(request_body: dict) -> Optional[dict]:
    if not request_body:
        return None
    content: dict = request_body.get("content", {})
    if not content:
        return None
    # Prefer application/json, fall back to first content type
    json_content = content.get("application/json") or content.get(next(iter(content), ""), {})
    return json_content.get("schema") if isinstance(json_content, dict) else None


def _extract_response_schemas(responses: dict) -> dict:
    result: dict[str, dict] = {}
    for status_code, response_obj in responses.items():
        if not isinstance(response_obj, dict):
            continue
        content: dict = response_obj.get("content", {})
        json_content = content.get("application/json", {})
        schema = json_content.get("schema") if isinstance(json_content, dict) else None
        if schema:
            result[str(status_code)] = schema
    return result
