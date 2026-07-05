CREATE TABLE "public_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"label" text,
	"file_uz_id" integer NOT NULL,
	"file_ru_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "user_public_offer_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"public_offer_id" integer NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "offer_rules" CASCADE;--> statement-breakpoint
DROP TABLE "user_offer_rule_acceptances" CASCADE;--> statement-breakpoint
ALTER TABLE "user_devices" ADD COLUMN "public_key" text;--> statement-breakpoint
ALTER TABLE "user_devices" ADD COLUMN "key_registered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "public_offers" ADD CONSTRAINT "public_offers_file_uz_id_files_id_fk" FOREIGN KEY ("file_uz_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_offers" ADD CONSTRAINT "public_offers_file_ru_id_files_id_fk" FOREIGN KEY ("file_ru_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_offers" ADD CONSTRAINT "public_offers_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_public_offer_acceptances" ADD CONSTRAINT "user_public_offer_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_public_offer_acceptances" ADD CONSTRAINT "user_public_offer_acceptances_public_offer_id_public_offers_id_fk" FOREIGN KEY ("public_offer_id") REFERENCES "public"."public_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_offers_version_idx" ON "public_offers" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "user_public_offer_acceptances_user_offer_idx" ON "user_public_offer_acceptances" USING btree ("user_id","public_offer_id");