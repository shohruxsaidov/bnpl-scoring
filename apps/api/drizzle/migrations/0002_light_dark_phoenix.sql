CREATE TABLE "organization" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" varchar(200) NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"inn" varchar(9) NOT NULL,
	"mfo" varchar(5) NOT NULL,
	"account_number" varchar(20) NOT NULL,
	"bank_name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_singleton" CHECK ("organization"."id" = 1)
);
