ALTER TABLE "buyouts" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ALTER COLUMN "paid_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "total_payable" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "prepayment_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "manual_payments" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "tariffs" ALTER COLUMN "min_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "tariffs" ALTER COLUMN "max_amount" SET DATA TYPE numeric(15, 2);