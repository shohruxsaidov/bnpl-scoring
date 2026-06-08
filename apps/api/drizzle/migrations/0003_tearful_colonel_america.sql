ALTER TABLE "scoring_model_revisions" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD COLUMN "version" varchar(50) NOT NULL;