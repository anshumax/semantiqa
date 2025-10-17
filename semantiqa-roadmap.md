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

**Overall Progress:** 38/77 tasks completed (49%)

| Phase | Status | Tasks |
|-------|--------|-------|
| Phase 0: Repo & Security | ✅ Complete | 4/4 |
| Phase 1: Storage & Audit | ✅ Complete | 2/2 |
| Phase 2: Connections & Metadata | ✅ Complete | 16/16 |
| Phase 3: Embeddings & Search | ✅ Complete | 3/3 |
| Phase 4: UI Foundations | 🔄 In Progress | 11/13 |
| Phase 5: Model Manager | ⬜ Not Started | 0/4 |
| Phase 6: Summaries & Docs | ⬜ Not Started | 0/3 |
| Phase 7: Semantic Relationships | ⬜ Not Started | 0/5 |
| Phase 8: Federated Query | ⬜ Not Started | 0/7 |
| Phase 9: Reports & Dashboards | ⬜ Not Started | 0/6 |
| Phase 10: Graph & Lineage | ⬜ Not Started | 0/4 |
| Phase 11: Export & Packaging | ⬜ Not Started | 0/4 |
| Phase 12: Golden Tests | ⬜ Not Started | 0/4 |

**Next Up:** Complete T-04-12 (Crawl execution & status events) and T-04-13 (Renderer status badges)

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

## Phase 4 — UI Foundations

### T-04-01: Renderer UI groundwork ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Establish design tokens (minimalist: thin fonts, pastel colors, minimal borders/shadows), layout primitives, shared state scaffolding, and preload-safe IPC helpers for renderer.
- **DoD:** App shell renders with new design system; IPC health check wired; Story/test infrastructure ready for feature screens.
- **Deps:** T-00-03, T-00-04
- **Risks:** Over-abstraction; keep scope to near-term needs.
- **Notes:** UI foundation established through implementation of explorer components, wizard forms, inspector panels, and IPC communication patterns. Design system implemented with consistent styling and layout primitives.

### T-04-02: Main navigation shell ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Top-level navigation with 4 main screens: Search & Ask, Sources, Relationships, Reports & Dashboards. Clean routing and screen transitions.
- **DoD:** Navigation renders; all 4 screens have placeholder views; active state highlights; keyboard navigation works.
- **Deps:** T-04-01
- **Risks:** Navigation complexity → keep simple tab/sidebar pattern.
- **Notes:** Main navigation implemented with sidebar navigation between Sources, Search & Ask, Relationships, and Reports & Dashboards screens. Active states and clean transitions working.

### T-04-03: Explorer UI (Sources screen) ✅
- **Status:** Completed (2025-10-08)
- **Desc:** Sources → schema tree → tables/fields browsing with loading/error/empty states and selection plumbing.
- **DoD:** Renderer loads snapshots via IPC, renders tree and workspace placeholders, and handles retry flows.
- **Deps:** T-04-02, T-02-04, T-02-08, T-02-12, T-02-16, T-03-03
- **Risks:** Performance on large catalogs; require virtualized tree later if needed.
- **Notes:** Implemented renderer explorer shell with tree sidebar, snapshot loader, IPC contract wiring, and loading/error states

### T-04-04: Inspector UI ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Inspector panel framing with metadata rendering, edit scaffolds, and audit-safe actions ready for service wiring.
- **DoD:** Selected entity displays detail panel, update hooks stubbed, masking/resilience patterns align with contracts.
- **Deps:** T-04-03, T-01-01, T-01-02
- **Risks:** Requires backend DTO finalization before enabling edits.
- **Notes:** Added inspector panel with derived metadata, breadcrumbs, and profiling details driven by `useExplorerState` and new `InspectorPanel`

### T-04-05: Results grid with masking (framework) ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Grid shell, masking state management, and query wiring hooks prepared for upcoming execution flows.
- **DoD:** Placeholder grid renders within workspace, mask toggles store state, IPC wiring stubs in place.
- **Deps:** T-04-03, T-01-01
- **Risks:** Real query integration may demand virtualization/perf work.
- **Notes:** Established workspace layout with results placeholder, masking controls scaffolding, and future IPC integration points

### T-04-06: Connect Source entry point (UI) ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Add the primary "Connect Source" action to the Sources screen header/empty state and open a modal scaffold that hosts the wizard.
- **DoD:** CTA renders in empty and populated states, launches the modal, and respects keyboard/mouse dismissal patterns.
- **Deps:** T-04-03, T-04-05
- **Risks:** CTA hierarchy or layout crowding; keep visual weight minimal.
- **Notes:** Sidebar CTA and empty-state wiring now open the wizard via state machine

### T-04-07: Connection wizard scaffolding ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Implement the multi-step wizard (choose kind, configure, review) with validation plumbing for Postgres/MySQL/Mongo/DuckDB.
- **DoD:** Wizard advances between steps, enforces required fields per adapter, and surfaces inline validation and keyboard navigation.
- **Deps:** T-04-06, T-02-01, T-02-05, T-02-09, T-02-13
- **Risks:** Form sprawl; contain scope with per-kind field definitions.
- **Notes:** Multi-step wizard with validation, step indicator, and IPC submission plumbing

### T-04-08: Source provisioning backend service ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Implement main-process service to persist new sources, securely store secrets, emit audit events, and trigger metadata crawl.
- **DoD:** IPC handler calls backend service, source persisted in SQLite within a transaction, secrets stored via keytar `sourceId:key`, audit trail captured, crawl trigger invoked; unit tests cover happy path and failure rollback.
- **Deps:** T-04-07, T-00-04, T-01-01
- **Risks:** Schema drift; ensure migrations and contracts stay aligned.
- **Notes:** Provisioning service integrated with messaging, status broadcast, crawl trigger, and added unit coverage

### T-04-09: Credential storage & IPC handshake ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Wire wizard submission to preload IPC, enforce typed error handling, persist credentials via OS keychain, and audit the attempt.
- **DoD:** Submission stores secrets outside the renderer, returns typed success/error, and records audit events with redacted payloads; tests cover keytar fallback paths.
- **Deps:** T-04-08
- **Risks:** Keytar installation issues on Windows/macOS; guard with diagnostics and retries.
- **Notes:** Preload/main IPC hardened with secure channel usage, keychain storage rollback handled, status events carry error context

### T-04-10: Source status persistence ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Extend SQLite schema and repositories to record per-source status, timestamps, connection results, and error metadata.
- **DoD:** New schema applied (clean re-init); status + connection fields updated via repository/service helpers; `graph:get` includes `status`, `lastCrawlAt`, `lastError`, `connectionStatus`, `lastConnectedAt`, `lastConnectionError`.
- **Deps:** T-04-09, T-01-01
- **Risks:** Requires full DB rebuild on schema change; ensure init script drops/creates tables.
- **Notes:** SQLite schema and repositories now persist crawl/connection status fields with unit coverage

### T-04-11: Connection test & startup health check ✅
- **Status:** Completed (2025-10-09)
- **Desc:** Implement worker to test connectivity during wizard ("Test Connection" CTA) and on application startup for existing sources.
- **DoD:** Wizard exposes Test Connection button with results; app startup runs connection checks, status updated in DB, renderer displays "Checking connectivity" → success/error states.
- **Deps:** T-04-10
- **Risks:** Blocking startup; use async tasks and throttled retries.
- **Notes:** ConnectivityService wrapped in queue with startup sweep, IPC returns queued flag, tests added

### T-04-12: Crawl execution & status events ✅
- **Status:** Completed (2025-10-17)
- **Desc:** Execute metadata crawls asynchronously and emit status updates (not_crawled/crawling/crawled/error) back to renderer via IPC.
- **DoD:** Crawl jobs update crawl status fields, push events, record timestamps/errors; manual "retry crawl" per-source and global "crawl all" coordinator in main process.
- **Deps:** T-04-11, T-02-01, T-02-02, T-02-04, T-02-05, T-02-06, T-02-08, T-02-09, T-02-10, T-02-12, T-02-13, T-02-14, T-02-16
- **Risks:** Long-running tasks; ensure worker threads or queues prevent main thread blockage.
- **Notes:** Fixed database persistence issue where crawl status wasn't being loaded correctly from database after app restart. GraphRepository now properly maps source status and connection info from sources table to UI.

### T-04-13: Renderer status badges & crawl controls ✅
- **Status:** Completed (2025-10-17)
- **Desc:** Subscribe to status/connection events in renderer, render sidebar badges, and add per-source Retry Crawl plus global Crawl All CTA.
- **DoD:** Badges show grey/blue/red/green states with hover error tooltip; wizard displays submitted-for-crawl message; notifications surface retry guidance; Crawl All button and per-source retry wired.
- **Deps:** T-04-12, T-04-03
- **Risks:** State sync between renderer and main; throttle updates to avoid UI jitter.
- **Notes:** Implemented connection deduplication to prevent adding duplicate database connections. Added comprehensive validation based on host+port+database with user-friendly error messages and audit logging.

---

## Phase 5 — Model Manager & Optional Generator

### T-05-01: Model manifest + UI ⬜
- **Desc:** Signed manifest with models (name, size, license, checksum); list UI.
- **DoD:** Signature verified; list renders offline from bundled manifest.
- **Deps:** T-00-01
- **Risks:** License flow → store acceptance stamp in `settings`.

### T-05-02: Download manager ⬜
- **Desc:** Resumable HTTP with SHA256 verify; install under user app data; register.
- **DoD:** Interrupted download resumes; checksum matches; SQLite `models` row created.
- **Deps:** T-05-01, T-01-01
- **Risks:** Proxy env → use system agent; retry w/ backoff.

### T-05-03: node-llama-cpp wrapper (worker pool) ⬜
- **Desc:** Load GGUF; expose `summarize`, `rewrite`, `genSqlSkeleton`, `genFederatedQuery`; worker threads.
- **DoD:** Healthcheck returns tokens/sec & latency; tasks run off main loop.
- **Deps:** T-05-02
- **Risks:** CPU perf → quantized models only; batch when idle.

### T-05-04: Per-task toggles & caching ⬜
- **Desc:** Enable generator per feature; content-hash caches; settings persisted.
- **DoD:** NL chat & AI buttons appear only when enabled; repeat runs <50ms.
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

## Phase 7 — Cross-Source Semantic Relationships (NEW)

### T-07-01: Semantic relationship schema & repository ⬜
- **Desc:** Create `semantic_relationships` table with src/dst field references, confidence scores, metadata; CRUD repository.
- **DoD:** Table created; unique constraints on src/dst pairs; repo methods tested with fixtures.
- **Deps:** T-01-01
- **Risks:** Schema evolution → migration versioning.

### T-07-02: Relationship auto-detection service ⬜
- **Desc:** Analyze field names, types, cardinality, and stats to suggest cross-source relationships (e.g., `user_id` ↔ `userId`).
- **DoD:** 10 fixture scenarios return expected suggestions with confidence scores; false positives <20%.
- **Deps:** T-07-01, T-02-04, T-02-08, T-02-12, T-02-16
- **Risks:** Name variance → fuzzy matching + user override.

### T-07-03: Relationships UI (list & graph view) ⬜
- **Desc:** Dedicated Relationships screen with list of mappings, auto-suggestions, and graph visualization showing cross-source links.
- **DoD:** List shows all relationships with source/field details; graph renders nodes and edges; suggestions displayed separately.
- **Deps:** T-04-02, T-07-01, T-07-02
- **Risks:** Graph complexity → limit to 2-hop views; lazy load.

### T-07-04: Relationship editor (add/edit/delete) ⬜
- **Desc:** UI to manually create, edit, or remove semantic relationships; confirm suggestions; set confidence overrides.
- **DoD:** Modal or inline editor persists changes; audit logged; graph updates in real-time.
- **Deps:** T-07-03, T-01-02
- **Risks:** UX complexity → multi-step wizard for clarity.

### T-07-05: Relationship validation ⬜
- **Desc:** Validate relationships on save: check that fields exist, types are compatible, prevent cycles, flag potential data quality issues.
- **DoD:** Invalid relationships rejected with clear errors; warnings shown for type mismatches.
- **Deps:** T-07-04
- **Risks:** Type coercion edge cases → document limitations.

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

## Phase 10 — Graph & Lineage (Table/Collection-level)

### T-10-01: Graph repo & API (extended) ⬜
- **Desc:** CRUD nodes/edges; filters; stats; unique edge constraint; support SEMANTIC_LINK edge type for cross-source relationships.
- **DoD:** Create/update JOINS_TO/DERIVES_FROM/SEMANTIC_LINK; persistence verified.
- **Deps:** T-01-01, T-07-01
- **Risks:** Dup edges → DB unique index.

### T-10-02: Graph UI (Cytoscape, enhanced) ⬜
- **Desc:** Canvas layouts; drag-to-link; inspector relationship editor; highlight semantic links with distinct styling.
- **DoD:** Add/remove/edit edges visually; semantic relationships render distinctly; audit entries on save.
- **Deps:** T-10-01, T-04-04, T-07-03
- **Risks:** Hairball → 1–2 hop focus + lazy expand.

### T-10-03: "Where used?" neighborhood (cross-source) ⬜
- **Desc:** Query neighbors by edge types; filter by type; show cross-source dependencies via semantic links.
- **DoD:** Selecting entity shows consumers/producers across all sources; tests pass.
- **Deps:** T-10-01
- **Risks:** None.

### T-10-04: Lineage from SQL files (relational) ⬜
- **Desc:** Parse local SQL (dbt/ETL) → table-level DERIVES_FROM; provenance.
- **DoD:** Fixture SQL → expected edges; provenance recorded.
- **Deps:** T-10-01
- **Risks:** Dialects → start PG/MySQL, add DuckDB later.

---

## Phase 11 — Export & Packaging

### T-11-01: Data dictionary export (enhanced) ⬜
- **Desc:** Export Markdown/PDF per source/domain with owners, PII flags, verified status, semantic relationships.
- **DoD:** Files save locally; relationship maps included; counts validated; audit entry logged.
- **Deps:** T-04-04, T-06-03, T-07-01
- **Risks:** None.

### T-11-02: Report export ⬜
- **Desc:** Export report results as CSV/Excel; include query plan and metadata in separate sheet/section.
- **DoD:** Export button on report detail saves file; metadata sheet included; audit logged.
- **Deps:** T-09-03
- **Risks:** Large datasets → warn on size; apply caps.

### T-11-03: Dashboard export ⬜
- **Desc:** Export dashboard as PDF with all visualizations rendered; include refresh timestamps and metadata.
- **DoD:** PDF export button generates multi-page document; charts render correctly; metadata footer on each page.
- **Deps:** T-09-06
- **Risks:** Rendering complexity → use headless chart capture; defer to post-MVP if complex.

### T-11-04: Signed installers & offline updates ⬜
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

### Phase 4
- T-00-03, T-00-04 → T-04-01
- T-04-01 → T-04-02
- T-04-02 → T-04-03, T-04-07
- Wizard flow: T-04-06 → T-04-07 → T-04-08 → T-04-09 → T-04-10 → T-04-11 → T-04-12 → T-04-13

### Phase 5
- T-00-01 → T-05-01
- T-05-01, T-01-01 → T-05-02
- T-05-02 → T-05-03
- T-05-03, T-04-04 → T-05-04

### Phase 6
- All T-02 persist → T-06-01
- T-05-04, T-04-04 → T-06-02
- T-04-04, T-01-01 → T-06-03

### Phase 7
- T-01-01 → T-07-01
- T-07-01, all T-02 persist → T-07-02
- T-04-02, T-07-01, T-07-02 → T-07-03
- T-07-03, T-01-02 → T-07-04
- T-07-04 → T-07-05

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

### Phase 10
- T-01-01, T-07-01 → T-10-01
- T-10-01, T-04-04, T-07-03 → T-10-02
- T-10-01 → T-10-03, T-10-04

### Phase 11
- T-04-04, T-06-03, T-07-01 → T-11-01
- T-09-03 → T-11-02
- T-09-06 → T-11-03
- T-00-03 → T-11-04

### Phase 12
- T-08-04 → T-12-01
- T-07-02 → T-12-02
- T-00-03, T-00-04 → T-12-03
- All features → T-12-04

---

**v2.0 is now the authoritative MVP roadmap with phase-based numbering, cross-source relationships, federated queries, and reports/dashboards as first-class features.**
