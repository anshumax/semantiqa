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
**Renderer (React/Vite/Tailwind/ReactFlow)**  
UI only: Source Explorer with ReactFlow canvas for visual data source management, Results Grid, Inspector, Docs Editor (tiptap), Search. Optional NL chat appears only when enrichment is enabled.

**Canvas Implementation**: Uses ReactFlow library for node-based canvas interactions, eliminating custom zoom/pan/connection logic. ReactFlow provides built-in:
- Drag-and-drop node positioning
- Zoom/pan controls with mouse and touch support
- Connection creation via draggable handles  
- MiniMap for canvas overview
- Background patterns and grid snapping

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

## IPC Architecture & Best Practices
### Channel Registration
- **Preload allowlist:** ALL IPC channels must be explicitly added to preload's `allowedChannels` array
- **Channel-Service consistency:** Every handler in main process must have corresponding channel in preload
- **Schema validation:** Both request/response schemas must be defined in `channelToSchema` and `responseSchemas`

### Common Pitfalls
- ❌ Adding new IPC handler without updating preload allowlist → "Blocked attempt to access channel" errors
- ❌ Incomplete database initialization → Schema validation failures with null fields
- ❌ Missing response schema validation → Runtime type mismatches

### Debugging IPC Issues
1. Check browser console for "Blocked attempt" errors → Missing preload channel
2. Check schema validation errors → Database returning incomplete/malformed data
3. Verify main process handler registration matches preload channels

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

## Database Initialization & Schema Management
### Repository Pattern Best Practices
- **Complete entity creation:** `ensure*` methods must initialize ALL required fields with proper defaults
- **Schema compliance:** Generated entities must pass contract validation (Zod schemas)
- **Explicit upsert logic:** Use programmatic checks (`SELECT` → `UPDATE` or `INSERT`) instead of implicit SQL upserts
- **Null handling:** Avoid nullable database columns where contracts expect non-null values

### Database Upsert Policy (Critical)
**NEVER use implicit database upserts** (`INSERT OR REPLACE`, `ON CONFLICT DO UPDATE`):
- ❌ `INSERT OR REPLACE` acts as `DELETE` + `INSERT`, triggering `ON DELETE CASCADE` and losing child data
- ❌ Implicit upserts obscure application logic and cause unintended side effects
- ✅ Always use explicit programmatic flow: Check existence → `UPDATE` if exists, `INSERT` if not
- ✅ Keeps business logic visible in application code, not hidden in SQL semantics

**Example Pattern:**
```typescript
const existing = db.prepare('SELECT id FROM table WHERE id = ?').get(id);
if (existing) {
  db.prepare('UPDATE table SET ... WHERE id = ?').run(...);
} else {
  db.prepare('INSERT INTO table VALUES (...)').run(...);
}
```

### Common Database Pitfalls
- ❌ Partial entity initialization → Schema validation failures
- ❌ `INSERT OR REPLACE` for upserts → Cascades delete child records, data loss
- ❌ `INSERT OR IGNORE` for data fixes → Existing broken records remain unfixed  
- ❌ Missing default values → Runtime null/undefined errors
- ❌ Database schema mismatch with contracts → Type conversion errors

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

## Canvas Storage (SQLite)
Canvas state is stored separately from the main graph to support visual data source management and relationship mapping.

### Canvas Tables
- `canvas_state(id TEXT PK, name TEXT, description TEXT, viewport_zoom REAL, viewport_center_x REAL, viewport_center_y REAL, grid_size REAL, snap_to_grid BOOLEAN, auto_save BOOLEAN, theme TEXT, canvas_version TEXT, created_at TEXT, updated_at TEXT, last_saved_at TEXT)`
- `canvas_source_blocks(id TEXT PK, canvas_id TEXT, source_id TEXT, position_x REAL, position_y REAL, width REAL, height REAL, z_index INTEGER, color_theme TEXT, is_selected BOOLEAN, is_minimized BOOLEAN, custom_title TEXT, created_at TEXT, updated_at TEXT, UNIQUE(canvas_id, source_id))`
- `canvas_table_blocks(id TEXT PK, canvas_id TEXT, source_id TEXT, table_id TEXT, position_x REAL, position_y REAL, width REAL, height REAL, z_index INTEGER, color_theme TEXT, is_selected BOOLEAN, is_minimized BOOLEAN, custom_title TEXT, created_at TEXT, updated_at TEXT)`
- `canvas_relationships(id TEXT PK, canvas_id TEXT, source_id TEXT, target_id TEXT, source_table_id TEXT, target_table_id TEXT, source_column_name TEXT, target_column_name TEXT, relationship_type TEXT, confidence_score REAL, visual_style TEXT, line_color TEXT, line_width INTEGER, curve_path TEXT, is_selected BOOLEAN, created_at TEXT, updated_at TEXT)`

### Canvas Persistence Pattern (Write-Back Cache)
The canvas implements a **write-back persistence pattern** for optimal UX:

**Architecture:**
- **ReactFlow** manages UI state (node positions, edges) as source of truth during active editing
- **In-memory maps** (`inMemoryBlocks`, `inMemoryTableBlocks`, `inMemoryRelationships`) track changes
- **Debounced auto-save** writes to SQLite silently without triggering re-renders
- **Database serves as cold storage** - only read on view entry, never during active editing

**Critical Pattern (Preventing Re-render Loops):**
1. **On view entry**: Load positions from DB → Create ReactFlow nodes **ONCE** → Set flag to prevent recreation
2. **On user interaction**: ReactFlow updates internal state → `updateBlockPosition` updates in-memory map → Debounced save to DB
3. **During save**: Write to DB silently - **DO NOT** update React state or reload from DB
4. **On view exit**: Clear flags and in-memory state
5. **On view re-entry**: Fresh load from DB picks up persisted changes

**Anti-Patterns to Avoid:**
- ❌ Re-creating nodes on every effect run → Positions snap back to stale values
- ❌ Updating React state after save → Causes unnecessary re-renders
- ❌ Reading from `canvasData` during active editing → Creates fight between DB and ReactFlow state
- ❌ Including `canvasData` in effect dependencies → Triggers re-renders after save
- ✅ Use refs to track initialization state (`nodesCreatedRef`) - prevents node recreation
- ✅ Let ReactFlow own positions during editing - DB is write-only until view exit

**Implementation Details:**
```typescript
// Track whether nodes have been created for current view
const nodesCreatedRef = useRef(false);

useEffect(() => {
  if (currentLevel === 'tables' && !nodesCreatedRef.current) {
    // Create nodes ONCE from DB
    nodesCreatedRef.current = true;
    const nodes = createNodesFromDB(canvasData.tableBlocks);
    setNodes(nodes);
  } else if (currentLevel !== 'tables') {
    // Reset on exit
    nodesCreatedRef.current = false;
  }
  // NOTE: canvasData NOT in dependencies - prevents re-creation after save
}, [currentLevel, tablesData]);
```

### Relationship Model
**All meaningful relationships are table-to-table relationships** with optional column-level granularity:

- **Inter-source relationships**: Tables from different data sources (e.g., MySQL.users.id → PostgreSQL.customers.customer_id)
- **Intra-source relationships**: Tables from the same data source (e.g., MySQL.users.id → MySQL.orders.user_id)
- **Column-level relationships**: Specific column mappings within table relationships

The "source-to-source" visualization is a higher-level view that groups table relationships by source, but the actual relationship data always contains specific table and column information.

**Foreign Key Constraints:**
- `canvas_source_blocks.source_id` → `sources.id`
- `canvas_table_blocks.source_id` → `sources.id`
- `canvas_table_blocks.table_id` → `nodes.id` (where type='table')
- `canvas_relationships.source_id` → `sources.id`
- `canvas_relationships.target_id` → `sources.id`
- `canvas_relationships.source_table_id` → `nodes.id` (where type='table')
- `canvas_relationships.target_table_id` → `nodes.id` (where type='table')

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

## Development Workflow & Debugging
### Adding New Features
1. **Define contracts first:** Add request/response types and schemas in `/contracts`
2. **Update IPC config:** Add channel to `IPC_CHANNELS`, `channelToSchema`, `responseSchemas`  
3. **Add preload allowlist:** Include new channel in preload `allowedChannels` array
4. **Implement handler:** Add main process handler to `handlerMap`
5. **Test end-to-end:** Verify renderer → preload → main → back works correctly

### When Things Break
- **"Blocked attempt to access channel"** → Missing channel in preload allowlist
- **Schema validation errors** → Database returning unexpected data structure  
- **"Handler not found"** → Missing main process handler registration
- **Type errors at runtime** → Contract/implementation mismatch

### Architecture Verification Checklist
- [ ] New IPC channels added to preload allowlist
- [ ] Database initialization creates complete, valid entities
- [ ] All service methods handle edge cases (missing data, validation failures)
- [ ] Error handling provides meaningful feedback to renderer

## Extension Points
- **Adapters**: add MSSQL/Oracle later without touching core.
- **Transport**: optional HTTP controllers can bind the same use‑cases.
- **Sync server**: changelog‑based diff push/pull; node/edge LWW; docs via CRDT merge; pgvector for org‑wide search.

---
**Outcome:** A tight, auditable Electron app with out‑of‑the‑box semantic search, optional one‑click enrichment via node‑llama‑cpp, minimal attack surface, and clear seams to add HTTP and team sync later—without refactoring.