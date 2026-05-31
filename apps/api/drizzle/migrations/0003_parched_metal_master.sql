ALTER TABLE "deals" ADD COLUMN "deal_number" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_deal_number_unique" UNIQUE("deal_number");