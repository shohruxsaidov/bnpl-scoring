-- RBAC: custom global Roles + default-deny grant list, replacing the old
-- frontend-only role_permissions(role, feature, allowed) matrix.

CREATE TABLE IF NOT EXISTS "roles" (
  "id"            bigserial    PRIMARY KEY,
  "key"           varchar(50)  NOT NULL,
  "name"          varchar(100) NOT NULL,
  "platform"      varchar(10)  NOT NULL,            -- 'merchant' | 'admin'
  "is_superadmin" boolean      NOT NULL DEFAULT false,
  "is_system"     boolean      NOT NULL DEFAULT false,
  "created_at"    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT "roles_platform_key_unique" UNIQUE ("platform", "key")
);

-- The old role_permissions was keyed by a role string and defaulted to allow.
-- Its rows were cosmetic (never enforced); discard and recreate as a grant list.
DROP TABLE IF EXISTS "role_permissions";

CREATE TABLE "role_permissions" (
  "role_id" bigint      NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "feature" varchar(50) NOT NULL,
  PRIMARY KEY ("role_id", "feature")
);

-- Each admin holds exactly one admin Role (nullable until backfilled by the seed).
ALTER TABLE "admin_users"
  ADD COLUMN IF NOT EXISTS "role_id" bigint REFERENCES "roles"("id");
