import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// One-time baseline procedure: the initial migration is generated against an
// empty scratch database so it contains the full schema, then it is applied
// (idempotently) to existing databases. See DEPLOYMENT.md → Database
// Migrations.
//
//   node -e "<create empty app_db_baseline>"   # once
//   npx drizzle-kit generate --config drizzle.baseline.config.ts
const baselineUrl = process.env.DATABASE_URL!.replace(
  /\/([^/?#]*)(\?.*)?$/,
  "/app_db_baseline$2"
);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: baselineUrl,
  },
});