CREATE TABLE "scoring_histories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"middle_name" varchar(100),
	"passport_number" varchar(10),
	"passport_series" varchar(5),
	"pinfl" varchar(14),
	"phone_number" varchar(20),
	"criteria_scores" jsonb,
	"score_sum" numeric(10, 2),
	"coefficient" numeric(5, 4),
	"decision" varchar(20) NOT NULL,
	"platform_credit_limit" bigint NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "client_scorings" CASCADE;
