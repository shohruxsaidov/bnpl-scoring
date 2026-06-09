CREATE TABLE "scoring_test_cases" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"inputs" jsonb NOT NULL,
	"expected_outcome" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_test_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"model_revision_id" integer NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pass_count" integer NOT NULL,
	"fail_count" integer NOT NULL,
	"results" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scoring_test_runs" ADD CONSTRAINT "scoring_test_runs_model_revision_id_scoring_model_revisions_id_fk" FOREIGN KEY ("model_revision_id") REFERENCES "public"."scoring_model_revisions"("id") ON DELETE no action ON UPDATE no action;