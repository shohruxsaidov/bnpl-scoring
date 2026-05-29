ALTER TABLE "deal_payment_schedules"
  ADD COLUMN IF NOT EXISTS "paid_amount" bigint NOT NULL DEFAULT 0;
