CREATE TABLE "notification_broadcasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "admin_id" bigint NOT NULL,
  "target_type" varchar(30) NOT NULL,
  "target_id" varchar(30),
  "title" text NOT NULL,
  "body" text NOT NULL,
  "recipient_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
