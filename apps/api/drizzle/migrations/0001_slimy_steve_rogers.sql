ALTER TABLE "tariffs" DROP CONSTRAINT "tariffs_scoring_model_id_scoring_model_revisions_id_fk";
--> statement-breakpoint
ALTER TABLE "scoring_histories" ADD COLUMN "model_revision_id" integer;--> statement-breakpoint
ALTER TABLE "scoring_histories" ADD CONSTRAINT "scoring_histories_model_revision_id_scoring_model_revisions_id_fk" FOREIGN KEY ("model_revision_id") REFERENCES "public"."scoring_model_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" DROP COLUMN "scoring_model_id";