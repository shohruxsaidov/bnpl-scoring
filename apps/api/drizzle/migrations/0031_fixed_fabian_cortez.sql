ALTER TABLE "user_devices" ADD COLUMN "device_name" varchar(100);--> statement-breakpoint
ALTER TABLE "user_devices" ADD COLUMN "push_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD COLUMN "resolution_reason" varchar(32);--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD COLUMN "resolved_by_admin_user_id" integer;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_resolved_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("resolved_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;