CREATE TABLE "bank_mfo_cache" (
	"mfo" varchar(5) PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "mfo" varchar(5);--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "account_number" varchar(20);--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "bank_name" varchar(200);