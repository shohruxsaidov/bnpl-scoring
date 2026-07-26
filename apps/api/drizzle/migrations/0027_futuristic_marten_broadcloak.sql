ALTER TABLE "banners" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" DROP COLUMN "click_count";