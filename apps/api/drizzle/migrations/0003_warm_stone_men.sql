ALTER TABLE "user_devices" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "device_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_device_id_user_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;