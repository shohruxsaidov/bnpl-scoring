# ADR 0005: Integrations Infrastructure

**Status:** Accepted

## HTTP client

All outbound HTTP calls to external services use **ky** (v2). A shared factory `createIntegrationClient(baseUrl, integration)` in `src/lib/integrations.ts` creates a per-integration ky instance with:
- 15 s timeout
- No automatic retries (retry logic is caller-controlled)
- `beforeError` hook that prefixes the integration name on every error message

`HTTPError` from ky is unwrapped into a typed `IntegrationError` (carries `integration`, `statusCode`, `body`) via `handleHttpError`.

## Integration log

Every outbound call to an external service is recorded in the `integration_logs` table.

**Columns:** `integration`, `method_name`, `method_type` (HTTP verb), `request` (jsonb), `response` (jsonb), `status` (HTTP status code), `error_message`, `created_at`.

**Key decisions:**

- **Fire-and-forget** — a DB write failure must never surface to the caller. `logIntegration` in `src/modules/integrations/log.ts` swallows insert errors silently.
- **Explicit per-method** — each integration method calls `logIntegration` directly after success and in each catch block. Central hook-based logging was rejected because reading the response body in a ky hook consumes the stream before `.json()` can read it.
- **Redaction before insert** — `client_secret`, `access_token`, `password`, and `token` keys are replaced with `[REDACTED]`. 14-digit strings matching the PINFL pattern are masked as `XXXX****XXXXXX`.

## MyID auth flow

MyID uses a two-step server-to-server flow:

1. `POST /api/v1/oauth2/access-token` — client credentials grant (form-encoded body with `client_id`, `client_secret`, `grant_type=client_credentials`). Returns a short-lived Bearer token.
2. All subsequent MyID calls use `Authorization: Bearer <token>` from step 1.

Basic auth (previously used) was rejected — the MyID dev environment returns `401 Not authenticated` for Basic auth on the session endpoint; the `WWW-Authenticate: Bearer` header confirms Bearer is required.

## Named operations (method_name values)

| Integration | method_name | HTTP |
|---|---|---|
| myid | `client_token` | POST |
| myid | `create_session` | POST |
| myid | `exchange_code` | POST |
| myid | `get_user` | GET |
