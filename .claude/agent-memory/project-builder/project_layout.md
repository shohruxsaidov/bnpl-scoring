---
name: project-layout
description: pnpm/Turborepo monorepo scaffolded — apps/{api,merchant,portal,admin} + packages/{types,db}
metadata:
  type: project
---

The `scoring` repo is a pnpm + Turborepo monorepo (root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`). As of 2026-05-17 the full skeleton is scaffolded and typechecks clean (`pnpm turbo run typecheck` → 8/8 pass).

**Workspace members:** `apps/api` (Fastify 5 modular monolith), `apps/merchant` / `apps/portal` / `apps/admin` (Vue 3.5 + Vite + PrimeVue Aura + Tailwind v4), `packages/types` (shared domain types), `packages/db` (Drizzle schema). Old standalone `apps/merchant-app` from the prior prototype no longer exists.

**Deviations from the spec/ADRs (intentional, environment-driven):**
- Node is v22.20.0, not 25 → API uses `tsx watch` for dev + `tsc` build instead of `node --experimental-strip-types`. Same ergonomics, actually runnable here.
- `turbo.json` uses the `tasks` key (turbo 2.x), not the deprecated `pipeline` key (turbo 1.x).
- Tailwind v4 import is `@import "tailwindcss";` (not the `/theme` + `/utilities` split, which is not how v4 ships).
- Vue Router / Pinia / TanStack Query pinned to current stable (`vue-router@^4.5`, `pinia@^3`, `@tanstack/vue-query@^5`) — "Router 5 / Pinia 3" in the brief map to these.
- `@vee-validate/zod` peer-warns on zod@4 (declares zod@^3) — expected, works at runtime.

**Build order matters:** `packages/db` excludes `drizzle.config.ts` from its tsconfig (drizzle-kit reads it directly); frontends need `paths: { "@/*": ["src/*"] }` in tsconfig + an `env.d.ts` SFC shim for `vue-tsc`.

**How to apply:** Always read `docs/adr/` (5 files: 0001 backend, 0002 multi-tenancy, 0003 frontend, 0004 auth, 0005 integrations + 0006-0009) for authoritative rationale, not this memory. Frontends proxy `/api` → `localhost:3000`; dev ports merchant 5173 / portal 5174 / admin 5175.
