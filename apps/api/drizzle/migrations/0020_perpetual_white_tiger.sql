ALTER TABLE "buyouts" ADD COLUMN "document_file_id" integer;--> statement-breakpoint
ALTER TABLE "buyouts" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "buyouts" ADD COLUMN "paid_by" integer;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_document_file_id_files_id_fk" FOREIGN KEY ("document_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_paid_by_admin_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;