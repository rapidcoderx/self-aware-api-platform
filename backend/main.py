# TODO-1: FastAPI app scaffold + health check ✅
# TODO-6: POST /api/specs/ingest — upload YAML/JSON, normalise, embed, store ✅

import logging
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Local imports after env + logging are configured
from ingestion.chunker import chunk_endpoint
from ingestion.embedder import embed_texts
from ingestion.normalizer import normalize_spec
from storage.schema_store import (
    bulk_insert_endpoints,
    delete_spec,
    list_specs,
    upsert_spec,
    verify_schema,
)


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Self-Aware API Platform starting…")
    try:
        if not verify_schema():
            logger.error("DB schema verification failed — run storage/init_db.sql first")
        else:
            logger.info("DB schema verified OK")
    except Exception as e:
        logger.error(f"DB unreachable at startup — continuing anyway: {e}")
    yield
    logger.info("Self-Aware API Platform shutting down")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Self-Aware API Platform",
    version="0.1.0",
    description=(
        "Agentic API intelligence platform: ingest OpenAPI specs, "
        "search endpoints, validate payloads, detect breaking changes, self-heal."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic response models ───────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class IngestResponse(BaseModel):
    spec_id: int
    name: str
    version: int
    endpoint_count: int
    message: str


class SpecListItem(BaseModel):
    id: int
    name: str
    version: int
    hash: str
    created_at: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="0.1.0",
        environment=os.getenv("ENVIRONMENT", "development"),
    )


@app.post(
    "/api/specs/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_spec(
    file: UploadFile = File(..., description="OpenAPI YAML or JSON spec file"),
    name: Optional[str] = Form(
        None, description="Logical spec name (defaults to filename without extension)"
    ),
) -> IngestResponse:
    """
    Upload an OpenAPI spec file.
    Normalises all endpoints, embeds them with Voyage AI, and stores
    everything in Postgres + pgvector. Auto-increments version on re-upload.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file has no filename")

    spec_name = name or file.filename.rsplit(".", 1)[0]
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    suffix = ".yaml" if file.filename.lower().endswith((".yaml", ".yml")) else ".json"
    tmp_path: Optional[str] = None

    try:
        # prance requires a real file path for $ref resolution
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # 1. Parse + normalise
        raw_spec, endpoints = normalize_spec(tmp_path)

        if not endpoints:
            raise HTTPException(status_code=422, detail="No endpoints found in spec")

        # 2. Store spec (idempotent on hash; auto-versions on new content)
        spec_id, version, is_new = upsert_spec(spec_name, raw_spec)

        if not is_new:
            return IngestResponse(
                spec_id=spec_id,
                name=spec_name,
                version=version,
                endpoint_count=len(endpoints),
                message="Spec already ingested (identical content) — no changes made",
            )

        # 3. Embed + persist — if either step fails, delete the orphaned spec row
        try:
            texts = [chunk_endpoint(ep) for ep in endpoints]
            embeddings = embed_texts(texts, input_type="document")
            bulk_insert_endpoints(spec_id, endpoints, embeddings)
        except Exception as embed_err:
            logger.error(
                f"Embedding/insert failed for spec_id={spec_id}, rolling back spec row: {embed_err}",
                exc_info=True,
            )
            try:
                delete_spec(spec_id)
            except Exception as del_err:
                logger.error(f"Orphan cleanup failed for spec_id={spec_id}: {del_err}")
            raise HTTPException(
                status_code=502,
                detail=f"Embedding pipeline failed: {embed_err}",
            )

        logger.info(
            f"Ingested '{spec_name}' v{version}: {len(endpoints)} endpoints, spec_id={spec_id}"
        )
        return IngestResponse(
            spec_id=spec_id,
            name=spec_name,
            version=version,
            endpoint_count=len(endpoints),
            message=f"Successfully ingested {len(endpoints)} endpoints as v{version}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingest failed for '{spec_name}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@app.get("/api/specs", response_model=list[SpecListItem])
async def list_all_specs() -> list[SpecListItem]:
    """List all ingested specs ordered by name and version."""
    return [SpecListItem(**s) for s in list_specs()]
