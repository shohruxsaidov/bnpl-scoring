CREATE TABLE "client_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" varchar(30) NOT NULL,
	"status" varchar(10) NOT NULL,
	"reason_code" varchar(40),
	"actor_type" varchar(10) NOT NULL,
	"actor_id" integer,
	"merchant_id" integer,
	"channel" varchar(10),
	"deal_session_id" uuid,
	"deal_id" uuid,
	"scoring_id" integer,
	"user_card_id" integer,
	"dedupe_key" varchar(120),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_actions_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
DROP TABLE "app_ratings" CASCADE;--> statement-breakpoint
ALTER TABLE "deal_payments" ADD COLUMN "payment_date" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_actor_id_merchant_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_deal_session_id_deal_sessions_id_fk" FOREIGN KEY ("deal_session_id") REFERENCES "public"."deal_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_scoring_id_scorings_id_fk" FOREIGN KEY ("scoring_id") REFERENCES "public"."scorings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_user_card_id_user_cards_id_fk" FOREIGN KEY ("user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_actions_user_occurred_idx" ON "client_actions" USING btree ("user_id","occurred_at" DESC NULLS LAST);