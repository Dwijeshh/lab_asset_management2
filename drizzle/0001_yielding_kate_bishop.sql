ALTER TYPE "public"."notification_type" ADD VALUE 'asset_created';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'asset_updated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'asset_deleted';--> statement-breakpoint
CREATE TABLE "lab_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lab_id" integer NOT NULL,
	"assigned_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lab_assignments_user_lab_unique" UNIQUE("user_id","lab_id")
);
--> statement-breakpoint
ALTER TABLE "lab_assignments" ADD CONSTRAINT "lab_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_assignments" ADD CONSTRAINT "lab_assignments_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_assignments" ADD CONSTRAINT "lab_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "la_user_idx" ON "lab_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "la_lab_idx" ON "lab_assignments" USING btree ("lab_id");