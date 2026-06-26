CREATE TABLE "scoring_pipelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"scoring_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"reject_reason_code" varchar(40),
	"summary" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorings" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_session_id" uuid NOT NULL,
	"user_id" integer,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"current_pipeline" varchar(20),
	"katm_claim_id" varchar(20),
	"score" integer,
	"credit_limit" double precision,
	"criteria_scores" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scoring_pipelines" ADD CONSTRAINT "scoring_pipelines_scoring_id_scorings_id_fk" FOREIGN KEY ("scoring_id") REFERENCES "public"."scorings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorings" ADD CONSTRAINT "scorings_deal_session_id_deal_sessions_id_fk" FOREIGN KEY ("deal_session_id") REFERENCES "public"."deal_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorings" ADD CONSTRAINT "scorings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_pipelines_scoring_type_idx" ON "scoring_pipelines" USING btree ("scoring_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "scorings_deal_session_idx" ON "scorings" USING btree ("deal_session_id");