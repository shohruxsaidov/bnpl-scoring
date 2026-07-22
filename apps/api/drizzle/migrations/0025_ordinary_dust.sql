CREATE TABLE "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"schedule_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payme_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"payme_id" varchar(30) NOT NULL,
	"deal_id" uuid NOT NULL,
	"amount_tiyin" bigint NOT NULL,
	"amount_som" numeric(15, 2) NOT NULL,
	"account" jsonb NOT NULL,
	"state" smallint DEFAULT 1 NOT NULL,
	"reason" integer,
	"payme_time" bigint NOT NULL,
	"create_time" bigint NOT NULL,
	"perform_time" bigint DEFAULT 0 NOT NULL,
	"cancel_time" bigint DEFAULT 0 NOT NULL,
	"payment_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_payments" RENAME TO "deal_payments";--> statement-breakpoint

ALTER TABLE "deal_payments" DROP CONSTRAINT "manual_payments_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_payments" DROP CONSTRAINT "manual_payments_admin_user_id_admin_users_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_payments" ADD COLUMN "source" varchar(20) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_deal_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_schedule_id_deal_payment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."deal_payment_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payme_transactions" ADD CONSTRAINT "payme_transactions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payme_transactions" ADD CONSTRAINT "payme_transactions_payment_id_deal_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_schedule_idx" ON "payment_allocations" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payme_transactions_payme_id_uq" ON "payme_transactions" USING btree ("payme_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payme_transactions_deal_pending_uq" ON "payme_transactions" USING btree ("deal_id") WHERE state = 1;--> statement-breakpoint
CREATE INDEX "payme_transactions_create_time_idx" ON "payme_transactions" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "payme_transactions_deal_idx" ON "payme_transactions" USING btree ("deal_id");--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD CONSTRAINT "deal_payment_schedules_manual_payment_id_deal_payments_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payments" ADD CONSTRAINT "deal_payments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payments" ADD CONSTRAINT "deal_payments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;