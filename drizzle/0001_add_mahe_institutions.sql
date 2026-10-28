-- Add the MAHE institutions omitted when the existing staging and production
-- databases were first provisioned. Preserve all existing institution records;
-- reactivate only these two codes if an inactive row already exists.
INSERT INTO "colleges" ("name", "code", "is_active")
VALUES
  ('Manipal College of Dental Sciences (MCODS)', 'MCODS', true),
  ('Manipal College of Pharmaceutical Sciences (MCOPS)', 'MCOPS', true)
ON CONFLICT ("code") DO UPDATE SET "is_active" = true;
