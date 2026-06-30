CREATE TABLE "user_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plum_id" integer NOT NULL,
	"masked_pan" varchar(25) NOT NULL,
	"holder_name" varchar(100),
	"expiry" varchar(5) NOT NULL,
	"pc_type" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_cards_user_plum_uq" ON "user_cards" USING btree ("user_id","plum_id");