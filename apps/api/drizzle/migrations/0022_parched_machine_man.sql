CREATE TABLE "app_version_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(10) NOT NULL,
	"version" integer NOT NULL,
	"min_supported_version" varchar(20) NOT NULL,
	"latest_version" varchar(20) NOT NULL,
	"store_url" text NOT NULL,
	"message_uz" text NOT NULL,
	"message_ru" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
ALTER TABLE "app_version_policies" ADD CONSTRAINT "app_version_policies_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_version_policies_platform_version_idx" ON "app_version_policies" USING btree ("platform","version");