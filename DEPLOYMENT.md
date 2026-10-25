# Deployment

This application needs Node.js 20 or newer and a reachable PostgreSQL database. The repository includes configuration for Vercel, Railway, and Render. Check the target platform's current requirements before deploying.

## Prepare

1. Create a PostgreSQL database and arrange backups before applying migrations to important data.
2. Configure `DATABASE_URL` and a unique `JWT_SECRET` of at least 32 characters in the deployment environment. Do not commit either value.
3. If the app runs behind a proxy that overwrites `X-Forwarded-For`, set `TRUST_PROXY=true`. Use `REDIS_URL` when rate limits must be shared across multiple app instances.
4. For Keycloak sign-in, also set `AUTH_PROVIDER=keycloak`, `KEYCLOAK_URL`, `KEYCLOAK_CLIENT_ID`, and `KEYCLOAK_CLIENT_SECRET`.

Generate a session secret locally with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Build and start

With the deployment environment variables set, run:

```sh
npm ci
npm run typecheck
npm run lint
npm run db:migrate
npm run build
npm start
```

Apply the migrations against the target database before serving traffic. `npm run db:check` checks the committed migration set. Back up important data before changing its schema. For schema changes, generate and review a new migration with `npm run db:generate`; do not hand-edit an applied migration.

The application listens on port 3000 by default. Verify `GET /api/health` returns `{ "ok": true }` after deployment, then check login and the main workflows using an account created for that environment.

## Demo seed warning

`npm run seed` is for a fresh, disposable database only. It deletes existing assets, users, labs, and colleges before creating sample MAHE records and default-password accounts. Never use it to update an existing or production database. The legacy `deploy.sh` helper invokes this seed script and uses `drizzle-kit push`; do not use that helper for an existing database.

## CI

`.github/workflows/deploy.yml` runs typecheck, lint, migrations, seed, build, and tests with its own PostgreSQL service on pushes to `main` and `feature/**`. Its Vercel deploy job is restricted to `main` and requires repository secrets to be configured. The CI seed runs only against the workflow's temporary database.

See [README.md](./README.md) for local setup and [SECURITY.md](./SECURITY.md) for production security controls.
