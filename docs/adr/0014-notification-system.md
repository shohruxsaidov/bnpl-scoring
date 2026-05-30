# Notification system: single table, fan-out-at-write, SSE delivery

The platform needs in-app notifications across three actor types (Employee, Client, Platform Admin). We use one shared `notifications` table with `actor_type` + `actor_id` columns, create one row per recipient at write time, deliver in real-time via SSE reusing the existing wizard SSE infrastructure, and store only `type` + `params` — never rendered strings.

## Considered options

**Fan-out-at-write vs shared row + join table.** A single notification row shared across multiple recipients (e.g. one `overdue` row for several Merchant Admins) would require a `notification_reads` join table to track per-user read state. We chose fan-out-at-write: `NotificationService.create()` inserts one row per recipient. This keeps `read` as a plain boolean on the row and removes the join table entirely. The trade-off is duplicate rows in the DB for multi-recipient events, which is acceptable at our volume.

**`type`+`params` vs rendered strings.** Storing a rendered `title`/`body` in the DB would require the backend to know the user's language at write time and makes re-rendering impossible. We store only `type` (e.g. `deal_approved`) and structured `params` (e.g. `{ clientName, dealId, score }`). Each frontend maps `type → i18n key` and renders locally. The `client-portal` store previously used plain strings — this is a known divergence that will be migrated.

**SSE vs polling.** SSE reuses the Fastify SSE plugin already established for wizard scoring progress (ADR-0003). Each authenticated session holds one `/sse` connection; `NotificationService.create()` pushes a `notification` event to any open connection for that actor immediately after the DB write.

## Trigger split

Synchronous (inline in service handlers): `deal_approved`, `deal_declined`, `new_deal`, `payment_received`, `deal_issued`, `payout_pending`.  
Scheduled (pg-boss daily jobs): `overdue` (scans overdue installment rows), `payment_due` (N days before due date for Clients).

## Retention

pg-boss daily job deletes rows older than 90 days. Users can also delete their own read notifications early via `DELETE /notifications?read=true` (the "Clear read" button already exists in the merchant-app UI).
