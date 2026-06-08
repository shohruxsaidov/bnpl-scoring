CREATE TABLE "regions" (
	"id" integer PRIMARY KEY NOT NULL,
	"upper_id" integer,
	"name_ru" varchar(200) NOT NULL,
	"name_uz" varchar(200) NOT NULL,
	"name_uzc" varchar(200) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "region_id" integer;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "region_id" integer;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_upper_id_regions_id_fk" FOREIGN KEY ("upper_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;