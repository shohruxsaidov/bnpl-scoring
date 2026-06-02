CREATE TABLE "client_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"fcm_token" text,
	"platform" varchar(10) NOT NULL,
	"app_version" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
ALTER TABLE "client_devices" ADD CONSTRAINT "client_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;