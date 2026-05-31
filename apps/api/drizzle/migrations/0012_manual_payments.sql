CREATE TABLE "manual_payments" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "deal_id" uuid NOT NULL REFERENCES "deals"("id") ON DELETE CASCADE,
  "admin_user_id" bigint REFERENCES "admin_users"("id"),
  "amount" bigint NOT NULL,
  "payment_type" text NOT NULL DEFAULT 'mib',
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "deal_payment_schedules"
  ADD COLUMN "manual_payment_id" bigint REFERENCES "manual_payments"("id");
