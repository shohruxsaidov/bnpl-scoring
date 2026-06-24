CREATE SEQUENCE "public"."katm_claim_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1;--> statement-breakpoint
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
CREATE TABLE "bank_mfo_cache" (
	"mfo" varchar(5) PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"merchant_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
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
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"fcm_token" text,
	"platform" varchar(10) NOT NULL,
	"app_version" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" serial NOT NULL,
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
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_payment_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" integer NOT NULL,
	"paid_amount" integer NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"manual_payment_id" integer,
	"payment_provider" text[]
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
	"amount" integer,
	"total_payable" integer,
	"term_months" integer,
	"score_sum" numeric(10, 2),
	"scoring_decision" varchar(20),
	"prepayment_amount" integer,
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
	"session_id" uuid NOT NULL,
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
	"overdue_30_count" integer,
	"overdue_30_to_60_count" integer,
	"overdue_60_to_90_count" integer,
	"overdue_90_count" integer,
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
CREATE TABLE "manual_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"admin_user_id" integer,
	"amount" integer NOT NULL,
	"payment_type" text DEFAULT 'mib' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"min_amount" numeric(2),
	"max_amount" numeric(2),
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
	"logo_url" text,
	"contract_number" varchar(100),
	"mfo" varchar(5),
	"account_number" varchar(20),
	"bank_name" varchar(200),
	"region_id" integer,
	"scoring_model_id" integer,
	"active" boolean DEFAULT true NOT NULL,
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
	"mxik_code" varchar(50),
	"package_code" integer,
	"package_name" varchar(200),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY NOT NULL,
	"upper_id" integer,
	"name_ru" varchar(200) NOT NULL,
	"name_uz" varchar(200) NOT NULL,
	"name_uzc" varchar(200) NOT NULL
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
CREATE TABLE "scoring_histories" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"middle_name" varchar(100),
	"passport_number" varchar(10),
	"passport_series" varchar(5),
	"pinfl" varchar(14),
	"phone_number" varchar(20),
	"criteria_scores" jsonb,
	"score_sum" numeric(10, 2),
	"coefficient" numeric(5, 4),
	"decision" varchar(20) NOT NULL,
	"model_revision_id" integer,
	"platform_credit_limit" integer NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"pinfl" varchar(14) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"birth_date" date NOT NULL,
	"gender" integer NOT NULL,
	"nationality" varchar(100) NOT NULL,
	"passport_series" varchar(2),
	"passport_number" varchar(7),
	"photo_url" text,
	"verified_at" timestamp with time zone,
	"address" varchar(100),
	"region_code" varchar(3),
	"district_code" varchar(3),
	"doc_type" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hash_password" varchar,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_pinfl_unique" UNIQUE("pinfl")
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklist" ADD CONSTRAINT "blacklist_added_by_admin_id_admin_users_id_fk" FOREIGN KEY ("added_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyouts" ADD CONSTRAINT "buyouts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD CONSTRAINT "deal_payment_schedules_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD CONSTRAINT "deal_payment_schedules_manual_payment_id_manual_payments_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "katm_inps_reports" ADD CONSTRAINT "katm_inps_reports_claim_id_katm_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."katm_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_documents" ADD CONSTRAINT "merchant_documents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_documents" ADD CONSTRAINT "merchant_documents_uploaded_by_admin_id_admin_users_id_fk" FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_tariffs" ADD CONSTRAINT "merchant_tariffs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_tariffs" ADD CONSTRAINT "merchant_tariffs_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_user_sessions" ADD CONSTRAINT "merchant_user_sessions_merchant_user_id_merchant_users_id_fk" FOREIGN KEY ("merchant_user_id") REFERENCES "public"."merchant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_scoring_model_id_scoring_models_id_fk" FOREIGN KEY ("scoring_model_id") REFERENCES "public"."scoring_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_upper_id_regions_id_fk" FOREIGN KEY ("upper_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_histories" ADD CONSTRAINT "scoring_histories_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_histories" ADD CONSTRAINT "scoring_histories_model_revision_id_scoring_model_revisions_id_fk" FOREIGN KEY ("model_revision_id") REFERENCES "public"."scoring_model_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD CONSTRAINT "scoring_model_revisions_scoring_model_id_scoring_models_id_fk" FOREIGN KEY ("scoring_model_id") REFERENCES "public"."scoring_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_model_revisions" ADD CONSTRAINT "scoring_model_revisions_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_logs_request_timestamp_idx" ON "integration_logs" USING btree ("request_timestamp");--> statement-breakpoint
CREATE INDEX "integration_logs_integration_idx" ON "integration_logs" USING btree ("integration");--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_models_single_global_idx" ON "scoring_models" USING btree ("is_global") WHERE "scoring_models"."is_global";