CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'date', 'boolean', 'select');
--> statement-breakpoint
CREATE TYPE "public"."report_delivery_status" AS ENUM('pending', 'sending', 'sent', 'failed');
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'viewer';
--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'asset_imported';
--> statement-breakpoint
CREATE TABLE "asset_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"college_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"legacy_category" "asset_category",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_types_college_name_unique" UNIQUE("college_id","name")
);
--> statement-breakpoint
CREATE TABLE "asset_type_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_type_id" integer NOT NULL,
	"field_key" varchar(80) NOT NULL,
	"label" varchar(255) NOT NULL,
	"type" "custom_field_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "asset_type_fields_type_key_unique" UNIQUE("asset_type_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "report_settings" (
	"college_id" integer PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"timezone" varchar(100) DEFAULT 'Asia/Kolkata' NOT NULL,
	"updated_by_id" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"college_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"lab_ids" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_id" integer NOT NULL,
	"period" varchar(7) NOT NULL,
	"status" "report_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_deliveries_recipient_period_unique" UNIQUE("recipient_id","period")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(128) NOT NULL,
	"user_id" integer NOT NULL,
	"college_id" integer NOT NULL,
	"lab_id" integer NOT NULL,
	"asset_type_id" integer,
	"rows" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'preview' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "removed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "removed_by_id" integer;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "removal_reason" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "asset_type_id" integer;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_modification_requests" ADD COLUMN "asset_type_id" integer;
--> statement-breakpoint
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_type_fields" ADD CONSTRAINT "asset_type_fields_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_settings" ADD CONSTRAINT "report_settings_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_settings" ADD CONSTRAINT "report_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_recipients" ADD CONSTRAINT "report_recipients_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_recipients" ADD CONSTRAINT "report_recipients_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_recipient_id_report_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."report_recipients"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "atf_type_idx" ON "asset_type_fields" USING btree ("asset_type_id");
--> statement-breakpoint
CREATE INDEX "rr_college_idx" ON "report_recipients" USING btree ("college_id");
--> statement-breakpoint
CREATE INDEX "rr_active_idx" ON "report_recipients" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "rd_status_idx" ON "report_deliveries" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "ib_user_idx" ON "import_batches" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "ib_expiry_idx" ON "import_batches" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_removed_by_id_users_id_fk" FOREIGN KEY ("removed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_modification_requests" ADD CONSTRAINT "asset_modification_requests_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "assets_removed_idx" ON "assets" USING btree ("removed_at");
--> statement-breakpoint
CREATE INDEX "assets_type_idx" ON "assets" USING btree ("asset_type_id");
--> statement-breakpoint
CREATE INDEX "assets_lab_removed_idx" ON "assets" USING btree ("lab_id","removed_at");
--> statement-breakpoint
CREATE INDEX "amr_type_idx" ON "asset_modification_requests" USING btree ("asset_type_id");
--> statement-breakpoint
UPDATE assets a SET college_id = l.college_id FROM labs l WHERE a.lab_id = l.id AND a.college_id IS NULL;
--> statement-breakpoint
INSERT INTO asset_types (college_id, name, legacy_category)
SELECT DISTINCT a.college_id, a.category::text, a.category
FROM assets a
WHERE a.college_id IS NOT NULL
ON CONFLICT (college_id, name) DO NOTHING;
--> statement-breakpoint
UPDATE assets a SET asset_type_id = t.id
FROM asset_types t
WHERE a.college_id = t.college_id AND a.category = t.legacy_category AND a.asset_type_id IS NULL;
--> statement-breakpoint
UPDATE asset_modification_requests r SET asset_type_id = a.asset_type_id
FROM assets a WHERE r.asset_id = a.id AND r.asset_type_id IS NULL;
