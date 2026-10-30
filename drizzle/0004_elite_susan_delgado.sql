ALTER TABLE "audit_logs" ADD COLUMN "college_id" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "related_college_id" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_related_college_id_colleges_id_fk" FOREIGN KEY ("related_college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_college_created_idx" ON "audit_logs" USING btree ("college_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_related_college_idx" ON "audit_logs" USING btree ("related_college_id");--> statement-breakpoint
-- Recover institution scope for historical rows only where the surviving
-- request or a recorded scalar college ID identifies the institution.
UPDATE "audit_logs" AS log SET "college_id" = req."owner_college_id"
FROM "asset_requests" AS req
WHERE log."entity_type" = 'asset_request' AND log."entity_id" = req."id" AND log."college_id" IS NULL;--> statement-breakpoint
UPDATE "audit_logs" AS log SET "college_id" = req."owner_college_id"
FROM "asset_loans" AS loan JOIN "asset_requests" AS req ON req."id" = loan."request_id"
WHERE log."entity_type" = 'asset_loan' AND log."entity_id" = loan."id" AND log."college_id" IS NULL;--> statement-breakpoint
UPDATE "audit_logs" AS log SET "college_id" = req."college_id"
FROM "device_requests" AS req
WHERE log."entity_type" = 'device_request' AND log."entity_id" = req."id" AND log."college_id" IS NULL;--> statement-breakpoint
UPDATE "audit_logs" AS log
SET "college_id" = substring(log."changes" from '"collegeId"[[:space:]]*:[[:space:]]*([0-9]+)')::integer
WHERE log."entity_type" IN ('asset', 'user')
  AND log."college_id" IS NULL
  AND substring(log."changes" from '"collegeId"[[:space:]]*:[[:space:]]*([0-9]+)') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "colleges" AS institution
    WHERE institution."id" = substring(log."changes" from '"collegeId"[[:space:]]*:[[:space:]]*([0-9]+)')::integer
  );
