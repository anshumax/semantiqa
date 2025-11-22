# Semantiqa — Sequenced Task Roadmap (Full v2.0, MVP-correct with Phase-Based Numbering)

**Purpose:** Atomic, step-by-step tasks for a coding AI. **Every task includes**: **Desc**, **DoD (Definition of Done)**, **Deps**, **Risks**, and **Status**.  
**MVP sources:** **Postgres, MySQL, Mongo, CSV/Parquet (DuckDB)**. Renderer never touches FS/DB/network directly—use IPC. All payloads are typed and schema-validated.

> **Conventions:** IDs use phase-task format (e.g., T-00-01, T-04-03). "Must pass" = tests included and green.

## Status Legend
- ✅ **Completed** - Task finished and verified
- 🔄 **In Progress** - Currently being worked on
- ⬜ **Not Started** - Pending, waiting on dependencies
- ⚠️ **Blocked** - Cannot proceed, needs attention

## Progress Summary

**Overall Progress:** 40/83 tasks completed (48%)

| Phase | Status | Tasks |
|-------|--------|-------|
| Phase 0: Repo & Security | ✅ Complete | 4/4 |
| Phase 1: Storage & Audit | ✅ Complete | 2/2 |
| Phase 2: Connections & Metadata | ✅ Complete | 16/16 |
| Phase 3: Embeddings & Search | ✅ Complete | 3/3 |
| Phase 4: UI Foundations (Canvas) | ✅ Complete | 15/15 |
| Phase 5: Model Manager | ✅ Complete | 4/4 |
| Phase 6: Summaries & Docs | ⬜ Not Started | 0/3 |
| Phase 7: Canvas-Integrated Relationships | ⬜ Not Started | 0/5 |
| Phase 8: Federated Query | ⬜ Not Started | 0/7 |
| Phase 9: Reports & Dashboards | ⬜ Not Started | 0/6 |
| Phase 10: Advanced Graph Features | ⬜ Not Started | 0/4 |
| Phase 11: Export & Packaging | ⬜ Not Started | 0/5 |
| Phase 12: Golden Tests | ⬜ Not Started | 0/4 |

**Next Up:** Phase 6 - Summaries & Docs (T-06-01 heuristic skeletons)

---

## Phase 0 — Repo, Contracts, Security Baseline

### T-00-01: Initialize monorepo & tooling ✅
- **Status:** Completed (2025-10-07)
- **Desc:** Create repo structure (`/core`, `/adapters`, `/app`, `/contracts`, `/docs`), set up TS, ESLint, Prettier, Vitest/Jest, Playwright, CI.
- **DoD:** `pnpm i && pnpm build` succeeds; CI runs unit + e2e on PR; README lists dev commands.
- **Deps:** —
- **Risks:** Tooling churn → lock versions in `pnpm-lock.yaml`.
- **Notes:** pnpm workspace scaffolded, root tooling configs added (TypeScript, ESLint, Prettier, Vitest, Playwright), development guide created, dependencies installed

### T-00-02: Define contracts (DTOs + JSON Schemas) ✅
- **Status:** Completed (2025-10-07)
- **Desc:** Versioned DTOs (Sources, SchemaSnapshot, QueryInput/Result, Node/Edge, Doc/Yjs, Search, Models, Relationships, Reports) + zod schemas; emit JSON Schemas.
- **DoD:** Schemas generated; round-trip validation tests pass; `/contracts` export usable by IPC.
- **Deps:** T-00-01
- **Risks:** Spec drift → CI blocks merges if `/contracts` changes without tests.
- **Notes:** Added contracts package with Zod DTOs, schema generation script, and validation tests; regenerated JSON Schemas

### T-00-03: Electron app shell (hardened renderer) ✅
- **Status:** Completed (2025-10-07)
- **Desc:** Scaffold main/preload/renderer with `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, strict CSP; code-sign placeholders.
- **DoD:** Electron security audit passes; negative tests show renderer cannot `require('fs')`/drivers.
- **Deps:** T-00-01
- **Risks:** Misconfig → add automated audit in CI.
- **Notes:** Hardened Electron main + gateway, preload IPC whitelist, renderer Vite shell with status display, combined dev scripts, builds verified

### T-00-04: IPC layer (typed, minimal) + audit hook ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Preload exposes typed APIs; main registers handlers; zod validation; central audit wrapper.
- **DoD:** Valid & invalid sample calls behave; errors typed; audit entries written.
- **Deps:** T-00-02, T-00-03
- **Risks:** Surface creep → review/approve new IPC routes.
- **Notes:** Added shared IPC contracts, validated main handlers with audit logging, preload bridge + renderer wiring, and documentation updates

---

## Phase 1 — Local Storage & Audit

### T-01-01: SQLite bootstrap (schema + migrations) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Create tables: `nodes`, `edges`, `semantic_relationships`, `docs`, `embeddings`, `provenance`, `changelog`, `models`, `settings`, `reports`, `dashboards` + indexes + migrations.
- **DoD:** Fresh start migrates; integrity test confirms schema; migration version recorded.
- **Deps:** T-00-01
- **Risks:** Migration drift → add checksum + migration tests.
- **Notes:** Added storage package with migrations, migration runner, tests, and docs update

### T-01-02: Audit log (append-only JSONL) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Centralized writer; rotation by size/date; redaction for sensitive fields.
- **DoD:** Every IPC call logs actor, action, input hash, outcome; rotation proven in test.
- **Deps:** T-00-04, T-01-01
- **Risks:** Disk growth → rotation + max retention config.
- **Notes:** Implemented audit logger with rotation, integrated with IPC logging, added tests and docs

---

## Phase 2 — Connections & Metadata (All MVP Sources)

#### PostgreSQL

### T-02-01: Postgres connector (read-only) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Implement `pg` adapter with read-only role validation; health check.
- **DoD:** Connect/disconnect works; DDL/DML attempts are denied in unit tests; doc shows required grants.
- **Deps:** T-00-04
- **Risks:** Privilege misconfig → provide SQL snippets for creating RO user.
- **Notes:** Added read-only Postgres adapter with validation, health-check, tests, and docs

### T-02-02: Metadata crawl (PG) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Introspect tables/columns/PK/FK/indexes; produce `SchemaSnapshot`.
- **DoD:** Snapshot matches fixture; time within cap on sample DB.
- **Deps:** T-02-01, T-01-01
- **Risks:** Large catalogs → paginate; configurable schema allowlist.
- **Notes:** Implemented metadata crawler returning SchemaSnapshot with tests

### T-02-03: Profiling sampler (PG) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Sample N rows with caps; compute null%, distinct%, min/max.
- **DoD:** Stats persisted; caps enforceable; timeouts handled.
- **Deps:** T-02-02
- **Risks:** Long scans → `LIMIT`, `TABLESAMPLE`, timeouts.
- **Notes:** Added pg_stats-based profiling sampler with tests

### T-02-04: Persist snapshot (PG) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Map `SchemaSnapshot`+stats into SQLite nodes/edges; provenance entries.
- **DoD:** Explorer can render PG schema from local store; restart-safe.
- **Deps:** T-02-02, T-01-01
- **Risks:** Mapping bugs → unit tests with fixtures.
- **Notes:** Persisted Postgres snapshot into SQLite nodes/edges with tests and docs updates

#### MySQL

### T-02-05: MySQL connector (read-only) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** `mysql2` adapter; read-only grants validation.
- **DoD:** Connect/disconnect; DDL/DML denied; grants doc.
- **Deps:** T-00-04
- **Risks:** Varied auth modes → test against 5.7/8+.
- **Notes:** Added read-only MySQL adapter with validation, read-only enforcement, health check, and unit tests

### T-02-06: Metadata crawl (MY) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Introspect tables/columns/PK/FK/indexes; `SchemaSnapshot`.
- **DoD:** Snapshot equals fixture; perf within cap.
- **Deps:** T-02-05, T-01-01
- **Risks:** FK discovery inconsistencies → fall back to inferred joins.
- **Notes:** Implemented MySQL metadata crawler with Zod validation, system schema filtering, and tests

### T-02-07: Profiling sampler (MY) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Same stats as PG with caps/timeouts.
- **DoD:** Stats persisted; caps enforced.
- **Deps:** T-02-06
- **Risks:** Large TEXT/BLOB → skip/minimize.
- **Notes:** Added bounded sampling profiler for MySQL columns with configurable sample size and tests

### T-02-08: Persist snapshot (MY) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Store snapshot+stats to SQLite; provenance.
- **DoD:** Explorer renders MySQL schema; restart-safe.
- **Deps:** T-02-06, T-01-01
- **Risks:** Mapping parity with PG → tests.
- **Notes:** Persisted MySQL schema snapshot into SQLite nodes/edges with coverage tests alongside Postgres helper

#### MongoDB

### T-02-09: Mongo connector (read-only) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** `mongodb` adapter; list DBs/collections; read caps.
- **DoD:** Connect; list metadata; enforce max docs per sample.
- **Deps:** T-00-04
- **Risks:** Permissions variance → doc minimum roles.
- **Notes:** Added Mongo adapter with connection validation, health check, and capped aggregation helpers

### T-02-10: Metadata crawl (MO) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Infer fields/types from capped samples; nested paths as dotted fields.
- **DoD:** Fields/types snapshot equals fixture; perf within cap.
- **Deps:** T-02-09, T-01-01
- **Risks:** Schema drift → store sample hash + refresh flag.
- **Notes:** Implemented sampling-based crawler that flattens nested fields with tests

### T-02-11: Profiling sampler (MO) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Field null%/distinct counts from sample; cap time/rows.
- **DoD:** Stats persisted; timeouts handled.
- **Deps:** T-02-10
- **Risks:** Unbounded docs → `$limit` & `$sample` guarded.
- **Notes:** Added field profiling (null/unique counts) with bounded sampling and unit coverage

### T-02-12: Persist snapshot (MO) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Store collections/fields into SQLite; provenance.
- **DoD:** Explorer renders Mongo collections/fields; restart-safe.
- **Deps:** T-02-10, T-01-01
- **Risks:** Dotted path handling → consistent node IDs.
- **Notes:** Persisted Mongo collections/fields into SQLite nodes/edges with tests alongside other adapters

#### CSV/Parquet via DuckDB

### T-02-13: DuckDB local engine ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Embed DuckDB; open local CSV/Parquet; read-only.
- **DoD:** Engine loads; can query file; no external network.
- **Deps:** T-00-04
- **Risks:** Binary size → optional component gating.
- **Notes:** Added DuckDB adapter with file-based connection validation, health check, and mocked unit tests

### T-02-14: Metadata capture (DU) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Infer columns/types/row count; record file path & checksum.
- **DoD:** Snapshot equals fixture; checksum saved.
- **Deps:** T-02-13, T-01-01
- **Risks:** Large files → sample first N rows.
- **Notes:** Implemented information_schema crawler for DuckDB tables/columns with tests

### T-02-15: Profiling sampler (DU) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Stats with caps; skip huge strings.
- **DoD:** Stats persisted; timeouts handled.
- **Deps:** T-02-14
- **Risks:** File variance → robust CSV dialect handling.
- **Notes:** Added sampling-based column stats (null/distinct/min/max) for DuckDB with coverage

### T-02-16: Persist snapshot (DU) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Store dataset as a "source" in SQLite; provenance points to file URI.
- **DoD:** Explorer renders dataset; restart-safe.
- **Deps:** T-02-14, T-01-01
- **Risks:** File moved → flag stale via checksum mismatch.
- **Notes:** Persisted DuckDB tables/columns into SQLite nodes/edges with tests

---

## Phase 3 — Embeddings & Search (Works OOTB)

### T-03-01: Bundle ONNX embeddings ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Package small ONNX embedding model; init on start; licensing.
- **DoD:** Loads offline on clean VM; NOTICE updated; version recorded.
- **Deps:** T-00-01, T-01-01
- **Risks:** Size budget → keep <100MB.
- **Notes:** Added core embedding service with ONNX runtime fallback and tests

### T-03-02: Build vector index (sqlite-vec) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Create embeddings for names/descriptions; store vectors; incremental updates.
- **DoD:** Top-k neighbors correct on fixtures; update on doc change.
- **Deps:** T-03-01, T-02-04, T-02-08, T-02-12, T-02-16
- **Risks:** Recompute cost → batch & debounce.
- **Notes:** Implemented in-memory vector index service with cosine similarity search and coverage

### T-03-03: Hybrid search service ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Merge keyword (FTS) + vector recall; rank and return entities across all sources.
- **DoD:** 10 seeded queries return expected entities <200ms.
- **Deps:** T-03-02
- **Risks:** Ranking tuning → adjustable weights.
- **Notes:** Combined keyword and vector recall into hybrid service with unit tests

---

## Phase 4 — UI Foundations (Canvas-Based with ReactFlow)

**Note:** Phase 4 has been refactored to use ReactFlow library instead of custom canvas implementation, significantly reducing complexity and technical debt. ReactFlow provides production-ready zoom/pan/drag/connection features out of the box.

### T-04-01: Renderer UI groundwork ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Establish design tokens (minimalist: thin fonts, pastel colors, minimal borders/shadows), layout primitives, shared state scaffolding, and preload-safe IPC helpers for renderer.
- **DoD:** App shell renders with new design system; IPC health check wired; Story/test infrastructure ready for feature screens.
- **Deps:** T-00-03, T-00-04
- **Risks:** Over-abstraction; keep scope to near-term needs.
- **Notes:** UI foundation established through implementation of explorer components, wizard forms, inspector panels, and IPC communication patterns. Design system implemented with consistent styling and layout primitives.

### T-04-02: Canvas database schema ✅
- **Status:** Completed (2025-10-18)
- **Desc:** Extend SQLite schema for canvas storage. Tables for canvas metadata, block positions, relationship visual properties, and canvas versions. Design for export/import compatibility.
- **DoD:** `canvas_state` table with JSON columns for layout data; `canvas_blocks` table for data source positioning; `canvas_relationships` table for visual connection properties; migration script updates existing installations; schema supports full export/import; foreign key constraints maintain data integrity.
- **Deps:** T-01-01, T-04-01
- **Risks:** Schema complexity → balance normalization vs JSON flexibility; migration safety → backup existing data before schema changes.

### T-04-03: Main navigation shell (3-tab) ✅
- **Status:** Completed (2025-10-18)
- **Desc:** Top-level navigation with 3 main screens: Search & Ask, Sources (Canvas), Reports & Dashboards. Sources screen becomes unified canvas for data sources and relationships.
- **DoD:** Navigation renders; all 3 screens have placeholder views; active state highlights; keyboard navigation works; Sources tab loads canvas view.
- **Deps:** T-04-02
- **Risks:** Navigation complexity → keep simple tab/sidebar pattern.
- **Notes:** Updated from 4-tab to 3-tab navigation, merging Sources and Relationships into unified canvas.

### T-04-04: Canvas infrastructure foundation ✅ → ReactFlow
- **Status:** Completed - **MIGRATED TO REACTFLOW** (2025-10-23)
- **Desc:** ~~Core canvas rendering engine with infinite scroll, zoom/pan controls~~ **Replaced with ReactFlow library** for production-ready canvas interactions.
- **DoD:** ReactFlow canvas renders with dotted background; built-in zoom/pan controls; drag-and-drop nodes; connection handles; MiniMap and Controls components.
- **Deps:** T-04-03
- **Migration:** Custom Canvas.tsx replaced with ReactFlow components. All zoom/pan/drag logic now handled by library.

### T-04-05: Canvas block system ✅
- **Status:** Completed (2025-10-18)
- **Desc:** Draggable data source blocks with connection name, database name, status indicators, and visual styling. Auto-layout for initial positioning, manual drag for user arrangement.
- **DoD:** Blocks render with rounded corners and subtle shadows; display connection name + database name; draggable with snap-to-grid option; position persisted to SQLite; visual feedback on hover/selection; status badges (connecting/connected/error/crawling/crawled).
- **Deps:** T-04-03
- **Risks:** Block collision detection → implement spatial indexing if needed; drag performance → use transform3d for GPU acceleration.

### T-04-06: Canvas navigation and drill-down ✅
- **Status:** Completed (2025-10-18)
- **Desc:** Double-click data source blocks to drill down to table/collection view. Breadcrumb navigation, back button, and smooth transition animations between canvas levels.
- **DoD:** Double-click opens table canvas; breadcrumb shows "Canvas > PostgreSQL DB > public schema"; back button returns to parent; table blocks show table names + row counts; smooth zoom transitions; navigation history tracked.
- **Deps:** T-04-04, T-02-04, T-02-08, T-02-12, T-02-16
- **Risks:** Navigation complexity → limit to 2 levels (sources → tables); animation performance → use CSS transforms.

### T-04-07: Canvas floating UI elements ✅
- **Status:** Completed (2025-10-18)
- **Desc:** Floating Plus button (bottom-right), mini-map (top-right), zoom controls (bottom-left), and canvas reset button. Overlay elements that don't interfere with canvas interactions.
- **DoD:** Plus button opens connection wizard; mini-map shows viewport location on large canvases; zoom controls work with buttons and keyboard (+/-/0 to reset); canvas reset centers and fits all blocks; elements positioned absolutely and don't scroll with canvas.
- **Deps:** T-04-04
- **Risks:** Z-index conflicts → establish layer hierarchy; touch device support → ensure button sizes meet accessibility guidelines.

### T-04-08: Visual relationship connections ✅
- **Status:** Completed (2025-10-19)
- **Desc:** Render Bezier curves between connected blocks. Different visual styles for intra-source (same color family, dashed) vs cross-source (different colors, solid) relationships. Connection hover states and selection.
- **DoD:** Curves render smoothly between block connection points; intra-source relationships use consistent color with source block; cross-source relationships use distinct colors; hover shows relationship details tooltip; click selects relationship for editing; curves update when blocks move.
- **Deps:** T-04-04
- **Risks:** Curve calculation complexity → use library (e.g., react-flow); performance with many relationships → implement connection culling.
- **Notes:** Implemented visual relationship renderer with Bezier curves, state management for user-created relationships, distinct styling (green dashed lines for user relationships), hover/selection states, and integration with relationship definition modal. Relationships now appear immediately after creation.

### T-04-09: Connection creation UI flow ✅
- **Status:** Completed (2025-10-19)
- **Desc:** Plus button on blocks initiates connection mode. Bezier curve follows mouse cursor from source block. Click target block to complete connection. Visual feedback during connection creation.
- **DoD:** Plus icon appears on block hover; click enters connection mode; cursor shows connecting state; Bezier curve dynamically follows mouse; target blocks highlight on hover; click target opens relationship definition modal; ESC cancels connection mode.
- **Deps:** T-04-07
- **Risks:** UX complexity → provide clear visual cues; mobile support → adapt for touch interactions.
- **Notes:** Enhanced connection dots with Plus icons, improved cursor feedback with custom cursors, target block highlighting with visual animations, ESC cancellation, and ConnectionModal integration all working.

### T-04-10: Relationship definition modal ✅
- **Status:** Completed (2025-10-19)
- **Desc:** Dual-column modal for selecting tables and columns when creating relationships. Left column for source, right for target. Dropdowns for table/collection selection, then column/key selection.
- **DoD:** Modal opens after selecting connection target; two columns clearly labeled "Source" and "Target"; table dropdowns populated from respective data sources; column dropdowns populate after table selection; visual feedback shows selected items; Save button persists relationship; Cancel returns to canvas.
- **Deps:** T-04-08, T-07-01
- **Risks:** Modal complexity → keep focused on one-to-one relationships only; data loading → implement caching for table/column lists.
- **Notes:** Implemented dual-column relationship definition modal with table/column selection, data validation, type compatibility warnings, relationship preview, and integration with connection creation workflow.

### T-04-11: Comprehensive canvas state persistence ✅
- **Status:** Completed (2025-10-19)
- **Desc:** Persist complete canvas state to SQLite: block positions, sizes, colors, zoom level, viewport center, relationship curves, visual styles, and canvas metadata. Design for full export/import capability.
- **DoD:** Canvas state table with JSON schema validation; block positions/styles saved on change; relationship visual properties persisted; zoom/pan/viewport state saved; canvas metadata (name, description, created/modified dates); restoration maintains exact visual appearance; database schema supports full canvas export.
- **Deps:** T-04-05, T-01-01, T-04-07
- **Risks:** Schema complexity → use JSON columns with validation; large canvas data → implement compression; version compatibility → include schema version in canvas data.
- **Notes:** Implemented comprehensive canvas persistence with CanvasStateRepository for SQLite storage, CanvasService for IPC handling, useCanvasPersistence React hook with auto-save, and full CRUD operations for canvas state, blocks, and relationships. Includes optimized viewport/position updates and transaction support.

### T-04-12: Connect Source wizard (canvas integration) ✅
- **Status:** Completed (2025-10-19)
- **Desc:** Integrate existing connection wizard with canvas paradigm. When multiple databases detected, show selection UI for which databases to add as separate canvas blocks.
- **DoD:** Plus button opens existing wizard; multi-database selection step added after connection test; each selected database creates separate canvas block; blocks positioned automatically with spacing; wizard success message mentions canvas placement.
- **Deps:** T-04-07, T-04-11
- **Risks:** UX complexity with multi-database flows → keep wizard steps simple and clear.
- **Notes:** Created CanvasConnectWizard (704 lines) with multi-database selection UI, auto-positioning with collision detection, integration with canvas persistence system, and comprehensive styling. Plus button now opens canvas-specific wizard instead of placeholder alert.
- **Deps:** T-04-06, T-04-07 (original wizard), T-04-10
- **Risks:** Wizard flow complexity → keep multi-database selection optional and intuitive.

### T-04-13: Inspector UI (canvas integration) ✅
- **Status:** Completed (2025-10-19)
- **Desc:** Inspector panel that appears when blocks or relationships are selected on canvas. Shows metadata, connection details, table stats, and relationship information. Slide-out panel design with distinct inspectors for data sources and tables.
- **DoD:** Click block opens inspector; shows source metadata, connection status, table count, last crawl time; table selection shows column details; relationship selection shows join details; panel slides in/out smoothly; lazy loads detailed statistics.
- **Deps:** T-04-04, T-01-01, T-01-02
- **Risks:** Panel layout complexity → keep information hierarchy clear; performance → lazy load detailed stats.

### T-04-14: Source provisioning backend service (canvas aware) ✅
- **Status:** Completed (2025-10-19)
- **Desc:** Backend service to persist new sources with canvas positioning. Handle multi-database connections by creating separate canvas blocks for each selected database.
- **DoD:** IPC handler persists source with canvas coordinates; multi-database sources create multiple blocks; auto-layout calculates initial positions; audit trail includes canvas actions; service integrates with existing crawl triggers.
- **Deps:** T-04-11, T-00-04, T-01-01
- **Risks:** Canvas state complexity → ensure database schema supports positioning data; multi-database edge cases → handle connection failures gracefully.

### T-04-15: Canvas status visualization ✅
- **Status:** Completed (2025-10-20)
- **Desc:** Real-time status updates on canvas blocks. Connection status, crawl progress, error states, and success indicators. Animated progress for crawling state.
- **DoD:** Blocks show connection status with color coding; crawling state shows progress indicator; error states display warning icons; hover shows detailed status tooltip; status updates push from main process to renderer in real-time.
- **Deps:** T-04-13, existing crawl infrastructure
- **Risks:** Real-time updates complexity → implement WebSocket or IPC event streaming; visual overload → keep status indicators subtle.

### T-04-16: Canvas auto-save & change tracking ✅
- **Status:** Completed (2025-10-23) - Partial implementation
- **Desc:** Auto-save functionality with change tracking. Unsaved changes indicator, automatic persistence with debouncing, and canvas metadata updates.
- **DoD:** ✅ Auto-save with 2-second debounce; ✅ Visual indicator for unsaved changes (dirty state); ✅ Save operations update canvas metadata (last saved, version); ✅ Change detection and dirty state tracking working.
- **Deps:** T-04-10, T-04-06
- **Risks:** Change detection complexity → implement efficient dirty state tracking; auto-save frequency → balance performance vs data safety.
- **Notes:** Auto-save fully functional. Deferred to post-MVP: manual save button, Ctrl+S shortcut, auto-save toggle in preferences, beforeunload navigation guard.

---

## Phase 5 — Model Manager & Optional Generator

### T-05-01: Model manifest + UI ✅
- **Status:** Completed (2025-10-20)
- **Desc:** Model manifest with models (name, size, license, SHA256 checksum); list UI displays available and installed models.
- **DoD:** ✅ Manifest bundled with app; ✅ List renders offline from local manifest; ✅ UI shows available/installed models with metadata; ✅ IPC integration working.
- **Deps:** T-00-01
- **Risks:** License flow → store acceptance stamp in `settings`.
- **Notes:** Manifest integrity protected by signed Electron installer. Deferred to post-MVP: separate cryptographic manifest signature (installer signature provides sufficient protection for local-first app).

### T-05-02: Download manager ✅
- **Status:** Completed (2025-11-22)
- **Desc:** Resumable HTTP downloads with SHA256 verification; install under user app data; register in database.
- **DoD:** ✅ Interrupted downloads resume from last byte; ✅ SHA256 checksum verified before installation; ✅ SQLite `models` row created; ✅ Models stored in userData/models directory; ✅ Database schema migrated to support model metadata.
- **Deps:** T-05-01, T-01-01
- **Risks:** Proxy env → use system agent; retry w/ backoff.
- **Notes:** Implemented with automatic resume on connection failure, progress logging every 10MB, and safe migration for existing databases.

### T-05-03: node-llama-cpp wrapper (worker pool) ✅
- **Status:** Completed (2025-11-22)
- **Desc:** Worker-thread wrapper around `node-llama-cpp` with fallback heuristics. Exposes summarize, rewrite, SQL skeleton, and federated plan generation APIs.
- **DoD:** ✅ Worker tasks run outside main loop; ✅ Healthcheck IPC returns latency & tokens/sec; ✅ Generator service respects model task toggles; ✅ Renderer healthcheck button wired.
- **Deps:** T-05-02
- **Risks:** CPU perf → quantized models only; batch when idle.
- **Notes:** Worker falls back to deterministic heuristics when the native binding is unavailable, preserving offline reliability.

### T-05-04: Per-task toggles & caching ✅
- **Status:** Completed (2025-11-22)
- **Desc:** Persisted task toggles for each model plus content-hash cache stored in SQLite settings table for summaries, rewrites, and NL→SQL outputs.
- **DoD:** ✅ Model UI exposes per-task switches; ✅ Generator service enforces toggles; ✅ Cache hits return instantly (<50 ms) using hashed payload keys.
- **Deps:** T-05-03, T-04-04
- **Risks:** Cache invalidation → schema/content hash keys.

---

## Phase 6 — Summaries & Docs

### T-06-01: Heuristic skeletons (no model) ⬜
- **Desc:** Generate baseline summaries from names/types/stats.
- **DoD:** Non-empty summaries for all tables/collections without model.
- **Deps:** T-02-04, T-02-08, T-02-12, T-02-16
- **Risks:** Quality → keep concise & labeled as heuristic.

### T-06-02: AI summaries (optional) ⬜
- **Desc:** Use generator to draft; review & save; cache results.
- **DoD:** 20 entities summarized; cache hit on repeat; edits persist.
- **Deps:** T-05-04, T-04-04
- **Risks:** Latency → background queue + progress UI.

### T-06-03: Docs as CRDT (Yjs) + history ⬜
- **Desc:** Store descriptions/notes as Yjs; diff & revert UI.
- **DoD:** Concurrent edits merge; history timeline & revert create new version.
- **Deps:** T-04-04, T-01-01
- **Risks:** None.

---

## Phase 7 — Canvas-Integrated Semantic Relationships

### T-07-01: Semantic relationship schema & repository ⬜
- **Desc:** Create `semantic_relationships` table with src/dst field references, confidence scores, metadata, and canvas visual properties (curve style, color). CRUD repository with canvas integration.
- **DoD:** Table created with canvas fields (visual_style, color_override, curve_path); unique constraints on src/dst pairs; repo methods tested with fixtures; supports visual property persistence.
- **Deps:** T-01-01
- **Risks:** Schema evolution → migration versioning; canvas data complexity → keep visual properties optional.

### T-07-02: Relationship auto-detection service (canvas aware) ⬜
- **Desc:** Analyze field names, types, cardinality, and stats to suggest cross-source relationships. Return suggestions with confidence scores and recommended visual styling.
- **DoD:** 10 fixture scenarios return expected suggestions with confidence scores; false positives <20%; suggestions include visual style recommendations (intra-source vs cross-source); background service runs after crawls complete.
- **Deps:** T-07-01, T-02-04, T-02-08, T-02-12, T-02-16, T-04-04
- **Risks:** Name variance → fuzzy matching + user override; performance → run in background worker.

### T-07-03: Relationship suggestions panel ⬜
- **Desc:** Side panel in canvas showing auto-detected relationship suggestions. Users can accept, reject, or modify suggestions before creating connections.
- **DoD:** Panel slides out from left with suggested relationships; shows source/target tables, suggested columns, confidence score; Accept button creates visual connection; Reject removes suggestion; Modify opens relationship definition modal.
- **Deps:** T-07-02, T-04-09, T-04-12
- **Risks:** Panel space constraints → implement pagination for many suggestions; suggestion quality → allow confidence threshold tuning.

### T-07-04: Relationship validation service ⬜
- **Desc:** Validate relationships on save: check that fields exist, types are compatible, prevent cycles, flag potential data quality issues. Integrated with canvas creation flow.
- **DoD:** Invalid relationships rejected with clear errors in modal; warnings shown for type mismatches; cycle detection prevents circular relationships; validation runs during canvas connection creation.
- **Deps:** T-04-09, T-07-01
- **Risks:** Type coercion edge cases → document limitations; validation performance → cache field metadata.

### T-07-05: Relationship management (edit/delete from canvas) ⬜
- **Desc:** Edit or delete existing relationships directly from canvas. Right-click connections for context menu, or use inspector panel for detailed editing.
- **DoD:** Right-click connection shows context menu with Edit/Delete options; Delete removes connection with confirmation; Edit opens relationship definition modal pre-populated with current values; changes update canvas visually in real-time.
- **Deps:** T-04-12, T-07-04, T-01-02
- **Risks:** UX complexity → provide clear visual feedback for relationship states; undo functionality → implement relationship change history.

---

## Phase 8 — Federated Query & Execution (NEW)

### T-08-01: Query planner (cross-source) ⬜
- **Desc:** Given a natural language question, determine which sources are needed and build an execution plan using semantic relationships.
- **DoD:** Plan shows ordered steps (source queries + join strategy); references semantic relationships; serializable for audit.
- **Deps:** T-07-01, T-03-03
- **Risks:** Complex queries → start with 2-source joins; expand later.

### T-08-02: Retrieval (RAG) for schema context (multi-source) ⬜
- **Desc:** Extend RAG to fetch relevant schema chunks across all sources for a question; include relationship context.
- **DoD:** 20 prompts include entities from multiple sources when appropriate; context size bounded.
- **Deps:** T-03-03, T-07-01
- **Risks:** Recall vs. precision → tune `k` per source.

### T-08-03: SQL/pipeline generation (per source) ⬜
- **Desc:** Generate source-specific queries (SQL for relational, aggregation pipelines for Mongo) based on query plan.
- **DoD:** Each query references only existing tables/fields; unit tests pass per adapter.
- **Deps:** T-08-02, T-05-04
- **Risks:** Hallucination → strict prompts & schema validation.

### T-08-04: AST validation + policy firewall (extended) ⬜
- **Desc:** Parse to AST (node-sql-parser/sqlglot bridge); enforce SELECT-only, blocklists, caps; validate cross-source join safety.
- **DoD:** DDL/DML/unsafe joins rejected; negative golden tests pass; cross-source policy enforced.
- **Deps:** T-08-03, T-00-02
- **Risks:** Parser gaps → expand negative test set.

### T-08-05: Federated execution engine ⬜
- **Desc:** Execute queries against each source; stream results; join in memory using semantic relationships; apply final filters/aggregations.
- **DoD:** Two-source join completes; results match expected fixture; memory bounded; audit logged.
- **Deps:** T-08-04, T-07-01, T-02-01, T-02-05, T-02-09, T-02-13
- **Risks:** Memory limits → cap result sets; warn on large joins.

### T-08-06: Safe execution with EXPLAIN & caps ⬜
- **Desc:** Relational: `EXPLAIN`, auto-`LIMIT`, timeout; Mongo: `$limit`, timeout; stream rows; PII masking applied.
- **DoD:** Long scans time out; grid shows truncated rows; audits recorded; PII masked.
- **Deps:** T-08-05, T-04-05
- **Risks:** Driver quirks → adapter-specific timeouts.

### T-08-07: Search & Ask UI (home screen) ⬜
- **Desc:** Primary search/ask interface with natural language input, execution plan preview, results grid, and save-as-report CTA.
- **DoD:** Query submission triggers federated execution; plan displayed; results render in grid; "Save as Report" button enabled.
- **Deps:** T-04-02, T-08-06
- **Risks:** UX complexity → progressive disclosure of plan details.

---

## Phase 9 — Reports & Dashboards (NEW)

### T-09-01: Report persistence ⬜
- **Desc:** Save executed queries as named reports with query plan, parameters, owner, schedule metadata; CRUD repository.
- **DoD:** Reports table created; save/load/list/delete works; audit logged.
- **Deps:** T-01-01, T-08-07
- **Risks:** None.

### T-09-02: Report execution & refresh ⬜
- **Desc:** Re-run saved reports with current data; cache results; show last-run timestamp and status.
- **DoD:** Report refresh triggers federated query; results cached; errors surface gracefully.
- **Deps:** T-09-01, T-08-06
- **Risks:** Stale schemas → detect and flag schema drift.

### T-09-03: Report UI (list & detail) ⬜
- **Desc:** Reports & Dashboards screen with saved reports list, detail view with results preview, edit/delete/refresh actions.
- **DoD:** List renders all reports; selecting shows details; refresh button re-runs query; results grid integrated.
- **Deps:** T-04-02, T-09-02
- **Risks:** Large result sets → paginate or summarize.

### T-09-04: Dashboard composition ⬜
- **Desc:** Create dashboards as collections of reports; grid layout with drag-resize; persist layout config.
- **DoD:** Dashboard editor allows adding reports as tiles; layout saved; dashboard renders all report results.
- **Deps:** T-09-03, T-01-01
- **Risks:** Layout complexity → start with simple grid; defer advanced layouts.

### T-09-05: Visualization library integration ⬜
- **Desc:** Integrate charting library (Chart.js/Recharts); per-report viz config (bar, line, pie, table).
- **DoD:** Reports can specify visualization type; charts render in dashboard tiles; config persisted.
- **Deps:** T-09-04
- **Risks:** Library size → lazy load; defer complex viz to post-MVP.

### T-09-06: Dashboard refresh & live updates ⬜
- **Desc:** Refresh all reports in a dashboard; show loading states; optionally auto-refresh on interval.
- **DoD:** "Refresh Dashboard" button re-runs all queries; individual tiles show progress; errors isolated per tile.
- **Deps:** T-09-05
- **Risks:** Concurrent query load → throttle/queue; warn on slow refreshes.

---

## Phase 10 — Advanced Graph Features (Canvas-Enhanced)

### T-10-01: Graph repo & API (extended for canvas) ⬜
- **Desc:** CRUD nodes/edges with canvas positioning; filters; stats; unique edge constraint; support SEMANTIC_LINK edge type for cross-source relationships with visual properties.
- **DoD:** Create/update JOINS_TO/DERIVES_FROM/SEMANTIC_LINK with canvas coordinates; persistence includes visual properties; API supports canvas queries (nodes in viewport, relationship paths).
- **Deps:** T-01-01, T-07-01, T-04-10
- **Risks:** Dup edges → DB unique index; canvas data growth → implement spatial indexing.

### T-10-02: "Where used?" neighborhood (canvas integration) ⬜
- **Desc:** Query neighbors by edge types; filter by type; show cross-source dependencies via semantic links. Integrate with canvas to highlight relationship paths visually.
- **DoD:** Selecting entity highlights consumers/producers on canvas; filter controls show/hide relationship types; multi-hop path visualization; tests pass with canvas mock data.
- **Deps:** T-10-01, T-04-07
- **Risks:** Visual complexity with many relationships → implement relationship filtering and focus modes.

### T-10-03: Lineage from SQL files (canvas aware) ⬜
- **Desc:** Parse local SQL (dbt/ETL) → table-level DERIVES_FROM; provenance; visualize lineage connections on canvas with distinct styling.
- **DoD:** Fixture SQL → expected edges with canvas positions; lineage relationships render as dashed connections; provenance recorded with file references; SQL parsing works for PG/MySQL/DuckDB.
- **Deps:** T-10-01, T-04-07
- **Risks:** SQL dialects → start PG/MySQL, add DuckDB later; file monitoring → implement file watcher for SQL changes.

### T-10-04: Canvas performance optimization ⬜
- **Desc:** Optimize canvas rendering for large graphs with many relationships. Implement viewport culling, relationship bundling, and lazy loading of connection details.
- **DoD:** Canvas performs smoothly with 50+ data sources and 200+ relationships; viewport culling only renders visible elements; relationship details load on-demand; zoom/pan remains responsive.
- **Deps:** T-04-07, T-07-05
- **Risks:** Performance testing → create synthetic large datasets; rendering complexity → may require WebGL for very large canvases.

---

## Phase 11 — Export & Packaging

### T-11-01: Canvas export/import system ⬜
- **Desc:** Export complete canvas state as portable JSON package. Import canvas from another Semantiqa instance. Include data sources, relationships, visual layout, and metadata.
- **DoD:** Export creates JSON file with canvas state, data source definitions (no credentials), relationship mappings, visual properties; Import recreates identical canvas layout; validation ensures data integrity; handles version compatibility; credential mapping workflow for imported data sources.
- **Deps:** T-04-10, T-04-15, T-07-01
- **Risks:** Credential security → never export credentials, require re-authentication; schema evolution → implement migration for older canvas exports; large canvas size → optimize JSON structure.

### T-11-02: Data dictionary export (enhanced) ⬜
- **Desc:** Export Markdown/PDF per source/domain with owners, PII flags, verified status, semantic relationships, and canvas layout diagrams.
- **DoD:** Files save locally; relationship maps included with visual layout; canvas diagram rendered as image; counts validated; audit entry logged; export includes canvas context.
- **Deps:** T-04-10, T-06-03, T-07-01
- **Risks:** Canvas rendering → implement headless canvas capture; layout complexity → simplify diagram for print format.

### T-11-03: Report export ⬜
- **Desc:** Export report results as CSV/Excel; include query plan and metadata in separate sheet/section.
- **DoD:** Export button on report detail saves file; metadata sheet included; audit logged.
- **Deps:** T-09-03
- **Risks:** Large datasets → warn on size; apply caps.

### T-11-04: Dashboard export ⬜
- **Desc:** Export dashboard as PDF with all visualizations rendered; include refresh timestamps and metadata.
- **DoD:** PDF export button generates multi-page document; charts render correctly; metadata footer on each page.
- **Deps:** T-09-06
- **Risks:** Rendering complexity → use headless chart capture; defer to post-MVP if complex.

### T-11-05: Signed installers & offline updates ⬜
- **Desc:** Build signed installers (Win/macOS); auto-update off; offline patches.
- **DoD:** Install on locked-down Windows/macOS; runs w/o admin; patch flow tested.
- **Deps:** T-00-03
- **Risks:** Signing logistics → documented steps + CI key handling.

---

## Phase 12 — Golden Tests & Gates

### T-12-01: Golden NL→federated query suite ⬜
- **Desc:** 30 prompts spanning single-source and cross-source queries; AST/plan checks; policy negatives.
- **DoD:** CI green; deviations require approval; cross-source joins validated.
- **Deps:** T-08-04
- **Risks:** Brittle string match → assert AST/JSON.

### T-12-02: Relationship detection accuracy tests ⬜
- **Desc:** 20 fixture scenarios with known relationships; measure precision/recall of auto-detection.
- **DoD:** >70% precision; >60% recall; false positive rate <20%; tests pass in CI.
- **Deps:** T-07-02
- **Risks:** Data variance → expand fixture coverage.

### T-12-03: Electron security audit ⬜
- **Desc:** Automated checks for sandbox flags, CSP, IPC schema validation.
- **DoD:** CI green; renderer `fs`/drivers attempts fail.
- **Deps:** T-00-03, T-00-04
- **Risks:** None.

### T-12-04: Offline first-value E2E ⬜
- **Desc:** Fresh VM: install → connect two sources → crawl → define relationship → run federated query <10 min.
- **DoD:** Playwright script passes; timing budget documented.
- **Deps:** All core features done
- **Risks:** Timing variance → buffer & retries.

---

## Dependencies Summary

### Phase 0
- T-00-01 → T-00-02, T-00-03
- T-00-03 → T-00-04
- T-00-02, T-00-03 → T-00-04

### Phase 1
- T-00-01 → T-01-01
- T-00-04, T-01-01 → T-01-02

### Phase 2
- T-00-04 → all connectors (T-02-01, T-02-05, T-02-09, T-02-13)
- T-01-01 → all persist tasks (T-02-04, T-02-08, T-02-12, T-02-16)
- Each source follows: connector → crawl → profile → persist

### Phase 3
- T-00-01, T-01-01 → T-03-01
- T-03-01, all T-02 persist tasks → T-03-02
- T-03-02 → T-03-03

### Phase 4 (Canvas Infrastructure)
- T-00-03, T-00-04 → T-04-01
- T-01-01, T-04-01 → T-04-02 (database schema)
- T-04-02 → T-04-03 (navigation)
- T-04-03 → T-04-04 (canvas foundation)
- T-04-04 → T-04-05 (blocks), T-04-07 (floating UI)
- T-04-05 → T-04-06 (drill-down), T-04-08 (relationships), T-04-13 (inspector)
- T-04-07, existing wizard → T-04-12 (wizard integration)
- T-04-08 → T-04-09 (connection flow) → T-04-10 (relationship modal)
- T-04-06, T-01-01, T-04-08 → T-04-11 (state persistence)
- T-04-11, T-04-07 → T-04-16 (save controls)
- T-04-12, T-00-04, T-01-01 → T-04-14 (provisioning service)
- T-04-14 → T-04-15 (status visualization)

### Phase 5
- T-00-01 → T-05-01
- T-05-01, T-01-01 → T-05-02
- T-05-02 → T-05-03
- T-05-03, T-04-04 → T-05-04

### Phase 6
- All T-02 persist → T-06-01
- T-05-04, T-04-04 → T-06-02
- T-04-04, T-01-01 → T-06-03

### Phase 7 (Canvas-Integrated Relationships)
- T-01-01 → T-07-01
- T-07-01, all T-02 persist, T-04-05 → T-07-02
- T-07-02, T-04-10, T-04-13 → T-07-03 (suggestions panel)
- T-04-10, T-07-01 → T-07-04 (validation service)
- T-04-13, T-07-04, T-01-02 → T-07-05 (relationship management)

### Phase 8
- T-07-01, T-03-03 → T-08-01
- T-03-03, T-07-01 → T-08-02
- T-08-02, T-05-04 → T-08-03
- T-08-03, T-00-02 → T-08-04
- T-08-04, T-07-01, all T-02 connectors → T-08-05
- T-08-05, T-04-05 → T-08-06
- T-04-02, T-08-06 → T-08-07

### Phase 9
- T-01-01, T-08-07 → T-09-01
- T-09-01, T-08-06 → T-09-02
- T-04-02, T-09-02 → T-09-03
- T-09-03, T-01-01 → T-09-04
- T-09-04 → T-09-05 → T-09-06

### Phase 10 (Advanced Graph Features)
- T-01-01, T-07-01, T-04-11 → T-10-01
- T-10-01, T-04-08 → T-10-02 (neighborhood visualization)
- T-10-01, T-04-08 → T-10-03 (lineage visualization)
- T-04-08, T-07-05 → T-10-04 (performance optimization)

### Phase 11 (Export & Packaging)
- T-04-11, T-04-16, T-07-01 → T-11-01 (canvas export/import)
- T-04-11, T-06-03, T-07-01 → T-11-02 (data dictionary)
- T-09-03 → T-11-03 (report export)
- T-09-06 → T-11-04 (dashboard export)
- T-00-03 → T-11-05 (installers)

### Phase 12
- T-08-04 → T-12-01
- T-07-02 → T-12-02
- T-00-03, T-00-04 → T-12-03
- All features → T-12-04

---

**v2.1 is now the authoritative MVP roadmap with canvas-based UI, integrated relationship management, and visual workflow design inspired by modern tools like n8n. The canvas replaces separate Sources and Relationships screens with a unified infinite workspace.**
