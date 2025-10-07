# Semantiqa — Architecture (Full v1.1)

**Goal:** A local-first, read-only Electron desktop that maps schemas, explains them in plain English, answers safe NL→SQL, and stores a lightweight graph in SQLite. Optional on-device AI enrichment runs CPU-only with a built-in Model Manager. A future on‑prem sync server reuses the same contracts.

## Architecture Invariants (Non‑Negotiables)
- **Local-first, offline-capable.** No cloud required. CPU-only inference.
- **Read‑only to data sources.** Only `SELECT`. SQL firewall, `EXPLAIN`, and auto‑`LIMIT` enforced centrally.
- **Renderer sandboxed.** `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`; no remote content.
- **All privileged ops behind IPC.** Renderer never touches FS, DB drivers, or models directly.
- **No raw PII persisted.** Mask by default in previews; exports are explicit, logged, and user-initiated.
- **Audit everything.** Append-only logs for queries, edits, exports, model actions.
- **Small, typed surface.** Contracts (DTOs + JSON Schemas) are the single source of truth.

## High‑Level Components
**Renderer (React/Vite/Tailwind)**  
UI only: Source Explorer, Results Grid, Graph (Cytoscape), Inspector, Docs Editor (tiptap), Search. Optional NL chat appears only when enrichment is enabled.

**Preload (contextBridge)**  
Versioned IPC bridge exposing a minimal, schema‑validated API.

**Main (Privileged Node)**  
Owns DB drivers, SQLite store, embeddings (ONNX), generator (node‑llama‑cpp), policy guard, audit. Spawns **Worker Threads** for heavy tasks (profiling, embeddings, summarization, NL→SQL).

**Core Services (transport‑agnostic TypeScript)**  
Use‑cases (query, metadata, graph, docs, search), central **policy guard** (SELECT‑only, blocklists, caps), lineage helpers, changelog logic. **Ports & Adapters** pattern with DTOs/JSON Schemas under `/contracts`.

**Adapters (Node)**  
- DB connectors: Postgres (`pg`), MySQL (`mysql2`), Mongo (`mongodb`), DuckDB (CSV/Parquet), SQLite (local store).
- Storage: SQLite GraphRepo, embeddings index, changelog, provenance.
- LLM: **Embeddings via ONNX** (bundled). **Generator via node‑llama‑cpp** (optional download).
- Policy/Audit: centralized enforcement + append-only JSONL.

**(Future) On‑prem Sync Server (Spring Boot)**  
RBAC/SSO, merges (LWW/CRDT), audit rollups, org‑wide semantic search (pgvector). Reuses the same `/contracts` and DTOs.

## Simple UX (Principle)
Home screen offers **three buttons**:  
1) **Connect Source** (read-only)  
2) **Search & Explore** (works immediately; embeddings bundled)  
3) **Enable AI Enrichment** (optional; one‑click model download)

Enrichment is purely additive and never blocks core flows.

## Model & Inference
- **Embeddings (bundled):** Small ONNX model (e.g., `bge-small` class, Apache‑2.0) ships with installer and runs via `onnxruntime-node`. Powers semantic search out‑of‑the‑box.
- **Generator (optional download):** Curated **7B GGUF** (Llama/Mistral class, Q4/Q5) downloaded inside the app; runs via **node‑llama‑cpp** in worker threads.
- **Caching:** Content‑hash caches for summaries and NL→SQL prompts; incremental embedding updates.
- **No model required** for core value; if generator is off, NL chat is hidden and summaries use heuristics/templates.

### Model Manager
- Catalog of curated models (name, size, license, perf estimate). **One‑click download/resume** with SHA256 verify.
- Install under user app data; IT can **pre‑seed** folders; strictly offline after download.
- Healthcheck (tokens/sec, latency); per‑task toggles (Summaries, NL→SQL). All actions audited.

## Data Flows
1) **Connect Source** → Verify read‑only creds → Crawl schema (tables/columns/PK/FK/indexes) + light profiling (null/distinct/min/max on capped samples) → Snapshot to SQLite.
2) **Search** → Uses bundled embeddings + keyword to rank entities → Jump to nodes in Explorer/Graph.
3) **Summaries (optional)** → If generator enabled, draft table/column descriptions → user reviews/edits → cache; otherwise show heuristic skeletons.
4) **NL→SQL (optional)** → Retrieve relevant schema, generate candidate **SELECT** → parse to AST → apply policy → `EXPLAIN` → run with `LIMIT` → masked grid preview. Save as **Metric** (reusable SQL with definition).
5) **Graph & Docs** → Add/Update nodes/edges; Yjs CRDT docs for descriptions/notes; embeddings updated; changelog appended.
6) **Export** → Data dictionary/graph to Markdown/PDF; explicit action; audited.

## IPC Contracts (Renderer ↔ Main, v1)
All payloads validated (zod/JSON Schema); every call audited.
- `sources.add(readOnlyConn): SourceId`
- `metadata.crawl({sourceId}): SchemaSnapshot`
- `search.semantic({q, scope}): SearchResults`
- `nlsql.generate({question, scope}): {sql, plan, warnings}`
- `query.runReadOnly({sourceId, sql, maxRows}): {columns, rows, truncated}`
- `graph.get({filter}): {nodes, edges, stats}`
- `graph.upsertNode({patch}): Node`
- `graph.upsertEdge({patch}): Edge`
- `doc.get({nodeId}): YDocUpdate`
- `doc.update({nodeId, update}): Ack`
- `models.list(): {installed[], available[]}`
- `models.download({id}): Progress/Complete`
- `models.enable({id, tasks}): Ack`
- `models.healthcheck({id}): {latency, tokensPerSec, ok}`
- `audit.list({since}): AuditEntries`

## Local Storage (SQLite)
- `nodes(id TEXT PK, type TEXT, props JSON, owner_ids JSON, tags JSON, sensitivity TEXT, status TEXT, created_at, updated_at, origin_device_id)`
- `edges(id TEXT PK, src_id TEXT, dst_id TEXT, type TEXT, props JSON, created_at, updated_at, origin_device_id)`
- `docs(id TEXT PK, node_id TEXT, ydoc BLOB, created_at, updated_at)`  // Yjs CRDT
- `embeddings(id TEXT PK, owner_type TEXT, owner_id TEXT, vec BLOB, dim INT, model TEXT, updated_at)`
- `provenance(id TEXT PK, owner_type TEXT, owner_id TEXT, kind TEXT, ref TEXT, meta JSON)`  // commits, tickets
- `changelog(seq INTEGER PK AUTOINCREMENT, actor TEXT, entity TEXT, entity_id TEXT, op TEXT, patch JSON, ts, origin_device_id)`
- `models(id TEXT PK, name TEXT, kind TEXT, size_mb INT, path TEXT, sha256 TEXT, enabled_tasks JSON, installed_at, updated_at)`
- `settings(key TEXT PK, value JSON)`

**Indexes:** `(type)`, `(updated_at)`, `(src_id,type)`, `(dst_id,type)`, `(owner_type,owner_id)`.

## Security
- Renderer has no FS/network/driver access; only IPC.
- SQL firewall denies DDL/DML; allowlist schemas; time/row caps; PII cross‑joins blockable.
- PII columns classified (regex + manual flags); masked in results; no automatic caching of row data.
- Credentials stored in OS keychain (keytar); never in SQLite.
- Model downloads require license acceptance; SHA256 verify; no auto‑fetch.
- CSP strict; code‑signed installers; no eval/remote.

## Performance & Reliability
- Worker pool; Main loop never blocks.
- Bounded sampling for profiling; streaming rows to grid; pagination.
- Caches for summaries, embeddings, search results; invalidation by content hash or `updated_at`.
- Typed errors: `PolicyViolation`, `DialectUnsupported`, `Timeout`, mapped to friendly UI.

## Testing & CI Gates
- **Golden NL→SQL**: ~30 prompts → expected ASTs; fail on deviation.
- **Policy**: DML/DDL/blocked joins rejected; PII masks verified.
- **Embeddings**: functional on clean offline VM (bundled).
- **Model Manager**: download + resume + checksum; generator disabled by default.
- **Perf**: 50‑table summary completes < 60s on CPU reference laptop.
- **Electron security audit**: renderer flags enforced; IPC payload validation required.
- **Contracts**: DTOs generate JSON Schemas/OpenAPI; changes require ADR + tests.

## Packaging & Updates
- `electron-builder` → signed installers (Win/macOS). Auto‑update disabled; provide offline packages.
- Installer **bundles ONNX embeddings**; generator models are **not bundled** (download on demand).

## Extension Points
- **Adapters**: add MSSQL/Oracle later without touching core.
- **Transport**: optional HTTP controllers can bind the same use‑cases.
- **Sync server**: changelog‑based diff push/pull; node/edge LWW; docs via CRDT merge; pgvector for org‑wide search.

---
**Outcome:** A tight, auditable Electron app with out‑of‑the‑box semantic search, optional one‑click enrichment via node‑llama‑cpp, minimal attack surface, and clear seams to add HTTP and team sync later—without refactoring.