# Semantiqa — Vision (Full v1.2)

**One-line**: A local, read-only data context explorer that maps your schemas, explains them in plain English, **bridges data across sources with semantic relationships**, answers federated questions, and turns tribal knowledge into a searchable graph—no cloud, CPU-only, and auditable by design.

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
1) **Instant map:** Connect any source (Postgres, MySQL, Mongo, CSV) and see tables/columns with human-readable summaries (cached).  
2) **Find anything:** Semantic search across all sources that returns the right entity fast—tables, collections, fields, or metrics.  
3) **Cross-source relationships:** Define and manage semantic mappings between disparate sources (e.g., `user_id` in Postgres ↔ `userId` in MongoDB).  
4) **Federated queries:** Ask questions in natural language and get a unified dataset joining across multiple sources—automatically leveraging semantic relationships.  
5) **Saved reports & dashboards:** Persist query results as reusable reports; compose reports into live dashboards with visualizations.  
6) **Safe execution:** All queries are **SELECT-only**, schema-constrained, AST‑validated, `EXPLAIN`‑checked, and capped—never writes to your systems.  
7) **Shared understanding:** Graph view to visualize cross-source relationships, lineage, and dependencies with version history and audit.  
8) **Portable clarity:** Export data dictionaries, relationship maps, and reports (Markdown/PDF) that stay in sync.

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

## What "good" looks like
- **TTFV < 5 min**: connect any source → crawl → search with bundled embeddings.  
- **Cross-source query in <30 sec**: "Show active users with incomplete transactions" joins Postgres + MongoDB automatically using semantic relationships.  
- **>70%** auto-relationship suggestions are correct based on name/type/stats analysis.  
- **0** policy violations in golden tests (no DML/DDL, no unsafe cross-source joins).  
- A PM answers "Where is `credit_limit` set and used across our stack?" **without pinging tech**.  
- A dashboard with 5 cross-source reports refreshes in <60 seconds.

## MVP scope (build to this)
- **Sources:** Postgres, MySQL, Mongo, CSV/Parquet (DuckDB).  
- **Core features:** 
  - Crawl + profile metadata from all sources
  - Semantic search (bundled embeddings, no setup)
  - Cross-source relationship mapping (manual + auto-suggested)
  - Federated query execution across multiple sources
  - Saved reports and dashboard composition
  - Graph visualization with lineage tracking
- **Optional enrichment (one-click):** 
  - AI summaries via downloadable LLM
  - NL→federated SQL generation
- **Packaging:** Electron desktop (signed, offline installer). No background services.

## Principles
- **Local first, read only, explainable always.**  
- **Small surface area > big platform.** Ship the wedge; defer the rest.  
- **Tests are the contract.** Docs guide; golden tests enforce.  
- **No surprises.** Everything is visible, auditable, and reversible.

## Three Core Pillars (Design Philosophy)

### 1. Source Management & Discovery
Connect any data source (relational, document, file-based) with read-only credentials. Automatic crawling discovers schemas, profiles data, and keeps metadata fresh. Visual status indicators show connection health and crawl status at a glance.

### 2. Semantic Relationship Mapping
The **key differentiator**: manually define or auto-detect semantic relationships between fields across different sources and technologies. `user_id` in a Postgres table can map to `userId` in a MongoDB collection—enabling true cross-source understanding.

### 3. Federated Query & Insights
Ask questions in natural language. The system automatically:
- Determines which sources contain relevant data
- Applies semantic relationships to join across sources
- Executes safe, capped queries (SELECT-only)
- Returns unified datasets ready for analysis or visualization
- Saves successful queries as reusable reports
- Composes reports into live dashboards

---
**Path after MVP (paid, on‑prem):** Team sync with RBAC/SSO, changelog merges (CRDT/LWW), org‑wide search (pgvector), lineage at scale, scheduled report refreshes, alerts on data changes.