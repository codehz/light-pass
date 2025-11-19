# Copilot Instructions for Light Pass

## Architecture Overview
Light Pass is a Telegram bot system for managing group join requests with a Mini App interface.

- **Frontend** (`packages/frontend/`): React-based Telegram Mini App using TanStack Query for data fetching. Entry point: `src/main.tsx`. Builds with custom Bun script (`build.ts`) that processes TailwindCSS and generates HTML.
- **Worker** (`packages/worker/`): Cloudflare Worker handling Telegram webhooks. Uses Durable Objects for per-bot state with Drizzle ORM on SQLite. Key components: `Backend.ts` (Durable Object for data), `Looper.ts` (for notifications), `api.ts` (Telegram API proxy).
- **Communication**: Frontend uses typed RPC (`src/rpc.ts`) to fetch from Worker endpoints. Worker processes join requests, stores configs/questions in DB.
- **Data Flow**: Telegram webhooks → Worker → DB updates → Mini App polls status via RPC.

## Developer Workflows
- **Build & Deploy**: Run `bun run deploy` from root to build frontend and deploy worker.
- **Local Dev**: `cd packages/worker && bun run dev` for worker; frontend served via worker dev proxy.
- **Migrations**: `cd packages/worker && bun run migration:generate` to create DB schema changes.
- **Type Generation**: `cd packages/worker && bun run cf-typegen` for Cloudflare types.

## Project Conventions
- **Type Validation**: Use Arktype schemas (e.g., `ChatConfig` in `db.ts`) for runtime validation of JSON data.
- **DB Schema**: Custom types in Drizzle (e.g., `$ChatConfig` in `db.ts`) with JSON serialization/deserialization.
- **Error Handling**: Telegram API errors wrapped in `BotError` (see `api.ts`).
- **Caching**: `WorkersCacheStorage` for chat info and encryption (1-day TTL).
- **Navigation**: `StackNavigator` component for page routing in Mini App.
- **Styling**: TailwindCSS with `tw` macro from `bun-tailwindcss`.

## Key Files
- `packages/worker/src/db.ts`: DB schema and relations.
- `packages/worker/src/Backend.ts`: Core business logic for join requests.
- `packages/frontend/src/rpc.ts`: RPC type definitions.
- `packages/worker/wrangler.jsonc`: Worker configuration.