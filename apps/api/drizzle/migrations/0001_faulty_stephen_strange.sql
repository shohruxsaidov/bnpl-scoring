CREATE TABLE "offer_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"version" integer NOT NULL,
	"title_uz" text NOT NULL,
	"title_ru" text NOT NULL,
	"body_uz" text NOT NULL,
	"body_ru" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "user_offer_rule_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"offer_rules_id" integer NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offer_rules" ADD CONSTRAINT "offer_rules_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_offer_rule_acceptances" ADD CONSTRAINT "user_offer_rule_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_offer_rule_acceptances" ADD CONSTRAINT "user_offer_rule_acceptances_offer_rules_id_offer_rules_id_fk" FOREIGN KEY ("offer_rules_id") REFERENCES "public"."offer_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_rules_type_version_idx" ON "offer_rules" USING btree ("type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "user_offer_rule_acceptances_user_rule_idx" ON "user_offer_rule_acceptances" USING btree ("user_id","offer_rules_id");