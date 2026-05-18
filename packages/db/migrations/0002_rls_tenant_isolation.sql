-- Row-Level Security: tenant isolation (ADR 0002)
--
-- Pattern: SET LOCAL app.tenant_id = '<uuid>' at the start of every
-- tenant-scoped DB transaction in the service layer. The policy then
-- enforces that every row touched carries the matching tenant_id.
--
-- Platform-admin queries bypass RLS by using a superuser/bypassrls role —
-- those connections never set app.tenant_id.

-- Enable RLS on every tenant-scoped table.
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_cards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_basket_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_baskets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE katm_consents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontrakt_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE plumgate_scoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_criteria    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_models      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wizard_sessions     ENABLE ROW LEVEL SECURITY;

-- Isolation policy: rows are visible only when tenant_id matches the
-- session-local setting. Applies to SELECT, INSERT, UPDATE, DELETE.
CREATE POLICY tenant_isolation ON categories
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON client_cards
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON clients
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON deal_basket_items
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON deal_baskets
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON deal_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON deals
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON employee_roles
  USING (true); -- no tenant_id column; scoped via employees FK

CREATE POLICY tenant_isolation ON employees
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON installment_schedules
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON katm_consents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON kontrakt_documents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON notifications
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON payments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON plumgate_scoring_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON roles
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON scoring_criteria
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON scoring_models
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON tariffs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON wizard_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
