# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

- `artifacts/api-server` — Express 5 + WebSocket (`/api`, `/ws`). Holds in-memory MTG game lobbies.
- `artifacts/mtg-lobby` — React + Vite real-time MTG Commander companion app. Hosts create a lobby with a 4-letter code; players join from any device. Tracks life, commander damage (matrix), turns, eliminations, log, and stats. Uses WebSockets for live sync.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
