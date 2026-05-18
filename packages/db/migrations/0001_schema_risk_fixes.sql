CREATE TABLE "deal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "legacy_id" text;--> statement-breakpoint
ALTER TABLE "katm_consents" ADD COLUMN "wizard_session_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "plumgate_scoring_sessions" ADD COLUMN "wizard_session_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "plumgate_scoring_sessions" ADD COLUMN "network" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plumgate_scoring_sessions" ADD COLUMN "raw_response" jsonb;--> statement-breakpoint
ALTER TABLE "tariffs" ADD COLUMN "credit_min" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tariffs" ADD COLUMN "credit_max" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wizard_sessions" ADD COLUMN "raw_katm_response" jsonb;--> statement-breakpoint
ALTER TABLE "wizard_sessions" ADD COLUMN "katm_demand_id" text;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "katm_consents" ADD CONSTRAINT "katm_consents_wizard_session_id_wizard_sessions_id_fk" FOREIGN KEY ("wizard_session_id") REFERENCES "public"."wizard_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plumgate_scoring_sessions" ADD CONSTRAINT "plumgate_scoring_sessions_wizard_session_id_wizard_sessions_id_fk" FOREIGN KEY ("wizard_session_id") REFERENCES "public"."wizard_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_tenant_pinfl_uq" ON "clients" USING btree ("tenant_id","pinfl") WHERE "clients"."pinfl" is not null;--> statement-breakpoint
ALTER TABLE "katm_consents" ADD CONSTRAINT "katm_consents_session_uq" UNIQUE("wizard_session_id");