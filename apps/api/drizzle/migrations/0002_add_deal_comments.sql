CREATE TABLE "deal_comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"admin_user_id" bigint NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;