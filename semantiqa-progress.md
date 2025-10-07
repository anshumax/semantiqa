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
- [ ] **T-004:** IPC layer (typed, minimal) + audit hook
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 1 — Local Storage & Audit
- [ ] **T-005:** SQLite bootstrap (schema + migrations)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-006:** Audit log (append-only JSONL)
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 2 — Connections & Metadata (All MVP Sources)
### PostgreSQL
- [ ] **T-007-PG:** Postgres connector (read-only)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-008-PG:** Metadata crawl (PG)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-009-PG:** Profiling sampler (PG)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-010-PG:** Persist snapshot (PG)
  - Status: Not Started
  - Last Update: —
  - Notes: —

### MySQL
- [ ] **T-007-MY:** MySQL connector (read-only)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-008-MY:** Metadata crawl (MY)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-009-MY:** Profiling sampler (MY)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-010-MY:** Persist snapshot (MY)
  - Status: Not Started
  - Last Update: —
  - Notes: —

### MongoDB
- [ ] **T-007-MO:** Mongo connector (read-only)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-008-MO:** Metadata crawl (MO)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-009-MO:** Profiling sampler (MO)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-010-MO:** Persist snapshot (MO)
  - Status: Not Started
  - Last Update: —
  - Notes: —

### CSV/Parquet via DuckDB
- [ ] **T-007-DU:** DuckDB local engine
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-008-DU:** Metadata capture (DU)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-009-DU:** Profiling sampler (DU)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-010-DU:** Persist snapshot (DU)
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 3 — Embeddings & Search (Works OOTB)
- [ ] **T-011:** Bundle ONNX embeddings
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-012:** Build vector index (sqlite-vec)
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-013:** Hybrid search service
  - Status: Not Started
  - Last Update: —
  - Notes: —

## Phase 4 — UI Foundations
- [ ] **T-014:** Explorer UI
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-015:** Inspector UI
  - Status: Not Started
  - Last Update: —
  - Notes: —
- [ ] **T-016:** Results grid with masking (framework)
  - Status: Not Started
  - Last Update: —
  - Notes: —

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
