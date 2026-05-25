# ADR 0011 — File Storage: MinIO for Merchant Documents

## Status
Accepted

## Context

Merchant onboarding requires uploading legal documents (signed contracts, business licences, tax certificates). The API needs a place to store binary files and return stable URLs recorded in the database.

Three options were considered:

1. **Local filesystem** — files written to the server's disk, paths stored in DB.
2. **MinIO (self-hosted S3-compatible object store)** — files stored as objects, DB stores the object URL.
3. **Database (bytea / large object)** — binary content stored directly in Postgres.

## Decision

Use **MinIO** as the file storage backend for all uploaded documents.

## Rationale

- **Local filesystem is incompatible with the deployment strategy.** ADR 0006 specifies blue-green zero-downtime deploys across two Docker containers. Files written to one container's local disk are invisible to the other. Shared NFS mounts would reintroduce the single-point-of-failure problem that blue-green solves.
- **Database storage is wrong for binary blobs at this scale.** Routing megabyte-sized files through Postgres bloats WAL, degrades backup speed, and forces every file read through the query path.
- **MinIO is self-hosted and S3-compatible.** It runs as a Docker container alongside the API, fits the existing Docker Compose / production stack, and exposes the standard S3 API. Switching to AWS S3 later requires only a credential swap.

## Consequences

- A `merchant_documents` table records (`id`, `merchant_id`, `file_url`, `document_type`, `uploaded_by_admin_id`, `uploaded_at`). The DB never stores binary content — only the MinIO object URL.
- The API gains a MinIO client (e.g. `minio` npm package) registered as a Fastify plugin.
- Presigned PUT URLs are used for uploads: the client uploads directly to MinIO; the API is never in the binary data path.
- `logo_url` and `contract_number` on the Merchant record are plain columns — logo upload follows the same presigned-URL flow.
- Documents are scoped to a Merchant and visible only to Platform Admins in v1.
