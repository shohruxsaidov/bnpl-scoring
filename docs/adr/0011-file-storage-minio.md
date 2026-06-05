# ADR 0011 — File Storage: MinIO for Merchant Documents and Generic File Storage

## Status
Accepted (updated to cover generic file-storage lib)

## Context

Merchant onboarding requires uploading legal documents (signed contracts, business licences, tax certificates). The API needs a place to store binary files and return stable URLs recorded in the database.

As the platform grew, additional use cases emerged (Deal attachments, generated Kontrakt PDFs, etc.) that needed the same MinIO + DB pattern. A generic, reusable file-storage library was introduced to avoid duplicating the presigned-URL flow across modules.

Three storage options were considered at the start:

1. **Local filesystem** — files written to the server's disk, paths stored in DB.
2. **MinIO (self-hosted S3-compatible object store)** — files stored as objects, DB stores a reference.
3. **Database (bytea / large object)** — binary content stored directly in Postgres.

## Decision

Use **MinIO** as the file storage backend for all uploaded documents.

For all new use cases, file metadata is managed through a generic `file-storage` library (`src/lib/file-storage/`) backed by a central `files` table. Domain tables reference files via `file_id` FK.

## Rationale

- **Local filesystem is incompatible with the deployment strategy.** ADR 0006 specifies blue-green zero-downtime deploys across two Docker containers. Files written to one container's local disk are invisible to the other. Shared NFS mounts would reintroduce the single-point-of-failure problem that blue-green solves.
- **Database storage is wrong for binary blobs at this scale.** Routing megabyte-sized files through Postgres bloats WAL, degrades backup speed, and forces every file read through the query path.
- **MinIO is self-hosted and S3-compatible.** It runs as a Docker container alongside the API, fits the existing Docker Compose / production stack, and exposes the standard S3 API. Switching to AWS S3 later requires only a credential swap.
- **Object key stored, not full URL.** The `files` table stores the MinIO object key (e.g. `deals/42/uuid`), not the full endpoint URL. Presigned GET URLs are derived at read time via `presignedGetObject`. This makes the record endpoint-agnostic — swapping MinIO for S3 requires only a credential change, not a data migration.
- **Domain tables hold the FK (`file_id → files.id`), not a polymorphic pattern.** Each domain table declares its own typed FK to `files`. This is type-safe and avoids the `(entity_type, entity_id)` polymorphic pattern which is hard to constrain in the DB and hard to join.
- **Library lives in `src/lib/`, not `src/modules/`.** It has no HTTP routes and no domain entity. Placing it in `lib/` signals that it is infrastructure consumed by domain modules, not a peer domain module itself.

## Consequences

### Legacy: `merchant_documents`

- The original `merchant_documents` table (`id`, `merchant_id`, `file_url`, `document_type`, `uploaded_by_admin_id`, `uploaded_at`) remains in place and stores the full MinIO object URL. It is **not migrated** to the generic pattern.
- `logo_url` and `contract_number` on the Merchant record remain plain text columns.

### New pattern: `files` table + `src/lib/file-storage/`

- A central `files` table records: `id`, `object_key`, `bucket`, `mime_type`, `original_name`, `uploaded_by_type` (`admin` | `merchant_user` | `system`), `uploaded_by_id` (nullable), `created_at`.
- The library (`src/lib/file-storage/`) exposes four functions consumed by domain modules:
  - `createUploadUrl` — generates a presigned PUT URL and returns the reserved `objectKey`; client uploads directly to MinIO.
  - `recordFile` — inserts a row into `files` after the client confirms the upload completed; returns the `files` row.
  - `getDownloadUrl` — fetches `object_key` from DB, returns a short-lived presigned GET URL.
  - `deleteFile` — removes the object from MinIO and deletes the `files` row.
- The Fastify MinIO plugin (`src/plugins/minio.ts`) remains the sole MinIO client; the library receives it as a dependency rather than importing it directly.
- Presigned PUT URLs are used for client-driven uploads; the API is never in the binary data path. Server-side generated files (e.g. Kontrakt PDFs) use `putObject` directly and call `recordFile` afterward.
