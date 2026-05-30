CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role"    varchar(50)  NOT NULL,
  "feature" varchar(50)  NOT NULL,
  "allowed" boolean      NOT NULL DEFAULT true,
  PRIMARY KEY ("role", "feature")
);

INSERT INTO "role_permissions" ("role", "feature", "allowed") VALUES
  ('agent',          'view_deals_list',  true),
  ('agent',          'create_deal',      true),
  ('agent',          'view_admin_panel', false),
  ('branch_admin',   'view_deals_list',  true),
  ('branch_admin',   'create_deal',      false),
  ('branch_admin',   'view_admin_panel', true),
  ('merchant_admin', 'view_deals_list',  true),
  ('merchant_admin', 'create_deal',      false),
  ('merchant_admin', 'view_admin_panel', true)
ON CONFLICT DO NOTHING;
