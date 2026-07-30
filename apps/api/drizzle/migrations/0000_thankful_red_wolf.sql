CREATE SEQUENCE "public"."katm_claim_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1010 CACHE 1;--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" integer NOT NULL,
	"session_token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(500) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"role_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_version_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(10) NOT NULL,
	"version" integer NOT NULL,
	"min_supported_version" varchar(20) NOT NULL,
	"latest_version" varchar(20) NOT NULL,
	"store_url" text NOT NULL,
	"message_uz" text NOT NULL,
	"message_ru" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "bank_mfo_cache" (
	"mfo" varchar(5) PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"image_uz_file_id" integer NOT NULL,
	"image_ru_file_id" integer NOT NULL,
	"action_type" varchar(20) DEFAULT 'none' NOT NULL,
	"action_value" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "blacklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(10) NOT NULL,
	"value" varchar(20) NOT NULL,
	"reason" text,
	"added_by_admin_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blacklist_type_value_unique" UNIQUE("type","value")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"region_id" integer,
	"latitude" double precision,
	"longitude" double precision,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"merchant_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"document_file_id" integer,
	"paid_at" timestamp with time zone,
	"paid_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" varchar(30) NOT NULL,
	"status" varchar(10) NOT NULL,
	"reason_code" varchar(40),
	"actor_type" varchar(10) NOT NULL,
	"actor_id" integer,
	"merchant_id" integer,
	"channel" varchar(10),
	"deal_session_id" uuid,
	"deal_id" uuid,
	"scoring_id" integer,
	"user_card_id" integer,
	"dedupe_key" varchar(120),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_actions_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plum_id" integer NOT NULL,
	"plum_card_id" varchar(30),
	"masked_pan" varchar(25) NOT NULL,
	"holder_name" varchar(100),
	"expiry" varchar(5) NOT NULL,
	"pc_type" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credit_limits" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"credit_limit" varchar(20) NOT NULL,
	"scoring_id" integer,
	"scored_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"fcm_token" text,
	"platform" varchar(10) NOT NULL,
	"app_version" varchar(10) NOT NULL,
	"device_name" varchar(100),
	"push_enabled" boolean DEFAULT true NOT NULL,
	"language" varchar(2) DEFAULT 'ru' NOT NULL,
	"activated_at" timestamp with time zone,
	"public_key" text,
	"key_registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"device_id" uuid NOT NULL,
	"session_token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deal_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"admin_user_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"file_id" integer NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_documents_deal_id_document_type_unique" UNIQUE("deal_id","document_type")
);
--> statement-breakpoint
CREATE TABLE "deal_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"product_id" integer,
	"product_name" varchar(200) NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"mxik_code" varchar(50),
	"package_code" integer,
	"package_name" varchar(200),
	"vat_percent" integer DEFAULT 12 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_payment_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"paid_amount" numeric(15, 2) NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"manual_payment_id" integer,
	"payment_provider" text[]
);
--> statement-breakpoint
CREATE TABLE "deal_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"user_id" integer,
	"current_step" varchar(20) DEFAULT 'client' NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"katm_claim_id" varchar(20),
	"step_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"user_id" integer,
	"tariff_id" integer,
	"deal_session_id" uuid,
	"consent_id" varchar(100),
	"consent_date" date,
	"demand_id" varchar(16),
	"infoscore_raw" jsonb,
	"payment_day" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"amount" numeric(15, 2),
	"total_payable" numeric(15, 2),
	"term_months" integer,
	"score_sum" numeric(10, 2),
	"scoring_decision" varchar(20),
	"prepayment_amount" numeric(15, 2),
	"lang" varchar(5) DEFAULT 'ru' NOT NULL,
	"deal_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "deals_deal_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_deal_number_unique" UNIQUE("deal_number")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"bucket" varchar(100) NOT NULL,
	"mime_type" varchar(100),
	"original_name" varchar(255),
	"uploaded_by_type" varchar(20) NOT NULL,
	"uploaded_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration" text NOT NULL,
	"method_name" text NOT NULL,
	"method_type" text NOT NULL,
	"request" jsonb,
	"response" jsonb,
	"status" integer,
	"error_message" text,
	"response_time_in_ms" integer,
	"request_timestamp" timestamp with time zone,
	"response_timestamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "katm_claims" (
	"claim_id" varchar(20) PRIMARY KEY NOT NULL,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" uuid,
	"katm_sir" varchar NOT NULL,
	"verified" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "katm_077_reports" (
	"claim_id" varchar(20) PRIMARY KEY NOT NULL,
	"token" varchar,
	"demand_id" varchar,
	"consent_id" varchar,
	"score" integer,
	"scoring_class" varchar,
	"scoring_level" varchar,
	"active_loans" integer,
	"all_debt_sum" double precision,
	"overdue_count" integer,
	"overdue_amount" double precision,
	"max_overdue_days" integer,
	"total_contracts" integer,
	"total_claims" integer,
	"avg_monthly_payment" double precision,
	"has_defaults" boolean,
	"has_credit_ban" boolean,
	"has_juridical" boolean,
	"has_decommission" boolean,
	"overdue_30_count" integer,
	"overdue_30_to_60_count" integer,
	"overdue_60_to_90_count" integer,
	"overdue_90_count" integer,
	"pledger_liability" integer,
	"raw" jsonb,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "katm_mib_reports" (
	"claim_id" varchar(20) PRIMARY KEY NOT NULL,
	"token" varchar,
	"demand_id" varchar,
	"consent_id" varchar,
	"result_code" integer,
	"result_message" varchar,
	"passed" boolean,
	"raw" jsonb,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "katm_inps_reports" (
	"claim_id" varchar(20) PRIMARY KEY NOT NULL,
	"token" varchar,
	"demand_id" varchar,
	"incomes_all_summa" double precision,
	"period_begin" varchar,
	"period_end" varchar,
	"incomes" jsonb,
	"raw" jsonb,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"admin_user_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"payment_date" date DEFAULT CURRENT_DATE NOT NULL,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"payment_type" text DEFAULT 'mib' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"schedule_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payme_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"payme_id" varchar(30) NOT NULL,
	"deal_id" uuid NOT NULL,
	"amount_tiyin" bigint NOT NULL,
	"amount_som" numeric(15, 2) NOT NULL,
	"account" jsonb NOT NULL,
	"state" smallint DEFAULT 1 NOT NULL,
	"reason" integer,
	"payme_time" bigint NOT NULL,
	"create_time" bigint NOT NULL,
	"perform_time" bigint DEFAULT 0 NOT NULL,
	"cancel_time" bigint DEFAULT 0 NOT NULL,
	"payment_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plum_payment_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"deal_id" uuid NOT NULL,
	"card_id" integer NOT NULL,
	"amount_som" numeric(15, 2) NOT NULL,
	"extra_id" uuid NOT NULL,
	"plum_session" bigint,
	"plum_transaction_id" varchar(64),
	"payment_id" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"failure_code" varchar(40),
	"resolution_reason" varchar(32),
	"resolution_note" text,
	"resolved_by_admin_user_id" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_categories" (
	"category_id" integer NOT NULL,
	"merchant_id" integer NOT NULL,
	CONSTRAINT "merchant_categories_category_id_merchant_id_pk" PRIMARY KEY("category_id","merchant_id")
);
--> statement-breakpoint
CREATE TABLE "merchant_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" integer NOT NULL,
	"file_url" text NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"uploaded_by_admin_id" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_tariffs" (
	"merchant_id" integer NOT NULL,
	"tariff_id" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_tariffs_merchant_id_tariff_id_pk" PRIMARY KEY("merchant_id","tariff_id")
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"term_months" integer NOT NULL,
	"markup_percent" numeric(5, 2) NOT NULL,
	"min_amount" numeric(15, 2),
	"max_amount" numeric(15, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_user_id" integer NOT NULL,
	"selected_role" varchar(50) NOT NULL,
	"session_token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "merchant_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password_hash" varchar(500) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"merchant_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"roles" text[] NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"inn" varchar(20) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"address" text NOT NULL,
	"logo_file_id" integer,
	"contract_number" varchar(100),
	"mfo" varchar(5),
	"account_number" varchar(20),
	"bank_name" varchar(200),
	"region_id" integer,
	"scoring_model_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"visible_in_client_app" boolean DEFAULT true NOT NULL,
	"kyb_status" varchar(20) DEFAULT 'verified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_inn_unique" UNIQUE("inn")
);
--> statement-breakpoint
CREATE TABLE "mxik_cache" (
	"mxik_code" varchar(50) PRIMARY KEY NOT NULL,
	"mxik_name" text,
	"label" integer,
	"brand_name" varchar(200),
	"group_name" text,
	"class_name" text,
	"packages" jsonb,
	"raw_response" jsonb,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(40) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(120),
	"sent_by_admin_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" varchar(200) NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"director_name" varchar(200),
	"address" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"inn" varchar(9) NOT NULL,
	"mfo" varchar(5) NOT NULL,
	"account_number" varchar(20) NOT NULL,
	"bank_name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_singleton" CHECK ("organization"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code" varchar(10) NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"vatPercent" integer DEFAULT 12,
	"mxik_code" varchar(50),
	"package_code" integer,
	"package_name" varchar(200),
	"is_labeled" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"label" text,
	"file_uz_id" integer NOT NULL,
	"file_ru_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY NOT NULL,
	"upper_id" integer,
	"name_ru" varchar(200) NOT NULL,
	"name_uz" varchar(200) NOT NULL,
	"name_uzc" varchar(200) NOT NULL,
	"code" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"feature" varchar(50) NOT NULL,
	CONSTRAINT "role_permissions_role_id_feature_pk" PRIMARY KEY("role_id","feature")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"platform" varchar(10) NOT NULL,
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_platform_key_unique" UNIQUE("platform","key")
);
--> statement-breakpoint
CREATE TABLE "scoring_model_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"scoring_model_id" integer,
	"name" text NOT NULL,
	"version" varchar(50) NOT NULL,
	"params" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "scoring_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_pipeline_settings" (
	"type" varchar(20) PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "scoring_pipelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"scoring_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"reject_reason_code" varchar(40),
	"summary" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorings" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_session_id" uuid,
	"user_id" integer,
	"origin" varchar(10) DEFAULT 'merchant' NOT NULL,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"current_pipeline" varchar(20),
	"reject_reason_code" varchar(40),
	"katm_claim_id" varchar(20),
	"score" integer,
	"credit_limit" varchar(20),
	"criteria_scores" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_public_offer_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"public_offer_id" integer NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"pinfl" varchar(14) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"birth_date" date NOT NULL,
	"gender" integer NOT NULL,
	"nationality" varchar(100),
	"passport_series" varchar(2),
	"passport_number" varchar(7),
	"photo_id" varchar(100),
	"verified_at" timestamp with time zone,
	"citizen_ship_id" varchar(5),
	"address" varchar(100),
	"region_code" varchar(5),
	"district_code" varchar(10),
	"doc_type" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"password_hash" varchar(255),
	"pin_hash" varchar(255),
	"pin_set_at" timestamp with time zone,
	"temporary_registration" jsonb,
	"permanent_registration" jsonb,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_pinfl_unique" UNIQUE("pinfl")
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_version_policies" ADD CONSTRAINT "app_version_policies_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_image_uz_file_id_files_id_fk" FOREIGN KEY ("image_uz_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_image_ru_file_id_files_id_fk" FOREIGN KEY ("image_ru_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist" ADD CONSTRAINT "blacklist_added_by_admin_id_admin_users_id_fk" FOREIGN KEY ("added_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_document_file_id_files_id_fk" FOREIGN KEY ("document_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_paid_by_admin_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_actor_id_merchant_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_deal_session_id_deal_sessions_id_fk" FOREIGN KEY ("deal_session_id") REFERENCES "public"."deal_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_scoring_id_scorings_id_fk" FOREIGN KEY ("scoring_id") REFERENCES "public"."scorings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_actions" ADD CONSTRAINT "client_actions_user_card_id_user_cards_id_fk" FOREIGN KEY ("user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credit_limits" ADD CONSTRAINT "user_credit_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credit_limits" ADD CONSTRAINT "user_credit_limits_scoring_id_scorings_id_fk" FOREIGN KEY ("scoring_id") REFERENCES "public"."scorings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_device_id_user_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD CONSTRAINT "deal_payment_schedules_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD CONSTRAINT "deal_payment_schedules_manual_payment_id_deal_payments_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_receipts" ADD CONSTRAINT "deal_receipts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_agent_id_merchant_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sessions" ADD CONSTRAINT "deal_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agent_id_merchant_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_deal_session_id_deal_sessions_id_fk" FOREIGN KEY ("deal_session_id") REFERENCES "public"."deal_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "katm_claims" ADD CONSTRAINT "katm_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "katm_077_reports" ADD CONSTRAINT "katm_077_reports_claim_id_katm_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."katm_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "katm_mib_reports" ADD CONSTRAINT "katm_mib_reports_claim_id_katm_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."katm_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "katm_inps_reports" ADD CONSTRAINT "katm_inps_reports_claim_id_katm_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."katm_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payments" ADD CONSTRAINT "deal_payments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payments" ADD CONSTRAINT "deal_payments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_deal_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_schedule_id_deal_payment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."deal_payment_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payme_transactions" ADD CONSTRAINT "payme_transactions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payme_transactions" ADD CONSTRAINT "payme_transactions_payment_id_deal_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_payment_id_deal_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."deal_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plum_payment_sessions" ADD CONSTRAINT "plum_payment_sessions_resolved_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("resolved_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_documents" ADD CONSTRAINT "merchant_documents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_documents" ADD CONSTRAINT "merchant_documents_uploaded_by_admin_id_admin_users_id_fk" FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_tariffs" ADD CONSTRAINT "merchant_tariffs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_tariffs" ADD CONSTRAINT "merchant_tariffs_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_user_sessions" ADD CONSTRAINT "merchant_user_sessions_merchant_user_id_merchant_users_id_fk" FOREIGN KEY ("merchant_user_id") REFERENCES "public"."merchant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_scoring_model_id_scoring_models_id_fk" FOREIGN KEY ("scoring_model_id") REFERENCES "public"."scoring_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sent_by_admin_id_admin_users_id_fk" FOREIGN KEY ("sent_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_offers" ADD CONSTRAINT "public_offers_file_uz_id_files_id_fk" FOREIGN KEY ("file_uz_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_offers" ADD CONSTRAINT "public_offers_file_ru_id_files_id_fk" FOREIGN KEY ("file_ru_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_offers" ADD CONSTRAINT "public_offers_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_upper_id_regions_id_fk" FOREIGN KEY ("upper_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD CONSTRAINT "scoring_model_revisions_scoring_model_id_scoring_models_id_fk" FOREIGN KEY ("scoring_model_id") REFERENCES "public"."scoring_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD CONSTRAINT "scoring_model_revisions_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_pipeline_settings" ADD CONSTRAINT "scoring_pipeline_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_pipelines" ADD CONSTRAINT "scoring_pipelines_scoring_id_scorings_id_fk" FOREIGN KEY ("scoring_id") REFERENCES "public"."scorings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorings" ADD CONSTRAINT "scorings_deal_session_id_deal_sessions_id_fk" FOREIGN KEY ("deal_session_id") REFERENCES "public"."deal_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorings" ADD CONSTRAINT "scorings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_public_offer_acceptances" ADD CONSTRAINT "user_public_offer_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_public_offer_acceptances" ADD CONSTRAINT "user_public_offer_acceptances_public_offer_id_public_offers_id_fk" FOREIGN KEY ("public_offer_id") REFERENCES "public"."public_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_version_policies_platform_version_idx" ON "app_version_policies" USING btree ("platform","version");--> statement-breakpoint
CREATE INDEX "banners_active_sort_idx" ON "banners" USING btree ("is_active","sort_order","id");--> statement-breakpoint
CREATE INDEX "client_actions_user_occurred_idx" ON "client_actions" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "user_cards_user_plum_uq" ON "user_cards" USING btree ("user_id","plum_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_receipts_deal_id_uq" ON "deal_receipts" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_user_active_idx" ON "deals" USING btree ("user_id") WHERE status in ('active', 'overdue');--> statement-breakpoint
CREATE UNIQUE INDEX "deals_deal_session_idx" ON "deals" USING btree ("deal_session_id");--> statement-breakpoint
CREATE INDEX "integration_logs_request_timestamp_idx" ON "integration_logs" USING btree ("request_timestamp");--> statement-breakpoint
CREATE INDEX "integration_logs_integration_idx" ON "integration_logs" USING btree ("integration");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_schedule_idx" ON "payment_allocations" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payme_transactions_payme_id_uq" ON "payme_transactions" USING btree ("payme_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payme_transactions_deal_pending_uq" ON "payme_transactions" USING btree ("deal_id") WHERE state = 1;--> statement-breakpoint
CREATE INDEX "payme_transactions_create_time_idx" ON "payme_transactions" USING btree ("create_time");--> statement-breakpoint
CREATE INDEX "payme_transactions_deal_idx" ON "payme_transactions" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plum_payment_sessions_deal_live_uq" ON "plum_payment_sessions" USING btree ("deal_id") WHERE status in ('pending', 'confirming');--> statement-breakpoint
CREATE UNIQUE INDEX "plum_payment_sessions_extra_id_uq" ON "plum_payment_sessions" USING btree ("extra_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plum_payment_sessions_plum_session_uq" ON "plum_payment_sessions" USING btree ("plum_session") WHERE plum_session is not null;--> statement-breakpoint
CREATE INDEX "plum_payment_sessions_status_created_idx" ON "plum_payment_sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "plum_payment_sessions_user_idx" ON "plum_payment_sessions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "public_offers_version_idx" ON "public_offers" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_models_single_global_idx" ON "scoring_models" USING btree ("is_global") WHERE "scoring_models"."is_global";--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_pipelines_scoring_type_idx" ON "scoring_pipelines" USING btree ("scoring_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "scorings_deal_session_idx" ON "scorings" USING btree ("deal_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scorings_client_inflight_idx" ON "scorings" USING btree ("user_id") WHERE origin = 'client' AND status = 'in_progress';--> statement-breakpoint
CREATE UNIQUE INDEX "user_public_offer_acceptances_user_offer_idx" ON "user_public_offer_acceptances" USING btree ("user_id","public_offer_id");