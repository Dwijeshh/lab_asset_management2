CREATE TABLE "device_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"requester_lab_id" integer NOT NULL,
	"college_id" integer NOT NULL,
	"asset_name" varchar(255) NOT NULL,
	"category" "asset_category" NOT NULL,
	"model" varchar(255),
	"quantity" integer NOT NULL,
	"loan_type" "loan_type" DEFAULT 'temporary' NOT NULL,
	"expected_return_date" timestamp,
	"notes" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_requests" ADD COLUMN "device_request_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "related_device_request_id" integer;--> statement-breakpoint
ALTER TABLE "device_requests" ADD CONSTRAINT "device_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_requests" ADD CONSTRAINT "device_requests_requester_lab_id_labs_id_fk" FOREIGN KEY ("requester_lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_requests" ADD CONSTRAINT "device_requests_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_requests" ADD CONSTRAINT "device_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dr_college_status_idx" ON "device_requests" USING btree ("college_id","status");--> statement-breakpoint
CREATE INDEX "dr_requester_idx" ON "device_requests" USING btree ("requester_id");--> statement-breakpoint
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_device_request_id_device_requests_id_fk" FOREIGN KEY ("device_request_id") REFERENCES "public"."device_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_device_request_id_device_requests_id_fk" FOREIGN KEY ("related_device_request_id") REFERENCES "public"."device_requests"("id") ON DELETE no action ON UPDATE no action;