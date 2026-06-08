CREATE TABLE "scoring_model_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"params" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" bigint
);
--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD CONSTRAINT "scoring_model_revisions_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;