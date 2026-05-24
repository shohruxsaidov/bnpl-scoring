---
name: project-layout
description: pnpm/Turborepo monorepo — apps/{api,client-portal,merchant-app,platform-admin} + packages/types
metadata:
  type: project
---

The `scoring` repo is a pnpm + Turborepo monorepo (root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`). Use `pnpm --filter @scoring/<name> ...` for per-app commands; npm install fails at the root.

**Workspace members (verified 2026-05-24):** `apps/api` (Fastify 5 + Drizzle + postgres-js, modular monolith), `apps/client-portal` / `apps/merchant-app` / `apps/platform-admin` (Vue 3.5 + Vite + PrimeVue + Tailwind v4 + vue-i18n + Pinia + vue-router), `packages/types` (shared domain types). There is no `packages/db`; the API owns its Drizzle schema under `apps/api/src/modules/<domain>/db/schema.ts`, re-exported via `apps/api/src/db/schema.ts`. **client-portal dev port is 5175** (the API CORS origin allowlist points at it).

**Deviations from the spec/ADRs (intentional, environment-driven):**
- Node is v22.20.0, not 25 → API uses `tsx watch` for dev + `tsc` build instead of `node --experimental-strip-types`. Same ergonomics, actually runnable here.
- `turbo.json` uses the `tasks` key (turbo 2.x), not the deprecated `pipeline` key (turbo 1.x).
- Tailwind v4 import is `@import "tailwindcss";` (not the `/theme` + `/utilities` split, which is not how v4 ships).
- Vue Router / Pinia / TanStack Query pinned to current stable (`vue-router@^4.5`, `pinia@^3`, `@tanstack/vue-query@^5`) — "Router 5 / Pinia 3" in the brief map to these.
- `@vee-validate/zod` peer-warns on zod@4 (declares zod@^3) — expected, works at runtime.

**Build order matters:** `packages/db` excludes `drizzle.config.ts` from its tsconfig (drizzle-kit reads it directly); frontends need `paths: { "@/*": ["src/*"] }` in tsconfig + an `env.d.ts` SFC shim for `vue-tsc`.

**How to apply:** Always read `docs/adr/` for authoritative rationale, not this memory. The API runs on `localhost:3000`. See [[client-auth-design]] for the implemented client auth flow.
