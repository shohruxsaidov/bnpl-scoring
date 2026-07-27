CREATE TABLE "plum_payment_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"deal_id" uuid NOT NULL,
	"card_id" integer NOT NULL,
	"amount_som" numeric(15, 2) NOT NULL,
	"extra_id" uuid NOT NULL,
	"plum_session" bigint,
	"plum_transaction_id" varchar(64),
	"payment_id" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"failure_code" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_payment_id_deal_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plum_payment_sessions_deal_live_uq" ON "plum_payment_sessions" USING btree ("deal_id") WHERE status in ('pending', 'confirming');--> statement-breakpoint
CREATE UNIQUE INDEX "plum_payment_sessions_extra_id_uq" ON "plum_payment_sessions" USING btree ("extra_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plum_payment_sessions_plum_session_uq" ON "plum_payment_sessions" USING btree ("plum_session") WHERE plum_session is not null;--> statement-breakpoint
CREATE INDEX "plum_payment_sessions_status_created_idx" ON "plum_payment_sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "plum_payment_sessions_user_idx" ON "plum_payment_sessions" USING btree ("user_id","created_at" DESC NULLS LAST);