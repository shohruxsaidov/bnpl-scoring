---
name: client-auth-design
description: Client portal auth — cookie-based JWT access token + opaque DB session, mocked OTP/MyID, registration is a JWT-staged wizard
metadata:
  type: project
---

The client-facing auth for `apps/client-portal` is implemented in `apps/api/src/modules/auth/client/` (routes under prefix `/auth/client`) and consumed by the portal's Pinia `auth` store.

**Auth scheme:** two httpOnly cookies — `access_token` (a `@fastify/jwt` JWT, 15m, payload `{ sub, type:'client' }`, read from the cookie by the jwt plugin) and `session_id` (an opaque random token; only its SHA-256 hash is stored in `client_sessions`). `/refresh` re-issues the access token from a valid session; `/logout` revokes the session row. `app.verifyClientJwt` (in `src/plugins/jwt.ts`) is the route guard for protected endpoints.

**Why opaque session + JWT split:** access tokens stay short-lived and stateless; the session token is the revocable long-lived credential (legal/compliance care about revocability of the persistent credential — see ADR 0004 auth). Never store the raw session token server-side, only its hash.

**Registration is a 4-step wizard gated by a signed `regToken` JWT** (not the access token): phone -> otp -> pinfl -> myid-complete. Each step verifies the prior step's `regToken` and its `step` claim (`phone_verified` then `pinfl_verified`), then issues the next `regToken`. The user row is only created at `/register/complete`.

**Mocked (dev-only simplifications, intentional):** OTP is any code the API generates (4-digit, stored plaintext in `otp_verifications`, echoed as `devOtp` in non-prod responses and logged at info). MyID is fully mocked — `register/pinfl` mints a random `myidSessionId` and `register/complete` just checks it equals the one echoed back. No bcrypt, no real MyID SDK.

**How to apply:** When adding protected client endpoints, guard with `app.verifyClientJwt` and read `request.user.sub`. Before going to production, replace the plaintext-OTP / mock-MyID paths and gate `devOtp` is already removed in prod (`NODE_ENV==='production'`). The portal store exposes `user: AuthUser | null` (not the old `Client` mock); `AuthUser` = `{ id, phone, fullName }`.