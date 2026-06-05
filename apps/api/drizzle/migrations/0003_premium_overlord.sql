CREATE TABLE "files" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"bucket" varchar(100) NOT NULL,
	"mime_type" varchar(100),
	"original_name" varchar(255),
	"uploaded_by_type" varchar(20) NOT NULL,
	"uploaded_by_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
