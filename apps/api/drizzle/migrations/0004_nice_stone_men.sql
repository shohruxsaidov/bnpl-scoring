CREATE TABLE "katm_mib_reports" (
	"claim_id" varchar(20) PRIMARY KEY NOT NULL,
	"token" varchar,
	"demand_id" varchar,
	"consent_id" varchar,
	"result_code" integer,
	"result_message" varchar,
	"passed" boolean,
	"raw" jsonb,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "katm_mib_reports" ADD CONSTRAINT "katm_mib_reports_claim_id_katm_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."katm_claims"("claim_id") ON DELETE no action ON UPDATE no action;