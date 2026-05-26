# ADR 0013: MXIK Integration

**Status:** Accepted

## Context

Products require a 17-digit MXIK code for fiscal receipt compliance. Previously the field was a free-text input — the user had to know the exact code. The goal is an autocomplete UX where the user can type a partial code and select from matching results.

The external MXIK registry (`utilities.thebetacompany.uz`) provides only one endpoint: exact lookup by code (`GET /data/by-mxik?mxikCode=<17-digit>&lang=uz_cyrl`). There is no search-by-name endpoint.

## Decisions

**Backend proxy over direct browser call.** The frontend never calls `utilities.thebetacompany.uz` directly. All MXIK requests go through our API. This avoids CORS issues, keeps the external URL out of the browser, enables caching, and allows integration logging per ADR-0005.

**`mxik_cache` table for name-based search.** Because the external API is lookup-only, search-by-name is powered by previously-cached entries in `mxik_cache`. First lookup stores the result; subsequent lookups are served from cache. A user typing a name only sees codes they or another user has looked up before. This is a known limitation — brand-new codes require typing the full 17 digits and triggering a lookup explicitly.

**Two API endpoints, registered under both auth contexts.**
- `GET /mxik/lookup?code=<17-digit>` — cache-first; calls external API on miss, writes to cache.
- `GET /mxik/search?q=<text>` — searches `mxik_cache` only by `mxik_name ILIKE` or `mxik_code LIKE`.

Registered under both `verifyMerchantJwt` (merchant-app) and `verifyAdminJwt` (platform-admin) prefixes. A shared unauthenticated endpoint was rejected — MXIK lookup implicitly reveals what products a merchant is cataloguing.

**`package_code` + `package_name` stored on Product.** The MXIK response includes a `packages` array of unit-of-measure options (each with an integer `code` and display `name`). The user selects one at product creation time. Both the code and the denormalized display name are stored on the `products` table to avoid a join on every product list query.

**Integration logging per ADR-0005.** Every call to the external MXIK API (lookup only — search never hits the external API) is logged in `integration_logs` with `integration = 'mxik'`, fire-and-forget. No sensitive data in MXIK responses; standard redaction rules apply.

## Schema additions

```sql
-- products table
ALTER TABLE products ADD COLUMN package_code integer;
ALTER TABLE products ADD COLUMN package_name varchar(200);

-- new table
CREATE TABLE mxik_cache (
  mxik_code    varchar(50) PRIMARY KEY,
  mxik_name    text,
  label        integer,
  brand_name   varchar(200),
  group_name   text,
  class_name   text,
  packages     jsonb,
  raw_response jsonb,
  cached_at    timestamptz NOT NULL DEFAULT now()
);
```

## Known limitation

Search only covers previously-looked-up codes. For a brand-new MXIK code, the user must type the full 17 digits and trigger an explicit lookup. The UI communicates this with a hint.
