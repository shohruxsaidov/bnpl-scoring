CREATE TABLE "buyouts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"merchant_id" bigint NOT NULL,
	"branch_id" bigint NOT NULL,
	"amount" bigint NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;