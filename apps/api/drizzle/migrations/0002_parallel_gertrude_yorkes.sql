ALTER TABLE "user_sessions" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_set_at" timestamp with time zone;