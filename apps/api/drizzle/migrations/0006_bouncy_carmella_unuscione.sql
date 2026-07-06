CREATE TABLE "user_credit_limits" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"credit_limit" bigint NOT NULL,
	"scoring_id" integer,
	"scored_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "katm_claims" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scorings" ALTER COLUMN "deal_session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scorings" ADD COLUMN "origin" varchar(10) DEFAULT 'merchant' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_credit_limits" ADD CONSTRAINT "user_credit_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credit_limits" ADD CONSTRAINT "user_credit_limits_scoring_id_scorings_id_fk" FOREIGN KEY ("scoring_id") REFERENCES "public"."scorings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scorings_client_inflight_idx" ON "scorings" USING btree ("user_id") WHERE origin = 'client' AND status = 'in_progress';