ALTER TABLE "deals" ADD COLUMN "lang" varchar(5) NOT NULL DEFAULT 'ru';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pdf_url" text;
