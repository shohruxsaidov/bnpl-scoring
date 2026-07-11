CREATE TABLE "scoring_pipeline_settings" (
	"type" varchar(20) PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
ALTER TABLE "scoring_pipeline_settings" ADD CONSTRAINT "scoring_pipeline_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;