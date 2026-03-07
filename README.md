# Self-Aware API Platform

> Agentic API Intelligence using MCP, Change Detection, and Schema-Aware Reasoning

## Quick Start

```bash
# 1. Setup venv + install deps
./setup-venv.sh

# 2. Add API keys
code backend/.env

# 3. Start backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload

# 4. Start frontend
cd frontend && npm run dev

# 5. Start Prism mock
prism mock specs/banking-api-v1.yaml --port 4010
```

## Project Structure

```
backend/
  ingestion/   — OpenAPI normalizer, chunker, embedder
  storage/     — Postgres + pgvector ops
  tools/       — MCP tool implementations
  main.py      — FastAPI app
  mcp_server.py — MCP server
  agent.py     — Claude API orchestrator

frontend/src/components/
  ChatPanel.jsx
  DiffPanel.jsx
  ImpactPanel.jsx

specs/
  banking-api-v1.yaml   — Sample spec (baseline)
  banking-api-v2.yaml   — Sample spec (breaking changes)
  dependencies.yaml     — Mock dependency graph
```

## Tech Stack
- Python 3.12.12 + FastAPI + uv
- PostgreSQL 16 + pgvector 0.8.2
- Claude API (tool use) + MCP Python SDK
- Voyage AI (voyage-3 embeddings, dim=1024)
- React + Vite + Tailwind CSS
- Prism mock server
