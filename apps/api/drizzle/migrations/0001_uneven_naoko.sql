CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(40) NOT NULL,
	"question_uz" text NOT NULL,
	"question_ru" text NOT NULL,
	"answer_uz" text NOT NULL,
	"answer_ru" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faqs_active_category_sort_idx" ON "faqs" USING btree ("is_active","category","sort_order","id");