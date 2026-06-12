CREATE SEQUENCE "public"."katm_claim_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1;--> statement-breakpoint
CREATE TABLE "katm_consents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" bigint,
	"user_id" bigint,
	"channel" varchar(20) NOT NULL,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "address" varchar(100);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "katm_region_code" varchar(2);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "katm_district_code" varchar(3);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "doc_type" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "katm_sir" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "katm_region_code" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "katm_district_code" varchar(3);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "doc_type" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "katm_sir" varchar(20);--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD COLUMN "katm_claim_id" varchar(20);--> statement-breakpoint
ALTER TABLE "scoring_sessions" ADD COLUMN "katm_claim_id" varchar(20);--> statement-breakpoint
ALTER TABLE "katm_consents" ADD CONSTRAINT "katm_consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "katm_consents" ADD CONSTRAINT "katm_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;