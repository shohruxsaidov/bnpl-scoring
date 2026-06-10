CREATE TABLE "scoring_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "scoring_model_id" integer;--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD COLUMN "scoring_model_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_models_single_global_idx" ON "scoring_models" USING btree ("is_global") WHERE "scoring_models"."is_global";--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_scoring_model_id_scoring_models_id_fk" FOREIGN KEY ("scoring_model_id") REFERENCES "public"."scoring_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD CONSTRAINT "scoring_model_revisions_scoring_model_id_scoring_models_id_fk" FOREIGN KEY ("scoring_model_id") REFERENCES "public"."scoring_models"("id") ON DELETE no action ON UPDATE no action;