// Load .env so @/db (which requires DATABASE_URL at import) works under
// vitest. Existing environment variables take precedence (dotenv does not
// override), which is what CI relies on.
import 'dotenv/config';