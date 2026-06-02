# ADR 0017: API Error Localisation (ru / uz)

**Status:** Accepted

## Context

All API error responses carry `{ code: string }` only. Frontends receive the raw code key and either display it as-is or map it client-side. The platform serves Uzbek- and Russian-speaking users; human-readable, localised error messages are required at the API layer.

## Decision

**Language selection via `X-Lang` header.** Callers send `X-Lang: uz` or `X-Lang: ru` on every request. If the header is absent or holds an unrecognised value, the API falls back to `uz`. `Accept-Language` was rejected: browser-auto-set locale does not match the user's explicit in-app language preference, and quality-weight parsing adds complexity for no gain.

**Response shape — additive, not breaking.**
```json
{ "code": "deal_not_found", "message": "Shartnoma topilmadi", "args": {} }
```
`code` is preserved for programmatic frontend handling (specific UI states on `invalid_otp`, etc.). `message` is the pre-interpolated human-readable string. `args` carries raw interpolation values so the frontend can use them independently (formatting, linking). Existing consumers that only read `code` continue to work unchanged.

**Scope.** Business/domain errors and generic auth/server errors (400–409, 401, 403, 404, 500) are localised. TypeBox schema-validation errors (`body/field must be type`) are excluded — they indicate frontend bugs, not user mistakes, and translating ajv path strings is a separate concern.

**Translation dictionaries.** Typed TypeScript objects in `apps/api/src/i18n/uz.ts` and `apps/api/src/i18n/ru.ts`. Keys are the error `code` strings. A missing key is a compile error, not a silent runtime fallback.

**Two localisation entry points.**
- **Thrown errors** (service layer `throw Object.assign(new Error('code'), { statusCode })`) are caught by a Fastify `setErrorHandler` that reads `X-Lang`, translates, and sends the unified shape.
- **Inline replies** (`return reply.code(4xx).send({ code })`) are migrated to a `reply.sendError(code, args?)` decorator that does the same translation inline.

Both paths produce the same `{ code, message, args }` shape.

## Alternatives rejected

- **Replace `code` with `message`** — breaking change; all three frontends would need simultaneous updates.
- **Frontend-only i18n** — duplicates translation maintenance across three Vue apps; inconsistent if a fourth client is added.
- **`fastify-polyglot` / `node-polyglot`** — adds an npm dep whose main value (plural forms, `%{var}` templates) is not needed when dictionaries are typed TS objects with inline interpolation.
