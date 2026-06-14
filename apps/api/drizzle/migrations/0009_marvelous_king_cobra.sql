CREATE TABLE "merchant_categories" (
	"category_id" bigint NOT NULL,
	"merchant_id" bigint NOT NULL,
	CONSTRAINT "merchant_categories_category_id_merchant_id_pk" PRIMARY KEY("category_id","merchant_id")
);
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_merchant_id_merchants_id_fk";
--> statement-breakpoint
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "merchant_id";