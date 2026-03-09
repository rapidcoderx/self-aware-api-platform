# Self-Aware API Platform — Quickstart Guide

> One-command demo start, step-by-step demo walkthrough, and troubleshooting reference.

---

## Prerequisites

Before using the management script, confirm these are installed and ready:

| Requirement | Check | Notes |
|---|---|---|
| PostgreSQL 16 | `pg_isready` | DB `selfaware_api` must exist with schema applied |
| pgvector 0.8.x | `psql -c "SELECT extversion FROM pg_extension WHERE extname='vector'"` | Must return `0.8.x` |
| Python 3.12.12 | `cat .python-version` | Managed via `uv` venv at `backend/.venv` |
| Node.js ≥ 18 | `node --version` | For Vite and Prism |
| uv | `uv --version` | Python package manager |
| `.env` file | `ls backend/.env` | Must contain `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` |

---

## The Management Script

All platform operations go through a single entry point:

```
./deploy/manage.sh <command> [options]
```

### Commands at a glance

| Command | What it does |
|---|---|
| `start` | Start backend (FastAPI), frontend (Vite), and Prism mock server |
| `stop` | Gracefully stop all three services |
| `restart` | Stop then start all services |
| `status` | Show running/stopped state for every service + PostgreSQL |
| `logs [svc]` | Tail logs — service is `backend`, `frontend`, `prism`, or `all` |
| `clean-db` | Wipe ALL demo data from the database (interactive confirm) |
| `demo-reset` | **One-command full reset**: wipe data + start all services |

### Log files

All service output is stored in `deploy/logs/`:

```
deploy/logs/
  backend.log    ← FastAPI / uvicorn output
  frontend.log   ← Vite dev server output
  prism.log      ← Prism mock server output
```

### PID tracking

Process IDs are stored in `deploy/pids/` so `stop` and `status` know what to kill.
These files are created automatically on `start` and removed on `stop`.

---

## First-time Setup

### 1 — Make the script executable (one time only)

```bash
chmod +x deploy/manage.sh
```

### 2 — Verify your `.env` file

```bash
cat backend/.env.example   # see required keys
cp backend/.env.example backend/.env
# Edit backend/.env — fill in ANTHROPIC_API_KEY and VOYAGE_API_KEY
```

### 3 — Install Python dependencies (if not done)

```bash
cd backend
uv venv --python 3.12.12
source .venv/bin/activate
uv pip install -r requirements.txt
cd ..
```

### 4 — Install Node dependencies (if not done)

```bash
cd frontend && npm install && cd ..
```

### 5 — Apply the database schema (if not done)

```bash
psql -h localhost -p 5432 -d selfaware_api -f backend/storage/init_db.sql
```

---

## Running the Demo

### Option A — Full one-command reset (recommended before every demo run)

```bash
./deploy/manage.sh demo-reset
```

This will:
1. Wipe all existing demo data (specs, endpoints, diffs, audit logs) — **non-interactively**
2. Reset all DB sequences to 1
3. Start Backend → Frontend → Prism in order
4. Confirm each service is healthy on its port
5. Print the URL summary

---

### Option B — Manual step-by-step

```bash
# Step 1: clean data from previous runs
./deploy/manage.sh clean-db

# Step 2: start all services
./deploy/manage.sh start

# Step 3: verify everything is up
./deploy/manage.sh status
```

---

## The Three Demo Flows

Once the platform is running, open the frontend at **http://localhost:5173**.

---

### Demo 1 — Discover & Validate (90 seconds)

**Goal**: Show that the agent can find and validate an API endpoint using tool calls.

**Steps:**

1. Click **"Upload Spec"** in the top bar
2. Select `specs/banking-api-v1.yaml` — wait for the green "Ingested" toast
3. In the **Chat Panel**, type:
   ```
   How do I create a corporate deposit account?
   ```
4. Watch the agent call tools in sequence:
   - `search_endpoints` → finds `POST /accounts/create`
   - `get_endpoint` → endpoint card appears with full schema
   - Agent generates an example payload
   - `validate_request` → green **"Valid ✓"** badge appears
5. Point out the **Provenance badge**: shows `spec: banking-api-v1 | operationId: createAccount`

**What to say**: *"The agent never touches the database. Everything goes through typed MCP tools. The provenance badge proves which spec version answered the question."*

---

### Demo 2 — Breaking Change Detection (60 seconds)

**Goal**: Show automatic diff and classification of breaking vs non-breaking changes.

**Steps:**

1. Click **"Upload Spec"** again
2. Select `specs/banking-api-v2.yaml` — wait for ingestion
3. Click **"Compare with v1"** (or navigate to the Diff Panel)
4. The diff loads — point out the colour coding:
   - 🔴 **BREAKING**: `companyRegistrationNumber` added as a required field
   - 🔴 **BREAKING**: `accountType` enum — `deposit` removed, `corporate` added
   - 🟡 **NON-BREAKING**: `kycStatus` optional field added
5. Show the Impact Panel:
   - `onboarding-service` — **HIGH** severity
   - `crm-integration` — **HIGH** severity
   - `mobile-app-backend` — **HIGH** severity
   - Summary: *"2 breaking changes, 3 downstream services affected"*

**What to say**: *"The system classified every change as breaking or non-breaking using schema comparison — no hand-coded rules. The impact analysis maps changes to real downstream teams via a dependency graph."*

---

### Demo 3 — Self-Heal & Migration Plan (60 seconds)

**Goal**: Show the agent generating a validated, human-reviewable migration.

**Steps:**

1. From the Diff/Impact view, click **"Generate Migration Plan"**
2. The Migration Panel opens:
   - **Before** payload (red background) — missing `companyRegistrationNumber`
   - **After** payload (green background) — field added, enum value updated
   - `validate_request` is called on the "after" payload → **"Valid ✓"**
   - Step-by-step migration instructions listed
3. Click **"Export Migration Plan"** (downloads JSON)
4. Open the **Audit Log Modal** (bottom of the Responsible AI panel)
   - Every tool call visible: name, inputs, outputs, duration_ms
   - Estimated tokens shown

**What to say**: *"Every recommendation is schema-validated before it's shown. The audit log gives complete traceability — you know exactly what the agent decided and why. Nothing is a black box."*

---

## Checking Service Health During Demo

```bash
# Quick check
./deploy/manage.sh status

# If something looks wrong, tail the relevant log
./deploy/manage.sh logs backend
./deploy/manage.sh logs prism
./deploy/manage.sh logs frontend
```

---

## Stopping Everything

```bash
./deploy/manage.sh stop
```

---

## Database Cleanup Reference

The cleanup script (`deploy/db-clean.sql`) truncates all four data tables and resets sequences:

```
audit_logs  →  0 rows
diffs       →  0 rows
endpoints   →  0 rows
specs       →  0 rows
```

The DDL (table definitions, indexes, extensions) is **never touched**. The schema is always preserved.

To run cleanup manually without the script:

```bash
psql -h localhost -p 5432 -d selfaware_api -f deploy/db-clean.sql
```

---

## Troubleshooting

### Port already in use

```bash
# Find what's using a port
lsof -i :8000
lsof -i :5173
lsof -i :4010

# Kill it
kill -9 <pid>

# Or let the script handle it
./deploy/manage.sh stop
```

### Backend won't start — import errors

```bash
cd backend
source .venv/bin/activate
python -c "import fastapi, anthropic, voyageai, psycopg2, prance; print('All imports OK')"
```

If any import fails:

```bash
uv pip install -r requirements.txt
```

### Prism fails to start

```bash
# Check Node is available
node --version   # must be ≥ 18

# Check the spec file exists
ls specs/banking-api-v1.yaml

# Run Prism directly to see the error
npx @stoplight/prism-cli mock specs/banking-api-v1.yaml --port 4010
```

### Vector search returns no results

The endpoints table may be empty. Re-ingest the spec:

```bash
curl -X POST http://localhost:8000/api/specs/ingest \
  -F "file=@specs/banking-api-v1.yaml" \
  -F "name=banking-api"
```

### PostgreSQL connection refused

```bash
# macOS — start if stopped
brew services start postgresql@16

# Verify
pg_isready -h localhost -p 5432
```

---

## Service URLs Summary

| Service | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Backend (FastAPI) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Prism Mock Server | http://localhost:4010 |
| Health Check | http://localhost:8000/health |
