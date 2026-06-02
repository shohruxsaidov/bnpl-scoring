# ADR 0018: Client Push Notifications via Firebase Cloud Messaging

**Status:** Accepted

## Decision

Firebase Cloud Messaging (FCM) is used for push notifications to Client mobile app users. Web Push (VAPID) is kept for merchant employee browser portals.

## Context

The Client Portal moved from a web SPA to a mobile app (iOS/Android). Web Push API is not available on native mobile apps — it requires a browser service worker. FCM is the standard cross-platform push channel for iOS and Android.

Merchant employees continue to use a browser-based portal, so Web Push (already implemented via `web-push`) remains in place for them.

## Alternatives rejected

**Single FCM for all actors** — Merchant employees are on a web portal; replacing their Web Push implementation with FCM would require embedding FCM SDKs into the Vue app. No benefit for the current merchant portal architecture.

**REST API directly to FCM** — The Firebase Admin SDK (`firebase-admin`) is the recommended server-side approach; it handles auth token refresh, multi-cast batching, and typed payloads. Direct REST adds maintenance overhead with no benefit.

## Trigger events

Only two events fire a client push at this time:
- `deal_approved` — scoring decision is `'approved'` at deal creation
- `deal_declined` — scoring decision is `'declined'` at deal creation

`manual_review` decisions do not fire a push (the deal is still pending; notifying the client prematurely would be misleading).

## Credential delivery

Firebase Admin credentials are provided as three individual env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) rather than a mounted service account JSON file. This is easier to inject in Docker/Kubernetes without managing file mounts, and avoids JSON-escaping issues.

## Stale token cleanup

When FCM returns `registration-token-not-registered` or `invalid-registration-token`, the device's `fcm_token` column is set to `NULL` in-place. The device row is kept (for analytics and so the user can re-register the token on next login).
