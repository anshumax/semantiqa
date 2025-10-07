# Development Environment Setup

## Prerequisites
- Node.js 18.18+ (LTS recommended)
- pnpm 8.7+
- Git

## Getting Started
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Validate linting and tests:
   ```bash
   pnpm lint
   pnpm test
   ```
3. Explore workspace packages under `core/`, `adapters/`, `app/`, `contracts/`, and `docs/`.

## Workspace Structure
- `core/` — transport-agnostic services and domain logic
- `adapters/` — database connectors, storage, provider integrations
- `app/` — Electron main/renderer/preload packages
- `contracts/` — DTOs, JSON Schemas, IPC contracts
- `docs/` — architecture references, development guides, ADRs

## Tooling
- TypeScript with project references (see `tsconfig.base.json`)
- ESLint + Prettier for linting/formatting
- Vitest for unit tests, Playwright for end-to-end tests
- Electron (main/preload/renderer packages under `app/`)
- Vite + React for renderer development (`app/renderer`)
- Husky/Lint-Staged reserved for future commit hooks

## Scripts
- `pnpm install` — install dependencies across workspaces
- `pnpm lint` — run lint checks across packages (skips missing scripts)
- `pnpm test` — execute unit tests across packages
- `pnpm build` — run build targets across packages
- `pnpm typecheck` — run TypeScript type-checking across packages
- `pnpm --filter @semantiqa/app-renderer run dev` — start renderer dev server (Vite)
- `pnpm --filter @semantiqa/app-main run start` — launch Electron shell (pre-build preload/renderer first)
- `pnpm app:dev` — run renderer + Electron main together (requires separate terminal on Windows)

## Next Steps
- Scaffold individual package `package.json` files as features land
- Integrate CI pipeline (GitHub Actions or equivalent)
- Expand documentation with ADRs and architectural decisions
