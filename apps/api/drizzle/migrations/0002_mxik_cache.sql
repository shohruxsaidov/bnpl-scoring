ALTER TABLE "products" ADD COLUMN "package_code" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_name" varchar(200);--> statement-breakpoint
CREATE TABLE "mxik_cache" (
	"mxik_code" varchar(50) PRIMARY KEY NOT NULL,
	"mxik_name" text,
	"label" integer,
	"brand_name" varchar(200),
	"group_name" text,
	"class_name" text,
	"packages" jsonb,
	"raw_response" jsonb,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
