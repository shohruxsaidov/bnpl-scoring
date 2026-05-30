CREATE TABLE "role_permissions" (
	"role_id" bigint NOT NULL,
	"feature" varchar(50) NOT NULL,
	CONSTRAINT "role_permissions_role_id_feature_pk" PRIMARY KEY("role_id","feature")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"platform" varchar(10) NOT NULL,
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_platform_key_unique" UNIQUE("platform","key")
);
--> statement-breakpoint
CREATE TABLE "client_scorings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" bigint NOT NULL,
	"deal_id" uuid,
	"criteria_scores" jsonb,
	"score_sum" numeric(10, 2),
	"coefficient" numeric(5, 4),
	"decision" varchar(20) NOT NULL,
	"platform_credit_limit" bigint NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"product_id" bigint,
	"product_name" varchar(200) NOT NULL,
	"tan_narxi" numeric(15, 2) NOT NULL,
	"mxik_code" varchar(50),
	"package_code" integer,
	"package_name" varchar(200),
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_payment_schedules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"paid_amount" bigint NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" bigint NOT NULL,
	"branch_id" bigint NOT NULL,
	"agent_id" bigint NOT NULL,
	"client_id" bigint,
	"tariff_id" bigint,
	"consent_id" varchar(100),
	"consent_date" date,
	"demand_id" varchar(16),
	"infoscore_raw" jsonb,
	"payment_day" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"amount" bigint,
	"total_payable" bigint,
	"term_months" integer,
	"score_sum" numeric(10, 2),
	"scoring_decision" varchar(20),
	"lang" varchar(5) DEFAULT 'ru' NOT NULL,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" bigint NOT NULL,
	"target_type" varchar(30) NOT NULL,
	"target_id" varchar(30),
	"title" text NOT NULL,
	"body" text NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_id" bigint NOT NULL,
	"type" varchar(40) NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "role_id" bigint;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "middle_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "middle_name" varchar(100);--> statement-breakpoint
ALTER TABLE "integration_logs" ADD COLUMN "response_time_in_ms" integer;--> statement-breakpoint
ALTER TABLE "integration_logs" ADD COLUMN "request_timestamp" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_logs" ADD COLUMN "response_timestamp" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_scorings" ADD CONSTRAINT "client_scorings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_scorings" ADD CONSTRAINT "client_scorings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payment_schedules" ADD CONSTRAINT "deal_payment_schedules_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agent_id_merchant_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariffs" DROP COLUMN "credit_min";--> statement-breakpoint
ALTER TABLE "tariffs" DROP COLUMN "credit_max";