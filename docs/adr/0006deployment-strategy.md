# ADR 0006: Zero-Downtime Deployment Strategy

**Status:** Accepted

## Stack

| Concern | Choice |
|---|---|
| Container runtime | Docker + Docker Compose |
| Traffic router | nginx (`active-slot` include) |
| Zero-downtime backend | Blue-green slot swap via `deploy.sh` |
| Zero-downtime frontend | Atomic symlink swap via `deploy-frontend.sh` |
| Migration pattern | Expand / contract |

Observability (Loki, Tempo, Prometheus, Grafana Alloy) is covered in ADR 0007.

## Decisions

**Docker + nginx over Kubernetes.** The modular monolith is a single container; there is no scaling requirement that justifies a cluster. nginx upstream swaps via SIGHUP cover zero-downtime deployments without a control plane. Kubernetes rejected: operational overhead is disproportionate to a single-process deployment.

**Blue-green slots for zero-downtime backend deployments.** Two application slots (`app-blue`, `app-green`) exist in Compose. Only one runs at any time. `deploy.sh`:
1. Writes the new image tag into `.env` for the idle slot.
2. Starts the idle slot and waits for its health check to pass.
3. Rewrites `deploy/nginx/active-slot` to point `scoring_active` upstream at the new slot.
4. Sends SIGHUP to nginx — in-flight requests on the old slot drain naturally, no connection is dropped.
5. Stops the old slot.

Rollback is identical: re-run `deploy.sh` with the previous tag.

```
deploy/nginx/active-slot  ← rewritten by deploy.sh on every deploy
```

**`active-slot` file included by nginx.conf.** The active upstream is declared in a separate file that `deploy.sh` rewrites before each SIGHUP. This keeps `nginx.conf` stable across all deployments and makes the current live slot visible at a glance.

```nginx
# deploy/nginx/active-slot (example — managed by deploy.sh)
upstream scoring_active {
    server app-blue:3000;
    keepalive 32;
}
```

**Atomic symlink swap for the frontend (Vue 3 SPA).** The Vue 3 build output is copied to a versioned directory inside a Docker volume (`app-<tag>/`). `deploy-frontend.sh` calls `ln -sfn` to point the `app` symlink at the new directory — a single rename syscall, atomic at the OS level. nginx serves from `/var/www/app` with `open_file_cache off`, so it follows the updated symlink on the next request with no reload and no dropped connections. The last three versioned builds are kept on disk for instant rollback.

```
/var/www/            ← Docker volume (frontend-assets)
  app                ← symlink, managed by deploy-frontend.sh
  app-abc1234/       ← current build
  app-def5678/       ← previous build (rollback target)
  app-ghi9012/       ← build before that
```

**`/api/` prefix separates backend from frontend in nginx.** All requests to `/api/*` are proxied to `scoring_active`. All other requests are served from the SPA root with `try_files $uri $uri/ /index.html` (Vue Router history mode). Static assets carry `Cache-Control: immutable` for one year — safe because Vite fingerprints asset filenames by content hash.

**Expand/contract migration pattern enforced as policy.** Both blue and green slots share one PostgreSQL database. While a deployment is in flight (both slots briefly exist), only additive (expand) migrations are permitted: new nullable columns, new tables, new indexes. Destructive changes are deferred to the contract phase, which runs only after the old slot has stopped. A rename becomes three deployments: add column → copy data → drop old column. Enforced by convention and pull-request review.

## Deploy lifecycle

**Backend:** `./deploy/deploy.sh <tag>` — starts idle slot, waits for healthy, flips nginx, stops old slot.

**Frontend:** `./deploy/deploy-frontend.sh <tag>` — builds Vue 3, copies to versioned dir, swaps symlink. No nginx reload.

**Rollback (either):** re-run the same script with the previous tag.
