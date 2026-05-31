# ADR-0016 — Client Web Push Notifications

## Status
Accepted

## Context

The Client portal delivers Notifications to Clients via SSE (ADR-0014). SSE works only while the Client has the portal open in a browser tab. Clients need time-sensitive alerts — `payment_due`, `payment_received`, `deal_issued` — even when the app is closed or backgrounded. Platform Admins also need a broadcast channel to push ad-hoc messages (`admin_message`) to all Clients simultaneously.

## Decision

### Web push replaces SSE for Clients

SSE is removed from the client-facing API entirely. Web push (the W3C Push API + VAPID) becomes the sole real-time delivery channel for Clients. SSE is retained in the API only for the merchant wizard scoring progress flow (ADR-0010).

When the Client portal is open, the registered Service Worker receives the push event and relays it to the Vue app via `postMessage`, updating the Pinia store in real time. When the app is closed, the OS-level browser notification fires.

Employees and Platform Admins continue to receive Notifications via SSE — this decision affects Client delivery only.

### Notification types that trigger a push

`deal_issued`, `payment_received`, `payment_due`, `admin_message`. These four cover all Client-facing Notification Types defined in ADR-0014.

### VAPID keys

A single VAPID key pair is generated once and stored as environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) on the API. The public key is served to the client via `GET /client/push/vapid-key`. The private key never touches the frontend or source control.

### Push Subscription storage

A new `push_subscriptions` table stores one row per browser/device per Client:

- `id` uuid PK
- `user_id` → `users.id`
- `endpoint` text (unique — the push service URL)
- `p256dh` text
- `auth` text
- `created_at`

Subscriptions are upserted by `endpoint` on registration. When the push service returns `410 Gone` or `404` for a send attempt, the corresponding row is deleted. No proactive expiry or per-user cap.

### New API module

A dedicated `apps/api/src/modules/push/` module is registered at `/client/push`:

- `GET /client/push/vapid-key` — returns the VAPID public key
- `POST /client/push/subscribe` — upserts a Push Subscription for the authenticated Client
- `DELETE /client/push/subscribe` — removes a Push Subscription by endpoint

Push send logic lives in a `PushService` inside this module. `NotificationService` calls `PushService.send()` after writing the Notification row, the same way it currently calls the SSE emitter.

### admin_message broadcast

When a Platform Admin sends an `admin_message` from admin-portal, `PushService` fans out to all active Push Subscriptions in the table — one push per row. Stale subscriptions discovered during the fan-out are deleted inline.

### Service worker

A manual `apps/client-portal/public/sw.js` (~50 lines) handles two events:

- `push` — parses the payload, shows an OS notification via `self.registration.showNotification()`; if a focused client-portal window is already open it calls `postMessage` instead of showing the OS alert
- `notificationclick` — focuses or opens the client-portal tab

No `vite-plugin-pwa` or Workbox. No asset caching strategy.

### Permission UX

The Client is prompted for notification permission via an explicit opt-in toggle in the "Preferences" section of ProfileView. The browser permission prompt fires only when the Client activates the toggle. No automatic prompt on login.

## Considered options

**Web push vs SSE kept alongside web push.** Keeping SSE as the in-app delivery path and using web push only for background delivery would mean two parallel channels, two connection types, and split send logic. Removing SSE for Clients simplifies the backend to a single channel with the Service Worker handling the in-app vs backgrounded distinction.

**`vite-plugin-pwa` vs manual service worker.** `vite-plugin-pwa` pulls in Workbox and an asset caching model the portal has not been designed for. A hand-written service worker covers the push and `postMessage` use cases in ~50 lines without forcing an offline-first architecture.

**Broadcast vs targeted admin_message.** Targeted sends require a Client search UI in admin-portal. Broadcast covers the primary use case (platform-wide announcements) and is the v1 scope.

## Consequences

- The client-portal SSE connection (`connectSSE` / `disconnectSSE` in the notifications store) is removed.
- The `/notifications/stream` endpoint is removed from the client-facing API routes; it remains for merchant and admin actors.
- A new `push_subscriptions` migration is required.
- The `web-push` npm package is added to `apps/api`.
- Clients who deny the browser notification permission receive no real-time updates while the app is closed; in-app delivery via `postMessage` still works when the tab is open.
- VAPID key rotation invalidates all existing Push Subscriptions — Clients must re-subscribe.
