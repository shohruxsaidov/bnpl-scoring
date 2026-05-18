-- Clients are platform-wide (ADR 0002): remove tenant_id, replace with merchant_clients join table.

-- Drop the tenant-scoped RLS policy — clients have no tenant_id to filter on.
DROP POLICY tenant_isolation ON clients;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- Remove tenant_id column.
ALTER TABLE clients DROP COLUMN tenant_id;

-- Replace per-tenant PINFL uniqueness with platform-wide uniqueness.
DROP INDEX IF EXISTS clients_tenant_pinfl_uq;
CREATE UNIQUE INDEX clients_pinfl_uq ON clients (pinfl) WHERE pinfl IS NOT NULL;

-- Tenant–Client link table: records which Tenants have registered a given Client.
CREATE TABLE merchant_clients (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id),
  client_id   UUID        NOT NULL REFERENCES clients(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT merchant_clients_tenant_client_uq UNIQUE (tenant_id, client_id)
);

ALTER TABLE merchant_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON merchant_clients
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
