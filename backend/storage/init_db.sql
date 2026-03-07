-- ============================================================
-- Self-Aware API Platform — Database Schema
-- PostgreSQL 16 + pgvector 0.8.x
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Specs: one row per ingested spec version
CREATE TABLE IF NOT EXISTS specs (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    spec_json   JSONB NOT NULL,
    hash        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, version)
);

-- Endpoints: one row per operation, with vector embedding
CREATE TABLE IF NOT EXISTS endpoints (
    id           SERIAL PRIMARY KEY,
    spec_id      INTEGER REFERENCES specs(id) ON DELETE CASCADE,
    operation_id TEXT NOT NULL,
    method       TEXT NOT NULL,
    path         TEXT NOT NULL,
    summary      TEXT,
    tags         TEXT[],
    schema_json  JSONB NOT NULL,
    embedding    vector(1024),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Diffs: structured diff between two spec versions
CREATE TABLE IF NOT EXISTS diffs (
    id             SERIAL PRIMARY KEY,
    spec_id_old    INTEGER REFERENCES specs(id),
    spec_id_new    INTEGER REFERENCES specs(id),
    diff_json      JSONB NOT NULL,
    breaking_count INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs: every MCP tool call recorded
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    tool_name   TEXT NOT NULL,
    inputs      JSONB,
    outputs     JSONB,
    spec_id     INTEGER,
    duration_ms INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (IVFFlat for cosine distance)
CREATE INDEX IF NOT EXISTS endpoints_embedding_idx
    ON endpoints USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Full-text fallback index on summary
CREATE INDEX IF NOT EXISTS endpoints_summary_fts_idx
    ON endpoints USING gin(to_tsvector('english', coalesce(summary, '')));
