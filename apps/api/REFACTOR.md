# API Module Restructuring — CQRS Folder Pattern

## Status: NOT STARTED (planning complete)

## Goal

Refactor all modules under `src/modules/` to match the pattern already implemented in `src/modules/id/users/`.

## Reference Pattern (`src/modules/id/users/` — already done, do not touch)

```
commands/create-user/
  create-user.command.ts   ← primary input interface only
  create-user.handler.ts   ← function body, imports db from '@db'
queries/find-user/
  find-user.query.ts       ← primary query interface only
  find-user.handler.ts     ← function body, imports db from '@db'
index.ts                   ← export * from './commands/create-user/create-user.handler'
```

## Confirmed Decisions

| # | Decision |
|---|----------|
| 1 | Keep existing export/function names — no `Handler` suffix |
| 2 | Multi-function files → **Option A**: one folder per file (folder name = current filename); all functions/helpers stay in the handler file; only the primary input interface splits into `.command.ts` / `.query.ts` |
| 3 | Shared interfaces/types stay co-located in the handler file |
| 4 | All non-injected params (including `minio`) go into the interface object |
| 5 | No `.js` extensions on import paths |
| 6 | Never write migration SQL or edit `_journal.json` |

## Transformation Rules

### A — Flat command file split

`commands/create-foo.ts` → two files:
- `commands/create-foo/create-foo.command.ts` — primary input interface
- `commands/create-foo/create-foo.handler.ts` — function(s), import `db` from `'@db'`, no `db: Db` param

Delete the original flat file.

### B — Flat query file split

Same as A but `.query.ts` suffix.

### C — routes.ts → index.ts

- Rename `routes.ts` to `index.ts` in every module subfolder
- Remove `const db = app.db` if no handler receives db anymore
- Remove `const redis = app.redis` if no handler receives redis anymore
- Update import paths: `'./commands/create-foo'` → `'./commands/create-foo/create-foo.handler'`
- Drop `db` and `redis` arguments from all handler call sites
- Update parent `admin/index.ts` and `merchant/index.ts`: `./xxx/routes` → `./xxx/index`

### D — db/schema.ts → module root

Move `<module>/db/schema.ts` → `<module>/schema.ts`, delete the `db/` subfolder, update all imports within the module.

Affected:
- `admin/organization/db/schema.ts`
- `admin/scoringModel/db/schema.ts`
- `deals/db/schema.ts`
- `integrations/db/schema.ts`
- `notifications/db/schema.ts`
- `push/db/schema.ts`
- `scoring/db/schema.ts`

### E — service.ts splitting

Split each exported function into its own command or query subfolder (write/mutate → `commands/`, read → `queries/`). Delete `service.ts` when all functions are moved.

### F — db/redis injection removal

- `db` parameter removed from all handlers; handlers import `import { db } from '@db'` directly
- `redis` parameter removed; handlers import `import { redis } from '@redis'` directly

---

## Infrastructure to Create First

### 1. `src/redis.ts` (new file)

```ts
import Redis from 'ioredis'
import { env } from './env'

export const redis = new Redis(env.REDIS_URL, {
  family: 4,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
  enableOfflineQueue: false,
})
```

### 2. `tsconfig.json` — add path alias

```json
"@redis": ["src/redis"]
```

---

## Modules to Process

### admin/*

| Subfolder | Commands | Queries | Has service.ts | Has db/schema.ts |
|-----------|----------|---------|----------------|-----------------|
| banks | refresh-banks | list-banks | no | no |
| blacklist | add-to-blacklist, remove-from-blacklist | get-admin, list-blacklist | no | no |
| branches | create-branch, update-branch | get-branch, list-branches | no | no |
| buyouts | mark-buyout-paid | list-buyouts | no | no |
| categories | create-category, disable-merchant-category, enable-merchant-category, update-category | get-category, is-category-enabled, list-categories, list-enabled-categories | no | no |
| clients | — | get-client, list-client-deals, list-client-payments, list-client-scoring, list-clients | no | no |
| collectionBoard | — | get-collection-board | no | no |
| deals | create-deal-comment | get-deal, list-deal-comments, list-deals | no | no |
| employees | change-employee-password, create-employee, update-employee | get-employee, list-employees | no | no |
| integrationLogs | — | get-integration-log, list-integration-logs | no | no |
| merchants | assign-tariff, create-merchant, record-document, remove-tariff, update-merchant | get-merchant, get-merchant-tariffs, list-documents, list-merchants | no | no |
| notifications | — | — | no | no (routes only) |
| organization | upsert-organization | get-organization | no | YES → move to root |
| overview | — | get-dashboard-stats | no | no |
| payments | create-manual-payment | list-manual-payments, list-payments, search-deals | no | no |
| permissions | create-role, delete-role, rename-role, set-role-permissions | get-role, list-roles | no | no |
| products | create-product, update-product | get-product, list-products | no | no |
| scoringHistory | — | get-scoring, list-scorings | no | no |
| scoringModel | create-scoring-model, save-model, set-global-model | get-active-model, get-model-by-id, get-scoring-model, list-models, list-scoring-models | no | YES → move to root |
| scoringSessions | — | get-scoring-session, list-scoring-sessions | no | no |
| scoringTestCases | — | — | no | no (routes only) |
| tariffs | create-tariff, update-tariff | get-tariff, get-tariff-merchants, list-tariffs | no | no |
| users | create-user, set-user-active | get-user, list-users | no | no |

### merchant/*

| Subfolder | Commands | Queries | Has service.ts | Has db/schema.ts |
|-----------|----------|---------|----------------|-----------------|
| branches | create-branch, update-branch | list-branches | no | no |
| cards | — | — | no | no (routes only) |
| catalog | create-category, create-product, update-category, update-product | list-categories, list-products | no | no |
| client | create-client | search-client | no | no |
| deal-sessions | — | — | YES → split | no |
| deals | create-deal | get-contract-pdf-url, get-deal, list-deals | no | no |
| employees | create-employee, update-employee | list-employees | no | no |
| katm | — | — | no | no (routes only) |
| scoringHistory | create-scoring | — | no | no |
| tariffs | — | list-tariffs | no | no |

### auth/*

| Subfolder | Files | Notes |
|-----------|-------|-------|
| admin | service.ts, routes.ts | Split service.ts into commands/queries |
| client | service.ts, myid.ts, pinfl.ts, routes.ts | Split service.ts and myid.ts; pinfl.ts is a utility, keep as-is |
| merchant | service.ts, routes.ts | Split service.ts into commands/queries |

### Other modules

| Module | Notes |
|--------|-------|
| notifications | service.ts → split; db/schema.ts → move to root; routes.ts → index.ts |
| push | service.ts → split; db/schema.ts → move to root; merchant-routes.ts → index.ts or keep name |
| scoring | service.ts → split; engine.ts, resolve-model.ts → leave in place; db/schema.ts → move to root; routes.ts → index.ts |
| mxik | service.ts → split; routes.ts → index.ts |
| regions | routes.ts → index.ts |
| deals (top-level) | db/schema.ts → move to root; installments.ts → leave in place |
| integrations | katm/service.ts → split; katm/flow.ts, katm/poller.ts, katm/mock.ts → leave in place; plumgate/service.ts → split; log.ts → leave in place; db/schema.ts → move to root |
| id/users | ALREADY DONE — do not touch |

---

## Files to Leave In Place (do not restructure)

- `deals/installments.ts`
- `scoring/engine.ts`
- `scoring/resolve-model.ts`
- `merchant/deals/pdf.ts`
- `integrations/log.ts`
- `integrations/katm/flow.ts`
- `integrations/katm/poller.ts`
- `integrations/katm/mock.ts`
- `integrations/plumgate/mock.ts`
- `admin/merchants/types.ts`
- `auth/client/pinfl.ts`

---

## Verification Checklist (run after all changes)

```bash
# No more /routes imports anywhere
grep -r "from.*['\"].*\/routes['\"]" src/modules --include="*.ts"

# No more db injection
grep -r "db: Db\b" src/modules --include="*.ts"

# No .js extensions
grep -r "\.js['\"]" src/modules --include="*.ts"

# No more app.db / app.redis in handler files (only in route index.ts is ok)
grep -r "app\.db\|app\.redis" src/modules --include="*.ts"
```
