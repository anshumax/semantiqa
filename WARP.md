# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Sematiqa is a **local-first, read-only Electron desktop** application that bridges data across multiple sources with semantic relationships. It maps schemas, explains them in plain English, answers federated natural language questions, and transforms tribal knowledge into a searchable graph—all **offline, CPU-only, and auditable by design**.

### Vision & Value Proposition
**Target Users:** PMs, analysts, BI leads in regulated enterprises (banks, insurers, gov) and data engineers tired of re-explaining joins and business rules.

**Core Pain Points Solved:**
- **Opacity**: Nobody knows where truth lives (which table, which column, which rule)
- **Latency**: Reporting lags because understanding data depends on bottlenecked teams  
- **Fragmentation**: Business logic scattered across code, chats, and tribal knowledge
- **Tool Fatigue**: Existing BI/catalog tools are heavy, cloud-dependent, or slow to show value

**Key Differentiator**: **Cross-source semantic relationships** and **federated querying**—automatically join data from Postgres, MongoDB, CSV files using semantic mappings (e.g., `user_id` ↔ `userId`).

## MVP Scope & Current Status

**Current Progress**: 38/77 tasks completed (49%) - **Phase 4 (UI Foundations)** in progress

### MVP Features (Target)
- **Multi-source connections**: Postgres, MySQL, MongoDB, CSV/Parquet (DuckDB)
- **Semantic search**: Bundled ONNX embeddings work out-of-the-box
- **Cross-source relationships**: Define semantic mappings between disparate sources
- **Federated queries**: Natural language questions across multiple sources
- **Saved reports & dashboards**: Persist and visualize query results
- **Graph visualization**: Cross-source relationships, lineage, dependencies
- **Optional AI enrichment**: Downloadable 7B LLM for summaries and NL→SQL

### Development Phases
- **✅ Phase 0-3**: Foundation (repo, security, adapters, embeddings) - **COMPLETE**
- **🔄 Phase 4**: UI Foundations (sources screen, wizard, status) - **IN PROGRESS**  
- **⬜ Phase 5**: Model Manager (optional LLM download)
- **⬜ Phase 7-8**: Semantic relationships & federated queries (**core differentiator**)
- **⬜ Phase 9**: Reports & dashboards

## Common Development Commands

### Build & Development
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run type checking across all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run tests across all packages
pnpm test

# Start the Electron application in development mode
pnpm app:dev
```

### Package-specific Commands
```bash
# Build specific package
pnpm --filter @semantiqa/core build
pnpm --filter @semantiqa/app-main build
pnpm --filter @semantiqa/app-renderer build

# Run tests for specific package
pnpm --filter @semantiqa/core test

# Start renderer dev server (React/Vite)
pnpm --filter @semantiqa/app-renderer run dev

# Start main process in development
pnpm --filter @semantiqa/app-main run start
```

### Testing
```bash
# Run unit tests (Vitest)
pnpm test

# Run E2E tests (Playwright)
npx playwright test

# Run tests with coverage
pnpm --filter @semantiqa/core test --coverage
```

## Architecture Overview

### High-Level Structure
This is a **monorepo** using **pnpm workspaces** with a classic Electron architecture:

- **`app/main/`** - Electron main process (privileged Node.js)
- **`app/renderer/`** - React frontend (sandboxed)
- **`app/preload/`** - contextBridge for secure IPC
- **`core/`** - Business logic and AI models (ONNX/node-llama-cpp)
- **`packages/`** - Shared libraries and services
- **`contracts/`** - IPC schemas and TypeScript types
- **`adapters/`** - Database connectors (Postgres, MySQL, MongoDB, DuckDB)

### Architecture Invariants (Non-Negotiables)

1. **Local-first, offline-capable**: No cloud required. CPU-only inference.
2. **Read-only to data sources**: Only `SELECT`. SQL firewall, `EXPLAIN`, and auto-`LIMIT` enforced centrally.
3. **Renderer sandboxed**: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`; no remote content.
4. **All privileged ops behind IPC**: Renderer never touches FS, DB drivers, or models directly.
5. **No raw PII persisted**: Mask by default in previews; exports are explicit, logged, and user-initiated.
6. **Audit everything**: Append-only logs for queries, edits, exports, model actions.
7. **Small, typed surface**: Contracts (DTOs + JSON Schemas) are the single source of truth.

### Key Design Principles

**Simple UX Principle**: Home screen offers **three buttons**:  
1) **Connect Source** (read-only)  
2) **Search & Explore** (works immediately; embeddings bundled)  
3) **Enable AI Enrichment** (optional; one-click model download)

Enrichment is purely additive and never blocks core flows.

### Core Services Architecture

The application follows a **Ports & Adapters** pattern:

- **Core Services** (`core/`, `packages/graph-service/`) - Domain logic, transport-agnostic
- **Adapters** (`app/adapters/`) - Database connectors for Postgres, MySQL, MongoDB, DuckDB
- **IPC Layer** (`contracts/`) - Type-safe communication between renderer and main process
- **Storage** - SQLite for local graph storage, OS keychain for credentials

### Database Adapters
Each adapter implements a common interface:
- **Health Check**: Verify connection without credentials exposure
- **Schema Crawler**: Extract tables, columns, relationships, indexes
- **Profiler**: Sample data for statistics (nulls, cardinality, min/max)
- **Query Executor**: Run read-only SELECT queries with policy enforcement

### Graph Storage (SQLite)
The local SQLite database maintains:
- **nodes** - Tables, columns, collections, fields, sources, reports, dashboards
- **edges** - Relationships (CONTAINS, HAS_COLUMN, HAS_FIELD, FK relationships, SEMANTIC_LINK)
- **semantic_relationships** - Cross-source field mappings (e.g., `user_id` ↔ `userId`)
- **docs** - Yjs CRDT documents for collaborative editing
- **embeddings** - Vector embeddings for semantic search
- **changelog** - Audit trail of all operations
- **provenance** - Data lineage and metadata sources
- **reports** - Saved federated queries with metadata
- **dashboards** - Collections of reports with layout config
- **models** - Downloaded LLM model registry

### AI/ML Pipeline
- **Bundled Embeddings**: Small ONNX model ships with the app for immediate semantic search
- **Optional LLM**: 7B quantized models downloaded on-demand via built-in Model Manager
- **Worker Threads**: Heavy computations (embeddings, text generation) run in separate threads
- **Caching**: Content-addressed caching for summaries and generated SQL

## File Structure Guide

### Core Directories
- **`app/main/src/application/`** - Main process services (SourceProvisioning, MetadataCrawl)
- **`app/renderer/src/ui/`** - React components organized by feature
- **`packages/graph-service/`** - Graph database operations and repositories
- **`packages/adapters-runtime/`** - Common adapter interfaces and utilities
- **`contracts/src/`** - Zod schemas for IPC and data validation
- **`fixtures/`** - Test data and sample databases
- **`models/`** - Model manifests and configurations

### Configuration Files
- **`pnpm-workspace.yaml`** - Defines the monorepo structure
- **`tsconfig.base.json`** - Shared TypeScript configuration
- **`vitest.config.ts`** - Unit test configuration
- **`playwright.config.ts`** - E2E test configuration
- **`eslint.config.js`** - Linting rules across packages

### Federated Query Architecture (Planned)
The **core differentiator** enabling cross-source data analysis:

1. **Query Planning**: Determine which sources are needed based on semantic relationships
2. **RAG + Schema Context**: Retrieve relevant schema chunks across all sources
3. **Source-Specific Generation**: Generate SQL/aggregation pipelines per adapter
4. **Federated Execution**: Execute queries, join results in memory using semantic mappings
5. **Safety Enforcement**: AST validation, policy firewall, auto-caps, PII masking

### Reports & Dashboards (Planned)
- **Reports**: Saved federated queries with refresh capability
- **Dashboards**: Collections of reports with grid layout and visualizations
- **Live Updates**: Refresh individual reports or entire dashboards
- **Export**: CSV/Excel/PDF with metadata and visualizations

## Development Workflow

### Adding a New Database Adapter
1. Create new package in `app/adapters/{database}/`
2. Implement the common adapter interfaces:
   - **HealthChecker**: Verify connection without credential exposure
   - **SchemaCrawler**: Extract tables, columns, relationships, indexes
   - **Profiler**: Sample data for statistics (nulls, cardinality, min/max)
   - **QueryExecutor**: Run read-only SELECT queries with policy enforcement
3. Add adapter to `adapters-runtime` factory
4. Update contracts with new source types in `contracts/src/`
5. Add integration tests with fixture databases
6. Update `SnapshotRepository` if schema mapping differs

### Adding New IPC Endpoints
1. Define Zod schemas in `contracts/src/`
2. Update `app/preload/src/preload.ts` with new IPC bridge methods
3. Implement handlers in `app/main/src/main.ts`
4. Add service method to appropriate service class
5. Update renderer components to use new IPC methods

### Working with Cross-Source Semantic Relationships (Planned)
1. **Auto-detection**: Analyze field names, types, cardinality to suggest mappings
2. **Manual mapping**: UI to create/edit/delete semantic relationships
3. **Validation**: Ensure fields exist, types compatible, prevent cycles
4. **Storage**: `semantic_relationships` table with confidence scores
5. **Query integration**: Use mappings in federated query planning

### Working with the Graph Database
- Use `GraphRepository` for querying nodes and edges
- Use `SnapshotRepository` for persisting schema metadata  
- Use semantic relationship repositories for cross-source mappings
- All operations should be transactional and audited
- Follow the existing node/edge type conventions
- New edge type: `SEMANTIC_LINK` for cross-source relationships

## Testing Strategy

### Unit Tests (Vitest)
- **Core logic** in `core/` and `packages/`
- **Adapter interfaces** with mocked databases
- **Repository classes** with in-memory SQLite

### Integration Tests
- **Full adapter flows** with fixture databases
- **IPC contracts** with main/renderer simulation
- **Graph operations** with sample schema data

### E2E Tests (Playwright)
- **Complete user workflows** (connect source → crawl → query)
- **Security validation** (sandbox enforcement, read-only policies)
- **Model Manager** download and inference flows

## Security Requirements

### Renderer Sandbox
- Never use `nodeIntegration: true` or `contextIsolation: false`
- All privileged operations must go through IPC
- No `eval()`, `Function()`, or dynamic code execution
- CSP headers enforced

### Database Security
- All adapters must implement read-only connection validation
- SQL queries parsed to AST and validated before execution
- PII detection and masking in query results
- Connection credentials stored only in OS keychain (keytar)

### Audit Requirements
- All user actions logged to `changelog` table
- Query execution, schema changes, model actions tracked
- No PII in audit logs
- Timestamps and device IDs for all entries

## Performance Considerations

### Large Schema Handling
- Schema crawling uses batched operations and progress tracking
- Query results automatically capped with configurable limits
- Embeddings computed incrementally with content-addressed caching

### Memory Management
- Worker threads for CPU-intensive tasks (embeddings, LLM inference)
- Streaming query results to avoid loading large datasets in memory
- SQLite WAL mode for concurrent reads during long operations

### Model Performance
- ONNX runtime optimized for CPU inference
- Model quantization (Q4/Q5) for reasonable inference speed
- Batch processing for multiple embeddings/summaries

## Current Development Priority

**Next Tasks** (Phase 4 completion):
- **T-04-12**: Crawl execution & status events (metadata crawl orchestration)
- **T-04-13**: Renderer status badges & crawl controls

**Upcoming Major Features**:
- **Phase 7**: Cross-source semantic relationships (**core differentiator**)
- **Phase 8**: Federated query execution across multiple sources
- **Phase 9**: Reports & dashboards with visualizations

## Performance & Reliability Notes

### "Good" looks like:
- **TTFV < 5 min**: connect any source → crawl → search with bundled embeddings
- **Cross-source query in <30 sec**: federated queries joining multiple sources
- **>70%** auto-relationship suggestions are correct
- **0** policy violations in golden tests (no DML/DDL, no unsafe joins)

### Testing Gates
- **Golden NL→SQL**: ~30 prompts → expected ASTs; fail on deviation
- **Policy enforcement**: DML/DDL/blocked joins rejected; PII masks verified
- **Security audit**: renderer sandbox flags enforced; IPC validation required
- **Offline E2E**: Fresh VM install → connect → crawl → federated query <10 min

## Troubleshooting

### Common Issues
- **"Cannot find module"**: Run `pnpm install` from root
- **TypeScript errors**: Run `pnpm typecheck` to see all issues
- **Electron won't start**: Check that both main and renderer built successfully
- **Database connection fails**: Verify read-only credentials and network access
- **Model download stuck**: Check available disk space and resume download
- **Crawl status stuck**: Check `changelog` table for audit trail of crawl operations

### Development Tools
- Use Chrome DevTools for renderer debugging
- Main process logs appear in terminal when running `pnpm app:dev`
- SQLite database can be inspected with any SQLite browser
- Audit logs in `changelog` table for troubleshooting user actions
- Task roadmap in `semantiqa-roadmap.md` shows current phase progress
