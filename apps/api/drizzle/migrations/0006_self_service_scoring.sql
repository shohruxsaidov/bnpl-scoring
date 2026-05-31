CREATE TABLE "scoring_pipelines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scoring_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"consent_id" varchar(100) NOT NULL,
	"consent_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_limits" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"limit_amount" bigint NOT NULL,
	"session_id" uuid NOT NULL,
	"scored_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scoring_pipelines" ADD CONSTRAINT "scoring_pipelines_session_id_scoring_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scoring_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_sessions" ADD CONSTRAINT "scoring_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_limits" ADD CONSTRAINT "user_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_limits" ADD CONSTRAINT "user_limits_session_id_scoring_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scoring_sessions"("id") ON DELETE no action ON UPDATE no action;