-- Remove the `branch_admin` merchant Role. Only `agent` and `merchant_admin`
-- remain on the merchant platform.

-- Scrub the key from Employee role arrays; anyone left with no roles becomes an
-- Agent so they keep a valid, minimal grant.
UPDATE "merchant_users"
   SET "roles" = array_remove("roles", 'branch_admin');

UPDATE "merchant_users"
   SET "roles" = ARRAY['agent']
 WHERE cardinality("roles") = 0;

-- Drop the Role row. role_permissions rows cascade via the FK.
DELETE FROM "roles"
 WHERE "platform" = 'merchant'
   AND "key" = 'branch_admin';
