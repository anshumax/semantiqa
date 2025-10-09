# Semantiqa — Progress Tracker (v1.0)

## Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked / Needs attention

---

## Phase 0 — Repo, Contracts, Security Baseline
- [x] **T-001:** Initialize monorepo & tooling
  - Status: Completed
  - Last Update: 2025-10-07
  - Notes: pnpm workspace scaffolded, root tooling configs added (TypeScript, ESLint, Prettier, Vitest, Playwright), development guide created, dependencies installed
- [x] **T-002:** Define contracts (DTOs + JSON Schemas)
  - Status: Completed
  - Last Update: 2025-10-07
  - Notes: Added contracts package with Zod DTOs, schema generation script, and validation tests; regenerated JSON Schemas
- [x] **T-003:** Electron app shell (hardened renderer)
  - Status: Completed
  - Last Update: 2025-10-07
  - Notes: Hardened Electron main + gateway, preload IPC whitelist, renderer Vite shell with status display, combined dev scripts, builds verified
- [x] **T-004:** IPC layer (typed, minimal) + audit hook
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added shared IPC contracts, validated main handlers with audit logging, preload bridge + renderer wiring, and documentation updates

## Phase 1 — Local Storage & Audit
- [x] **T-005:** SQLite bootstrap (schema + migrations)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added storage package with migrations, migration runner, tests, and docs update
- [x] **T-006:** Audit log (append-only JSONL)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Implemented audit logger with rotation, integrated with IPC logging, added tests and docs

## Phase 2 — Connections & Metadata (All MVP Sources)
### PostgreSQL
- [x] **T-007-PG:** Postgres connector (read-only)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added read-only Postgres adapter with validation, health-check, tests, and docs
- [x] **T-008-PG:** Metadata crawl (PG)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Implemented metadata crawler returning SchemaSnapshot with tests
- [x] **T-009-PG:** Profiling sampler (PG)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added pg_stats-based profiling sampler with tests
- [x] **T-010-PG:** Persist snapshot (PG)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Persisted Postgres snapshot into SQLite nodes/edges with tests and docs updates

### MySQL
- [x] **T-007-MY:** MySQL connector (read-only)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added read-only MySQL adapter with validation, read-only enforcement, health check, and unit tests
- [x] **T-008-MY:** Metadata crawl (MY)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Implemented MySQL metadata crawler with Zod validation, system schema filtering, and tests
- [x] **T-009-MY:** Profiling sampler (MY)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added bounded sampling profiler for MySQL columns with configurable sample size and tests
- [x] **T-010-MY:** Persist snapshot (MY)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Persisted MySQL schema snapshot into SQLite nodes/edges with coverage tests alongside Postgres helper

### MongoDB
- [x] **T-007-MO:** Mongo connector (read-only)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added Mongo adapter with connection validation, health check, and capped aggregation helpers
- [x] **T-008-MO:** Metadata crawl (MO)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Implemented sampling-based crawler that flattens nested fields with tests
- [x] **T-009-MO:** Profiling sampler (MO)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added field profiling (null/unique counts) with bounded sampling and unit coverage
- [x] **T-010-MO:** Persist snapshot (MO)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Persisted Mongo collections/fields into SQLite nodes/edges with tests alongside other adapters

### CSV/Parquet via DuckDB
- [x] **T-007-DU:** DuckDB local engine
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added DuckDB adapter with file-based connection validation, health check, and mocked unit tests
- [x] **T-008-DU:** Metadata capture (DU)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Implemented information_schema crawler for DuckDB tables/columns with tests
- [x] **T-009-DU:** Profiling sampler (DU)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added sampling-based column stats (null/distinct/min/max) for DuckDB with coverage
- [x] **T-010-DU:** Persist snapshot (DU)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Persisted DuckDB tables/columns into SQLite nodes/edges with tests

## Phase 3 — Embeddings & Search (Works OOTB)
- [x] **T-011:** Bundle ONNX embeddings
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Added core embedding service with ONNX runtime fallback and tests
- [x] **T-012:** Build vector index (sqlite-vec)
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Implemented in-memory vector index service with cosine similarity search and coverage
- [x] **T-013:** Hybrid search service
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Combined keyword and vector recall into hybrid service with unit tests

## Phase 4 — UI Foundations
- [x] **T-014:** Explorer UI
  - Status: Completed
  - Last Update: 2025-10-08
  - Notes: Implemented renderer explorer shell with tree sidebar, snapshot loader, IPC contract wiring, and loading/error states
- [x] **T-015:** Inspector UI
  - Status: Completed
  - Last Update: 2025-10-09
  - Notes: Added inspector panel with derived metadata, breadcrumbs, and profiling details driven by `useExplorerState` and new `InspectorPanel`
- [x] **T-016:** Results grid with masking (framework)
  - Status: Completed
  - Last Update: 2025-10-09
  - Notes: Established workspace layout with results placeholder, masking controls scaffolding, and future IPC integration points
- [x] **T-016-01:** Connect Source entry point (UI)
  - Status: Completed
  - Last Update: 2025-10-09
  - Notes: Sidebar CTA and empty-state wiring now open the wizard via state machine
- [x] **T-016-02:** Connection wizard scaffolding
  - Status: Completed
  - Last Update: 2025-10-09
  - Notes: Multi-step wizard with validation, step indicator, and IPC submission plumbing
- [x] **T-016-03:** Source provisioning backend service
  - Status: Completed
  - Last Update: 2025-10-09
  - Notes: Provisioning service integrated with messaging, status broadcast, crawl trigger, and added unit coverage
- [x] **T-016-04:** Credential storage & IPC handshake
  - Status: Completed
  - Last Update: 2025-10-09
  - Notes: Preload/main IPC hardened with secure channel usage, keychain storage rollback handled, status events carry error context
- [ ] **T-016-05:** Source status persistence
  - Status: Pending
  - Last Update: —
  - Notes: Needs schema update and repository support for status + connection fields
- [ ] **T-016-06:** Connection test & startup health check
  - Status: Pending
  - Last Update: —
  - Notes: Requires connectivity worker for wizard/startup checks
- [ ] **T-016-07:** Crawl execution & status events
  - Status: Pending
  - Last Update: —
  - Notes: Asynchronous crawl pipeline and IPC push events outstanding
- [ ] **T-016-08:** Renderer status badges & crawl controls
  - Status: Pending
  - Last Update: —
  - Notes: UI badges, per-source retry, and crawl-all CTA not yet implemented

## Phase 5 — Model Manager & Optional Generator
- [ ] **T-017:** Model manifest + UI
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-018:** Download manager
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-019:** node-llama-cpp wrapper (worker pool)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-020:** Per-task toggles & caching
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 6 — Summaries & Docs
- [ ] **T-021:** Heuristic skeletons (no model)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-022:** AI summaries (optional)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-023:** Docs as CRDT (Yjs) + history
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 7 — NL→SQL + Safe Execution (Optional)
- [ ] **T-024:** Retrieval (RAG) for schema context
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-025-SQL:** SQL skeleton generation (PG/MySQL/DuckDB)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-025-MO:** Mongo pipeline templates
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-026:** AST validation + policy firewall
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-027:** Safe execution
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-028:** Save as Metric
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 8 — Graph & Lineage (Table/Collection-level)
- [ ] **T-029:** Graph repo & API
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-030:** Graph UI (Cytoscape)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-031:** "Where used?" neighborhood
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-032:** Lineage from SQL files (relational)
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 9 — Export & Packaging
- [ ] **T-033:** Data dictionary export
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-034:** Signed installers & offline updates
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 10 — Golden Tests & Gates
- [ ] **T-035:** Golden NL→SQL + pipelines suite
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-036:** Electron security audit
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-037:** Offline first-value E2E
  - Status: Not Started
  - Last Update: —
  - Notes: —
