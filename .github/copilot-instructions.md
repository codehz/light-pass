# Copilot Instructions for Light Pass

## Architecture Overview
Light Pass is a Telegram bot system for managing group join requests with a Mini App interface.

- **Frontend** (`packages/frontend/`): React-based Telegram Mini App using TanStack Query for data fetching. Entry point: `src/main.tsx`. Builds with custom Bun script (`build.ts`) that processes TailwindCSS and generates HTML.
- **Worker** (`packages/worker/`): Cloudflare Worker handling Telegram webhooks. Uses Durable Objects for per-bot state with Drizzle ORM on SQLite. Key components: `Backend.ts` (Durable Object for data), `Looper.ts` (for notifications), `api.ts` (Telegram API proxy), `VerifyUser.ts` (workflow for join request verification).
- **Communication**: Frontend uses typed RPC (`src/rpc.ts`) to fetch from Worker endpoints. Worker processes join requests, stores configs/questions in DB.
- **Data Flow**: Telegram webhooks → Worker → DB updates → Mini App polls status via RPC. Join requests trigger `VerifyUser` workflows that handle timeouts and admin actions.
- **Modes**: Chats can be in "FORM" (require answers), "PASS" (auto-approve), or "IGNORE" modes.

## Developer Workflows
- **Build & Deploy**: Run `bun run deploy` from root to build frontend and deploy worker.
- **Local Dev**: `cd packages/worker && bun run dev` for worker; frontend served via worker dev proxy.
- **Migrations**: `cd packages/worker && bun run migration:generate` to create DB schema changes.
- **Type Checking**: use #tool:read/problems tooling for TypeScript checks.
- **Debugging**: Use `wrangler tail` to view logs; workflows handle async join request processing.

## Project Conventions
- **Type Validation**: Use Arktype schemas (e.g., `ChatConfig` in `db.ts`) for runtime validation of JSON data.
- **DB Schema**: Custom types in Drizzle (e.g., `$ChatConfig` in `db.ts`) with JSON serialization/deserialization. Relations defined with `relations()`.
- **Error Handling**: Telegram API errors wrapped in `BotError` (see `api.ts`).
- **Caching**: `WorkersCacheStorage` for chat info and encryption (1-day TTL); file paths cached for 1 hour.
- **Navigation**: `StackNavigator` component for page routing in Mini App.
- **Styling**: TailwindCSS with `tw` macro from `bun-tailwindcss`; custom PostCSS with nested and CSO minification.
- **RPC**: Typed RPC via Proxy in `rpc.ts`, authenticated with Telegram init data.
- **Encryption**: File IDs encrypted using custom `Encryptor` for secure serving.
- **Workflows**: Cloudflare Workflows for `VerifyUser` to manage join request lifecycles asynchronously.

## Key Files
- `packages/worker/src/db.ts`: DB schema, custom types, and relations.
- `packages/worker/src/Backend.ts`: Core business logic for join requests and user status.
- `packages/frontend/src/rpc.ts`: RPC type definitions and client proxy.
- `packages/worker/wrangler.jsonc`: Worker configuration with Durable Objects and workflows.
- `packages/worker/src/index.ts`: Webhook handler, RPC dispatcher, and file serving.
- `packages/frontend/build.ts`: Custom build script for TailwindCSS processing and HTML generation.