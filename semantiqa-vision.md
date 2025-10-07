# Semantiqa — Vision (Full v1.1)

**One-line**: A local, read-only data context explorer that maps your schemas, explains them in plain English, answers safe questions, and turns tribal knowledge into a searchable graph—no cloud, CPU-only, and auditable by design.

## Who it’s for
- **Primary:** PMs, analysts, BI leads in regulated enterprises (banks, insurers, gov).  
- **Secondary:** Data engineers/tech leads tired of re-explaining joins and rules.

## The pain (blunt)
- **Opacity:** Nobody knows where the truth lives (which table, which column, which rule).  
- **Latency:** Reporting lags because understanding data depends on bottlenecked teams.  
- **Fragmentation:** Business logic lives in code, chats, and heads—not in one trusted place.  
- **Tool fatigue:** BI/catalog tools exist, but they’re heavy, cloudy, or slow to show value.

## Our bet
If a tool **instantly** shows *what data exists, what it means, and how to query it safely*—**offline**, **read-only**, and **auditable**—people will use it daily. Sharing follows once value is local.

## Outcomes we promise (MVP)
1) **Instant map:** Connect a source and see tables/columns with human-readable summaries (cached).  
2) **Find anything:** Semantic search across schema and notes that returns the right entity fast.  
3) **Safe answers:** NL→SQL that is **SELECT-only**, schema-constrained, AST‑validated, `EXPLAIN`‑checked, and capped.  
4) **Shared understanding:** A graph view to edit joins, owners, and definitions with version history and audit.  
5) **Portable clarity:** Export a data dictionary (Markdown/PDF) that stays in sync.

## Model & UX stance (simple by default)
- **No setup for search:** We **bundle a small CPU embedding model** (ONNX) so search works out-of-the-box—no downloads, no internet.  
- **Optional enrichment:** A **built-in Model Manager** lets users **download a 7B quantized model** (GGUF) inside the app and run it with **node-llama-cpp** for summaries and NL→SQL. One click, resumable, hash‑verified, and fully offline after install.  
- **UI stays clean:** First run shows **three buttons**—*Connect Source*, *Search & Explore*, *(Optional) Enable AI Enrichment*. If enrichment is off, NL chat and AI buttons remain hidden. Core value is never blocked by models.

## Non-goals (v1)
- No DML/DDL. **Never** write to customer systems.  
- No cloud requirement or background network calls.  
- No Oracle/SQL Server on day one (add post-MVP).  
- No Slack/Teams mining in MVP (code/migrations provenance only).  
- Not a BI tool. We **feed** BI; we don’t replace it.

## Invariants (cannot be broken)
- **SELECT-only** policy with blocklists, PII masking, row/time caps, and `EXPLAIN`.  
- **Renderer sandboxed**; all privileged work behind a **tiny, typed IPC** boundary.  
- **Local store = SQLite** (graph: nodes/edges/docs/embeddings/changelog).  
- **CPU-only by default**; enrichment is optional and cached.  
- **Everything audited**—queries, edits, exports, and model actions.

## What “good” looks like
- **TTFV < 5 min**: connect Postgres → crawl → search with bundled embeddings.  
- **>70%** auto-descriptions pass a human sniff test on a real schema.  
- **0** policy violations in golden tests (no DML/DDL, no blocked joins).  
- A PM answers “Where is `credit_limit` set and used?” **without pinging tech**.

## MVP scope (build to this)
- Sources: Postgres, MySQL, Mongo, CSV/Parquet (DuckDB).  
- Features: crawl + profile, summaries (optional model), embeddings search, safe NL→SQL (optional model), graph (tables) + join editor, dictionary export, audit.  
- Packaging: Electron desktop (signed, offline installer). No background services.

## Principles
- **Local first, read only, explainable always.**  
- **Small surface area > big platform.** Ship the wedge; defer the rest.  
- **Tests are the contract.** Docs guide; golden tests enforce.  
- **No surprises.** Everything is visible, auditable, and reversible.

---
**Path after MVP (paid, on‑prem):** Team sync with RBAC/SSO, changelog merges (CRDT/LWW), org‑wide search (pgvector), lineage at scale.