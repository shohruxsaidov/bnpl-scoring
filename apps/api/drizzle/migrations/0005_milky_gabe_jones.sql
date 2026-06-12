CREATE TABLE "deal_session_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"step" varchar(20) NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" bigint NOT NULL,
	"branch_id" bigint NOT NULL,
	"agent_id" bigint NOT NULL,
	"client_id" bigint,
	"current_step" varchar(20) DEFAULT 'client' NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"step_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "director_name" varchar(200);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "deal_session_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_session_events" ADD CONSTRAINT "deal_session_events_session_id_deal_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."deal_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_agent_id_merchant_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_deal_session_id_deal_sessions_id_fk" FOREIGN KEY ("deal_session_id") REFERENCES "public"."deal_sessions"("id") ON DELETE no action ON UPDATE no action;