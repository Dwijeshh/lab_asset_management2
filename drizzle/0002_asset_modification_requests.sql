CREATE TYPE "public"."asset_modification_request_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE "asset_modification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"college_id" integer NOT NULL,
	"asset_id" integer,
	"asset_name" varchar(255) NOT NULL,
	"lab_id" integer NOT NULL,
	"requested_by_id" integer NOT NULL,
	"proposed_changes" jsonb NOT NULL,
	"original_values" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "asset_modification_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" integer,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);

--> statement-breakpoint
ALTER TABLE "asset_modification_requests" ADD CONSTRAINT "asset_modification_requests_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_modification_requests" ADD CONSTRAINT "asset_modification_requests_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_modification_requests" ADD CONSTRAINT "asset_modification_requests_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_modification_requests" ADD CONSTRAINT "asset_modification_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_modification_requests" ADD CONSTRAINT "asset_modification_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "amr_status_idx" ON "asset_modification_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "amr_asset_idx" ON "asset_modification_requests" USING btree ("asset_id");
--> statement-breakpoint
CREATE INDEX "amr_lab_idx" ON "asset_modification_requests" USING btree ("lab_id");
--> statement-breakpoint
CREATE INDEX "amr_requester_idx" ON "asset_modification_requests" USING btree ("requested_by_id");
--> statement-breakpoint
CREATE INDEX "amr_college_idx" ON "asset_modification_requests" USING btree ("college_id");
