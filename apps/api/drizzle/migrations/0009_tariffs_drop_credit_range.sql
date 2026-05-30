-- Tariffs no longer carry a credit range. The approved limit is not constrained
-- to a per-tariff [min, max] window, so drop both columns.
ALTER TABLE "tariffs" DROP COLUMN IF EXISTS "credit_min";
ALTER TABLE "tariffs" DROP COLUMN IF EXISTS "credit_max";
