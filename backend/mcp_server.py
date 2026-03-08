# MCP Server — stdio transport, registers 3 tools for the Self-Aware API Platform

import asyncio
import json
import logging
import os
import sys

from dotenv import load_dotenv

# Ensure backend/ is on sys.path for local imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from tools.spec_get import get_endpoint
from tools.spec_search import search_endpoints
from tools.spec_validate import validate_request

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

# ── MCP Server instance ───────────────────────────────────────────────────────

app = Server("self-aware-api")


# ── Tool definitions ──────────────────────────────────────────────────────────

TOOLS: list[Tool] = [
    Tool(
        name="spec_search",
        description=(
            "Search for API endpoints by natural language query. "
            "Uses vector similarity search over ingested OpenAPI specs."
        ),
        inputSchema={
            "type": "object",
            "required": ["query", "spec_id"],
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language search query for endpoints",
                },
                "spec_id": {
                    "type": "integer",
                    "description": "The spec ID to search within",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default: 5)",
                    "default": 5,
                },
            },
        },
    ),
    Tool(
        name="spec_get_endpoint",
        description=(
            "Retrieve the full schema detail for one API endpoint by operationId. "
            "Returns method, path, parameters, request body schema, and response schemas."
        ),
        inputSchema={
            "type": "object",
            "required": ["operation_id", "spec_id"],
            "properties": {
                "operation_id": {
                    "type": "string",
                    "description": "The operationId of the endpoint to retrieve",
                },
                "spec_id": {
                    "type": "integer",
                    "description": "The spec ID the endpoint belongs to",
                },
            },
        },
    ),
    Tool(
        name="spec_validate_request",
        description=(
            "Validate a JSON payload against the requestBody schema of an endpoint. "
            "Returns whether the payload is valid and any field-level validation errors with hints."
        ),
        inputSchema={
            "type": "object",
            "required": ["operation_id", "payload", "spec_id"],
            "properties": {
                "operation_id": {
                    "type": "string",
                    "description": "The operationId of the endpoint to validate against",
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
    ),
]


# ── Handlers ──────────────────────────────────────────────────────────────────


@app.list_tools()
async def list_tools() -> list[Tool]:
    """Return all registered MCP tools."""
    return TOOLS


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Dispatch tool calls to the underlying async Python functions."""
    logger.info(f"call_tool: {name} with {list(arguments.keys())}")

    try:
        if name == "spec_search":
            results = await search_endpoints(
                query=arguments["query"],
                spec_id=arguments["spec_id"],
                limit=arguments.get("limit", 5),
            )
            return [
                TextContent(
                    type="text",
                    text=json.dumps(
                        [r.model_dump() for r in results], default=str
                    ),
                )
            ]

        elif name == "spec_get_endpoint":
            detail = await get_endpoint(
                operation_id=arguments["operation_id"],
                spec_id=arguments["spec_id"],
            )
            return [
                TextContent(
                    type="text",
                    text=json.dumps(detail.model_dump(), default=str),
                )
            ]

        elif name == "spec_validate_request":
            result = await validate_request(
                operation_id=arguments["operation_id"],
                payload=arguments["payload"],
                spec_id=arguments["spec_id"],
            )
            return [
                TextContent(
                    type="text",
                    text=json.dumps(result.model_dump(), default=str),
                )
            ]

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as exc:
        logger.error(f"call_tool {name} failed: {exc}", exc_info=True)
        return [
            TextContent(
                type="text",
                text=json.dumps({"error": str(exc)}),
            )
        ]


# ── Main entry point ─────────────────────────────────────────────────────────

async def main() -> None:
    """Run the MCP server over stdio transport."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
