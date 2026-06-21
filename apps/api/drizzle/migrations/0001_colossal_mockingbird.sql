CREATE TABLE "katm_inps_reports" (
	"claim_id" varchar(20) PRIMARY KEY NOT NULL,
	"token" varchar,
	"demand_id" varchar,
	"incomes_all_summa" double precision,
	"period_begin" varchar,
	"period_end" varchar,
	"incomes" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "katm_reports" RENAME TO "katm_077_reports";--> statement-breakpoint
ALTER TABLE "katm_077_reports" DROP CONSTRAINT "katm_reports_claim_id_katm_claims_claim_id_fk";
--> statement-breakpoint
ALTER TABLE "katm_inps_reports" ADD CONSTRAINT "katm_inps_reports_claim_id_katm_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."katm_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "katm_077_reports" ADD CONSTRAINT "katm_077_reports_claim_id_katm_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."katm_claims"("claim_id") ON DELETE no action ON UPDATE no action;