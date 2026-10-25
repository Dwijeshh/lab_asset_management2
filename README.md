# Lab Asset Management

A Next.js application for tracking laboratory assets across MAHE institutions. It supports lab and user management, role-based access, asset requests and loans, notifications, and an audit trail.

## Stack

Next.js 16, React 19, TypeScript, PostgreSQL, Drizzle ORM, and Tailwind CSS 4. The application serves its API through Next.js route handlers in `src/app/api/`.

## Run locally

You need Node.js 20 or newer, npm, and a reachable PostgreSQL database.

```powershell
git clone https://github.com/Dwijeshh/lab_asset_management2.git
cd lab_asset_management2
Copy-Item .env.example .env
npm ci
```

Edit `.env` and set `DATABASE_URL` to your PostgreSQL connection string. Set a unique `JWT_SECRET` of at least 32 characters as well. You can generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Apply the committed database migrations, then start the development server:

```powershell
npm run db:migrate
npm run dev
```

Open <http://localhost:3000/login>. The health endpoint is <http://localhost:3000/api/health>; it also checks the database connection.

### Demo data

`npm run seed` is **destructive**: `src/scripts/seed.ts` deletes existing assets, users, labs, and colleges before inserting sample data. Run it only against a fresh, disposable database. Do not run it against a database containing data you need to keep.

After seeding a fresh database, the sample admin login is `admin@manipal.edu` / `password123`. Change the password before exposing the app to others. If you use an existing database, keep its existing accounts and skip the seed step.

## Roles and features

| Role | Scope | Main permissions |
| --- | --- | --- |
| Admin | All institutions | Manage users, labs, and assets; approve requests |
| Main technician | Assigned institution and lab | Manage permitted labs and assets; approve requests |
| Technician | Assigned institution and lab | View and update permitted assets; request borrowing or transfers |

Admins can switch between institutions. Non-admin accounts are restricted to their assigned institution. The app also supports optional Keycloak OIDC sign-in; local password sign-in is the default.

The main routes are `/`, `/labs`, `/labs/[id]`, `/users`, and `/login`. API routes in `src/app/api/` cover authentication, users, institutions, labs, assets, asset requests and loans, notifications, and health.

## Configuration

See [`.env.example`](./.env.example) for the full set of options.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection string |
| `JWT_SECRET` | Session signing secret; required in production and must be at least 32 characters |
| `AUTH_PROVIDER` | `local` (default) or `keycloak` |
| `KEYCLOAK_URL`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` | Required when using Keycloak |
| `REDIS_URL` | Optional shared rate-limit store for multiple app instances |
| `TRUST_PROXY` | Set to `true` only behind a proxy that overwrites `X-Forwarded-For` |
| `ALLOWED_ORIGINS` | Optional allowed origins for cross-origin protection |
| `MAX_REQUEST_SIZE` | Optional API request body limit; defaults to `1mb` |

Keep `.env` and other secrets out of Git.

## Development commands

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

`npm test` uses Vitest. Its API suites build and start the app on port 3112 by default and write to the configured database. Use a separate disposable database through `TEST_DATABASE_URL` for integration tests. Apply migrations to that database first; seed it only if it is disposable. `TEST_APP_PORT` changes the test server port.

Database schema changes belong in `src/db/schema.ts`. Generate and review a new migration before applying it:

```powershell
npm run db:generate
npm run db:migrate
npm run db:check
```

Commit the generated SQL and `drizzle/meta/` changes together. Do not edit a migration that has already been applied. Back up a database before applying migrations to important data.

## Deployment

Azure container and CI/CD configuration is in the repository. See [AZURE_DEPLOYMENT_PLAN.md](./AZURE_DEPLOYMENT_PLAN.md) for the target architecture, Azure bootstrap, GitHub configuration, and release gates. The GitHub workflow runs CI on pull requests and publishes to Azure after the Azure variables and identities are configured. No Azure deployment has been performed from this repository yet. See [SECURITY.md](./SECURITY.md) for security controls and limitations.

## Project layout

- `src/app/` — pages and API route handlers
- `src/components/` — user interface components
- `src/lib/` — authentication, authorization, validation, rate limiting, and audit helpers
- `src/db/` and `drizzle/` — schema and committed migrations
- `src/scripts/seed.ts` — destructive demo-data seed
- `tests/` — unit and API integration tests

See [CHANGELOG.md](./CHANGELOG.md) for release history.
