ALTER TABLE "merchants" ADD COLUMN "logo_file_id" integer;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" DROP COLUMN "logo_url";