CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_type" varchar(20) NOT NULL,
  "actor_id" bigint NOT NULL,
  "type" varchar(40) NOT NULL,
  "params" jsonb NOT NULL DEFAULT '{}',
  "read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "notifications_actor_idx" ON "notifications" ("actor_type", "actor_id", "created_at" DESC);
