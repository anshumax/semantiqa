# Semantiqa — Sequenced Task Roadmap (Full v1.4, MVP-correct)

**Purpose:** Atomic, step-by-step tasks for a coding AI. **Every task includes**: **Desc**, **DoD (Definition of Done)**, **Deps**, and **Risks**.  
**MVP sources:** **Postgres, MySQL, Mongo, CSV/Parquet (DuckDB)**. Renderer never touches FS/DB/network directly—use IPC. All payloads are typed and schema-validated.

> Conventions: IDs are stable (e.g., T-001). “Must pass” = tests included and green.

---

## Phase 0 — Repo, Contracts, Security Baseline

### T-001: Initialize monorepo & tooling
- **Desc:** Create repo structure (`/core`, `/adapters`, `/app`, `/contracts`, `/docs`), set up TS, ESLint, Prettier, Vitest/Jest, Playwright, CI.
- **DoD:** `pnpm i && pnpm build` succeeds; CI runs unit + e2e on PR; README lists dev commands.
- **Deps:** —
- **Risks:** Tooling churn → lock versions in `pnpm-lock.yaml`.

### T-002: Define contracts (DTOs + JSON Schemas)
- **Desc:** Versioned DTOs (Sources, SchemaSnapshot, QueryInput/Result, Node/Edge, Doc/Yjs, Search, Models) + zod schemas; emit JSON Schemas.
- **DoD:** Schemas generated; round-trip validation tests pass; `/contracts` export usable by IPC.
- **Deps:** T-001
- **Risks:** Spec drift → CI blocks merges if `/contracts` changes without tests.

### T-003: Electron app shell (hardened renderer)
- **Desc:** Scaffold main/preload/renderer with `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, strict CSP; code-sign placeholders.
- **DoD:** Electron security audit passes; negative tests show renderer cannot `require('fs')`/drivers.
- **Deps:** T-001
- **Risks:** Misconfig → add automated audit in CI.

### T-004: IPC layer (typed, minimal) + audit hook
- **Desc:** Preload exposes typed APIs; main registers handlers; zod validation; central audit wrapper.
- **DoD:** Valid & invalid sample calls behave; errors typed; audit entries written.
- **Deps:** T-002, T-003
- **Risks:** Surface creep → review/approve new IPC routes.

---

## Phase 1 — Local Storage & Audit

### T-005: SQLite bootstrap (schema + migrations)
- **Desc:** Create tables: `nodes`, `edges`, `docs`, `embeddings`, `provenance`, `changelog`, `models`, `settings` + indexes + migrations.
- **DoD:** Fresh start migrates; integrity test confirms schema; migration version recorded.
- **Deps:** T-001
- **Risks:** Migration drift → add checksum + migration tests.

### T-006: Audit log (append-only JSONL)
- **Desc:** Centralized writer; rotation by size/date; redaction for sensitive fields.
- **DoD:** Every IPC call logs actor, action, input hash, outcome; rotation proven in test.
- **Deps:** T-004, T-005
- **Risks:** Disk growth → rotation + max retention config.

---

## Phase 2 — Connections & Metadata (All MVP Sources)

#### PostgreSQL

### T-007-PG: Postgres connector (read-only)
- **Desc:** Implement `pg` adapter with read-only role validation; health check.
- **DoD:** Connect/disconnect works; DDL/DML attempts are denied in unit tests; doc shows required grants.
- **Deps:** T-004
- **Risks:** Privilege misconfig → provide SQL snippets for creating RO user.

### T-008-PG: Metadata crawl (PG)
- **Desc:** Introspect tables/columns/PK/FK/indexes; produce `SchemaSnapshot`.
- **DoD:** Snapshot matches fixture; time within cap on sample DB.
- **Deps:** T-007-PG, T-005
- **Risks:** Large catalogs → paginate; configurable schema allowlist.

### T-009-PG: Profiling sampler (PG)
- **Desc:** Sample N rows with caps; compute null%, distinct%, min/max.
- **DoD:** Stats persisted; caps enforceable; timeouts handled.
- **Deps:** T-008-PG
- **Risks:** Long scans → `LIMIT`, `TABLESAMPLE`, timeouts.

### T-010-PG: Persist snapshot (PG)
- **Desc:** Map `SchemaSnapshot`+stats into SQLite nodes/edges; provenance entries.
- **DoD:** Explorer can render PG schema from local store; restart-safe.
- **Deps:** T-008-PG, T-005
- **Risks:** Mapping bugs → unit tests with fixtures.

#### MySQL

### T-007-MY: MySQL connector (read-only)
- **Desc:** `mysql2` adapter; read-only grants validation.
- **DoD:** Connect/disconnect; DDL/DML denied; grants doc.
- **Deps:** T-004
- **Risks:** Varied auth modes → test against 5.7/8+.

### T-008-MY: Metadata crawl (MY)
- **Desc:** Introspect tables/columns/PK/FK/indexes; `SchemaSnapshot`.
- **DoD:** Snapshot equals fixture; perf within cap.
- **Deps:** T-007-MY, T-005
- **Risks:** FK discovery inconsistencies → fall back to inferred joins.

### T-009-MY: Profiling sampler (MY)
- **Desc:** Same stats as PG with caps/timeouts.
- **DoD:** Stats persisted; caps enforced.
- **Deps:** T-008-MY
- **Risks:** Large TEXT/BLOB → skip/minimize.

### T-010-MY: Persist snapshot (MY)
- **Desc:** Store snapshot+stats to SQLite; provenance.
- **DoD:** Explorer renders MySQL schema; restart-safe.
- **Deps:** T-008-MY, T-005
- **Risks:** Mapping parity with PG → tests.

#### MongoDB

### T-007-MO: Mongo connector (read-only)
- **Desc:** `mongodb` adapter; list DBs/collections; read caps.
- **DoD:** Connect; list metadata; enforce max docs per sample.
- **Deps:** T-004
- **Risks:** Permissions variance → doc minimum roles.

### T-008-MO: Metadata crawl (MO)
- **Desc:** Infer fields/types from capped samples; nested paths as dotted fields.
- **DoD:** Fields/types snapshot equals fixture; perf within cap.
- **Deps:** T-007-MO, T-005
- **Risks:** Schema drift → store sample hash + refresh flag.

### T-009-MO: Profiling sampler (MO)
- **Desc:** Field null%/distinct counts from sample; cap time/rows.
- **DoD:** Stats persisted; timeouts handled.
- **Deps:** T-008-MO
- **Risks:** Unbounded docs → `$limit` & `$sample` guarded.

### T-010-MO: Persist snapshot (MO)
- **Desc:** Store collections/fields into SQLite; provenance.
- **DoD:** Explorer renders Mongo collections/fields; restart-safe.
- **Deps:** T-008-MO, T-005
- **Risks:** Dotted path handling → consistent node IDs.

#### CSV/Parquet via DuckDB

### T-007-DU: DuckDB local engine
- **Desc:** Embed DuckDB; open local CSV/Parquet; read-only.
- **DoD:** Engine loads; can query file; no external network.
- **Deps:** T-004
- **Risks:** Binary size → optional component gating.

### T-008-DU: Metadata capture (DU)
- **Desc:** Infer columns/types/row count; record file path & checksum.
- **DoD:** Snapshot equals fixture; checksum saved.
- **Deps:** T-007-DU, T-005
- **Risks:** Large files → sample first N rows.

### T-009-DU: Profiling sampler (DU)
- **Desc:** Stats with caps; skip huge strings.
- **DoD:** Stats persisted; timeouts handled.
- **Deps:** T-008-DU
- **Risks:** File variance → robust CSV dialect handling.

### T-010-DU: Persist snapshot (DU)
- **Desc:** Store dataset as a “source” in SQLite; provenance points to file URI.
- **DoD:** Explorer renders dataset; restart-safe.
- **Deps:** T-008-DU, T-005
- **Risks:** File moved → flag stale via checksum mismatch.

---

## Phase 3 — Embeddings & Search (Works OOTB)

### T-011: Bundle ONNX embeddings
- **Desc:** Package small ONNX embedding model; init on start; licensing.
- **DoD:** Loads offline on clean VM; NOTICE updated; version recorded.
- **Deps:** T-001, T-005
- **Risks:** Size budget → keep <100MB.

### T-012: Build vector index (sqlite-vec)
- **Desc:** Create embeddings for names/descriptions; store vectors; incremental updates.
- **DoD:** Top-k neighbors correct on fixtures; update on doc change.
- **Deps:** T-011, T-010-PG/T-010-MY/T-010-MO/T-010-DU
- **Risks:** Recompute cost → batch & debounce.

### T-013: Hybrid search service
- **Desc:** Merge keyword (FTS) + vector recall; rank and return entities.
- **DoD:** 10 seeded queries return expected entities <200ms.
- **Deps:** T-012
- **Risks:** Ranking tuning → adjustable weights.

---

## Phase 4 — UI Foundations

### T-014a: Renderer UI groundwork
- **Desc:** Establish design tokens, layout primitives, shared state scaffolding, and preload-safe IPC helpers for renderer.
- **DoD:** App shell renders with new design system; IPC health check wired; Story/test infrastructure ready for feature screens.
- **Deps:** T-003, T-004
- **Risks:** Over-abstraction; keep scope to near-term needs.

### T-014b: Explorer UI
- **Desc:** Sources → schema tree → tables/fields browsing with loading/error/empty states and selection plumbing.
- **DoD:** Renderer loads snapshots via IPC, renders tree and workspace placeholders, and handles retry flows.
- **Deps:** T-014a, T-010-*, T-013
- **Risks:** Performance on large catalogs; require virtualized tree later if needed.

### T-015: Inspector UI
- **Desc:** Inspector panel framing with metadata rendering, edit scaffolds, and audit-safe actions ready for service wiring.
- **DoD:** Selected entity displays detail panel, update hooks stubbed, masking/resilience patterns align with contracts.
- **Deps:** T-014b, T-005, T-006
- **Risks:** Requires backend DTO finalization before enabling edits.

### T-016: Results grid with masking (framework)
- **Desc:** Grid shell, masking state management, and query wiring hooks prepared for upcoming execution flows.
- **DoD:** Placeholder grid renders within workspace, mask toggles store state, IPC wiring stubs in place.
- **Deps:** T-014b, T-005
- **Risks:** Real query integration may demand virtualization/perf work.

---

## Phase 5 — Model Manager & Optional Generator

### T-017: Model manifest + UI
- **Desc:** Signed manifest with models (name, size, license, checksum); list UI.
- **DoD:** Signature verified; list renders offline from bundled manifest.
- **Deps:** T-001
- **Risks:** License flow → store acceptance stamp in `settings`.

### T-018: Download manager
- **Desc:** Resumable HTTP with SHA256 verify; install under user app data; register.
- **DoD:** Interrupted download resumes; checksum matches; SQLite `models` row created.
- **Deps:** T-017, T-005
- **Risks:** Proxy env → use system agent; retry w/ backoff.

### T-019: node-llama-cpp wrapper (worker pool)
- **Desc:** Load GGUF; expose `summarize`, `rewrite`, `genSqlSkeleton`; worker threads.
- **DoD:** Healthcheck returns tokens/sec & latency; tasks run off main loop.
- **Deps:** T-018
- **Risks:** CPU perf → quantized models only; batch when idle.

### T-020: Per-task toggles & caching
- **Desc:** Enable generator per feature; content-hash caches; settings persisted.
- **DoD:** NL chat & AI buttons appear only when enabled; repeat runs <50ms.
- **Deps:** T-019, T-015
- **Risks:** Cache invalidation → schema/content hash keys.

---

## Phase 6 — Summaries & Docs

### T-021: Heuristic skeletons (no model)
- **Desc:** Generate baseline summaries from names/types/stats.
- **DoD:** Non-empty summaries for all tables/collections without model.
- **Deps:** T-010-*
- **Risks:** Quality → keep concise & labeled as heuristic.

### T-022: AI summaries (optional)
- **Desc:** Use generator to draft; review & save; cache results.
- **DoD:** 20 entities summarized; cache hit on repeat; edits persist.
- **Deps:** T-020, T-015
- **Risks:** Latency → background queue + progress UI.

### T-023: Docs as CRDT (Yjs) + history
- **Desc:** Store descriptions/notes as Yjs; diff & revert UI.
- **DoD:** Concurrent edits merge; history timeline & revert create new version.
- **Deps:** T-015, T-005
- **Risks:** None.

---

## Phase 7 — NL→SQL + Safe Execution (Optional)

### T-024: Retrieval (RAG) for schema context
- **Desc:** Fetch relevant schema chunks for a question (per source).
- **DoD:** 20 prompts include only allowed entities; context size bounded.
- **Deps:** T-013
- **Risks:** Recall vs. precision → tune `k` per source.

### T-025-SQL: SQL skeleton generation (PG/MySQL/DuckDB)
- **Desc:** Use generator to propose SELECT skeletons anchored to schema.
- **DoD:** References only existing tables/columns; unit tests pass.
- **Deps:** T-024, T-020
- **Risks:** Hallucination → strict prompt & schema JSON.

### T-025-MO: Mongo pipeline templates
- **Desc:** Produce `$match/$project/$group` pipelines from templates; anchor to fields.
- **DoD:** Pipelines validate; unit tests with fixtures pass.
- **Deps:** T-024
- **Risks:** Variation in schemas → fallback to guided form.

### T-026: AST validation + policy firewall
- **Desc:** Parse to AST (node-sql-parser/sqlglot bridge); enforce SELECT-only, blocklists, caps.
- **DoD:** DDL/DML/blocked joins rejected; negative golden tests pass.
- **Deps:** T-025-SQL, T-002
- **Risks:** Parser gaps → expand negative test set.

### T-027: Safe execution
- **Desc:** Relational: `EXPLAIN`, auto-`LIMIT`, timeout; Mongo: `$limit`, timeout; stream rows.
- **DoD:** Long scans time out; grid shows truncated rows; audits recorded.
- **Deps:** T-026, T-016, (T-007-PG|T-007-MY|T-007-DU|T-007-MO)
- **Risks:** Driver quirks → adapter-specific timeouts.

### T-028: Save as Metric
- **Desc:** Persist approved SQL/pipeline + definition + owner; show “where used.”
- **DoD:** Metric runs without LLM; appears in graph; editable.
- **Deps:** T-027, T-015
- **Risks:** None.

---

## Phase 8 — Graph & Lineage (Table/Collection-level)

### T-029: Graph repo & API
- **Desc:** CRUD nodes/edges; filters; stats; unique edge constraint.
- **DoD:** Create/update JOINS_TO/DERIVES_FROM; persistence verified.
- **Deps:** T-005
- **Risks:** Dup edges → DB unique index.

### T-030: Graph UI (Cytoscape)
- **Desc:** Canvas layouts; drag-to-link; inspector relationship editor.
- **DoD:** Add/remove/edit edges visually; audit entries on save.
- **Deps:** T-029, T-015
- **Risks:** Hairball → 1–2 hop focus + lazy expand.

### T-031: “Where used?” neighborhood
- **Desc:** Query neighbors by edge types; filter by type.
- **DoD:** Selecting entity shows consumers/producers; tests pass.
- **Deps:** T-029
- **Risks:** None.

### T-032: Lineage from SQL files (relational)
- **Desc:** Parse local SQL (dbt/ETL) → table-level DERIVES_FROM; provenance.
- **DoD:** Fixture SQL → expected edges; provenance recorded.
- **Deps:** T-029
- **Risks:** Dialects → start PG/MySQL, add DuckDB later.

---

## Phase 9 — Export & Packaging

### T-033: Data dictionary export
- **Desc:** Export Markdown/PDF per source/domain with owners, PII flags, verified status.
- **DoD:** Files save locally; counts validated; audit entry logged.
- **Deps:** T-015, T-023
- **Risks:** None.

### T-034: Signed installers & offline updates
- **Desc:** Build signed installers (Win/macOS); auto-update off; offline patches.
- **DoD:** Install on locked-down Windows/macOS; runs w/o admin; patch flow tested.
- **Deps:** T-003
- **Risks:** Signing logistics → documented steps + CI key handling.

---

## Phase 10 — Golden Tests & Gates

### T-035: Golden NL→SQL + pipelines suite
- **Desc:** 30 prompts/pipelines; AST/template checks; policy negatives.
- **DoD:** CI green; deviations require approval.
- **Deps:** T-026
- **Risks:** Brittle string match → assert AST/JSON.

### T-036: Electron security audit
- **Desc:** Automated checks for sandbox flags, CSP, IPC schema validation.
- **DoD:** CI green; renderer `fs`/drivers attempts fail.
- **Deps:** T-003, T-004
- **Risks:** None.

### T-037: Offline first-value E2E
- **Desc:** Fresh VM: install → connect any source → crawl → search <5 min.
- **DoD:** Playwright script passes; timing budget documented.
- **Deps:** Core features done
- **Risks:** Timing variance → buffer & retries.

---

## Dependencies (summary)
- T-001 → T-002, T-003
- T-003 → T-004
- T-005 → T-006, T-010-*, T-012, T-015, T-018, T-023
- T-004 → T-007-* (all connectors)
- T-011 → T-012 → T-013
- T-013 → T-014
- T-017 → T-018 → T-019 → T-020
- T-024 → T-025-* → T-026 → T-027 → T-028
- T-029 → T-030, T-031, T-032
- T-033 depends on T-015 & T-023
- T-034 depends on T-003

---

**v1.4 is now the authoritative MVP roadmap with complete Desc/DoD/Deps/Risks on every task.**