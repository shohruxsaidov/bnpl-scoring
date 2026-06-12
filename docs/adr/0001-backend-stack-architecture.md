# ADR 0001: Backend Stack & Architecture

**Status:** Accepted

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 25 (native TypeScript) + TypeScript 6 |
| Framework | Fastify 5 + TypeBox |
| Architecture | Modular monolith |
| ORM | Drizzle ORM + `pg` driver |
| Background jobs | BullMQ (Redis-backed) |
| API style | REST |

## Decisions

**Modular monolith over microservices.** Single Fastify process with strict module boundaries. Modules share a process and database but never import each other's internals — cross-module calls go through injected service interfaces in a shared contracts layer. Microservices rejected: no scaling evidence exists, and distributed transactions across scoring, credits, and payments add significant complexity with no current benefit. The scoring engine is the most likely future extraction candidate; its boundary is kept clean.

**Node.js 25 + Fastify 5.** Node.js 25 executes TypeScript natively — no transpiler in development (`node --watch src/server.ts`); production emits JS via `tsc`. Fastify's TypeBox provider gives end-to-end type safety on all request/response schemas. Express rejected for lack of built-in type inference and slower throughput. Bun + Hono rejected — the Node.js ecosystem (pg, @fastify/jwt) is more battle-tested for financial applications.

**REST over GraphQL.** The three frontends have well-defined, predictable data shapes — GraphQL flexibility adds resolver complexity with no practical benefit. Enforcing per-tenant `tenant_id` isolation is straightforward with REST route guards and significantly harder to audit consistently across GraphQL resolvers.

**Drizzle ORM over raw `pg` and Prisma.** Raw `pg` produces untyped results — easy to miss `tenant_id` filters silently. Prisma hides generated SQL and produces suboptimal queries on complex joins (repayment schedules, scoring aggregations). Drizzle provides TypeScript inference on all query results while staying close to raw SQL; `tenant_id` filter omissions are a compile-time error.

**BullMQ for background jobs** (amended 2026-06-12, with ADR-0025; originally pg-boss, never implemented). Jobs (KATM report polling, overdue installment detection, score cache expiry) run via BullMQ — a Redis-backed job queue with retries/backoff that survives restarts; Redis is already in the stack for sessions and caching. The worker runs in-process inside the API (plugins/queue.ts). In-process cron rejected: jobs die silently on restart. A separate worker process rejected as unnecessary infrastructure overhead. pg-boss rejected on second look: BullMQ's delayed retries with fixed backoff map directly onto the KATM ≥60 s polling contract, and we avoid putting queue churn on the primary database.
