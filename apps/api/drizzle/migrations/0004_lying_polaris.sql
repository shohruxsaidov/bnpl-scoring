ALTER TABLE "regions" ADD COLUMN "code" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "temporary_registration" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permanent_registration" jsonb;