CREATE TABLE "manual_payments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"admin_user_id" bigint,
	"amount" bigint NOT NULL,
	"payment_type" text DEFAULT 'mib' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD COLUMN "manual_payment_id" bigint;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "actor_type" varchar(20) DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD CONSTRAINT "deal_payment_schedules_manual_payment_id_manual_payments_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payments"("id") ON DELETE no action ON UPDATE no action;