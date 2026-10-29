# Lab Asset Management

A Next.js application for tracking laboratory assets across MAHE institutions. Staff can manage labs and assets, search and filter inventory, print or export asset lists, and handle borrowing requests and loans. Role-based access, notifications, and an audit trail support those workflows.

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

Open <http://localhost:3000/login>. The health endpoint is <http://localhost:3000/api/health>; it also checks the database connection. If port 3000 is occupied, run `npm run dev -- -p 3001` and use port 3001 in those URLs.

For a **fresh, disposable local database**, run `npm run seed` after migrations to create usable demo accounts. For an existing database, use an existing account or have an administrator set passwords for accounts added by migration; do not run the seed.

### Demo data

`npm run seed` is **destructive**: `src/scripts/seed.ts` deletes existing assets, users, labs, and colleges before inserting sample data. Run it only against a fresh, disposable database. The deployment migrations add MCODS and MCOPS, then add the curated set of 7 labs, 16 demo assets, and 6 sample accounts to existing databases. They preserve existing rows and avoid duplicate lab codes, user emails, and assets matched by serial number or lab and name.

After seeding a fresh database, the sample admin login is `admin@manipal.edu` / `password123`. Change the password before exposing the app to others.

Accounts newly created by migration `0002_add_demo_inventory` have no password. An administrator must set a distinct password in User Management before each account can sign in. Existing account credentials are not changed. The migrated assets have a `Demo inventory` note so they can be distinguished from real inventory. Do not use these sample records as verified physical inventory.

The sample account emails are `admin@manipal.edu`, `main.tech@manipal.edu`, `tech1@manipal.edu`, `kmc.tech@manipal.edu`, `mcods.tech@manipal.edu`, and `mcops.tech@manipal.edu`. The migration inserts only missing accounts; it does not reset any of their roles, assignments, or passwords if they already exist.

## Roles and features

| Role | Scope | Main permissions |
| --- | --- | --- |
| Admin | All institutions | Manage users, labs, and assets; approve requests |
| Main technician | Assigned institution and lab | Manage permitted labs and assets; approve requests |
| Technician | Assigned institution and lab | View and update permitted assets; request borrowing or transfers |

Admins can switch between institutions. Non-admin accounts are restricted to their assigned institution. The app also supports optional Keycloak OIDC sign-in; local password sign-in is the default.

### Requesting devices

Staff assigned to a lab can select **Request devices** on the dashboard, choose a device type and quantity available in other labs of their institution, and request a temporary loan or permanent transfer. Temporary requests can include an expected return date; all requests can include a reason. The request appears in **Borrow Requests** and notifies that institution's active main technician. The main technician (or an administrator) opens **Assign devices**, sees matching available units grouped by source lab, selects exactly the requested quantity, and approves or rejects the request. Approval creates one loan record per assigned unit. Temporary units can be marked returned in **Active Loans**. Existing requests for a specific serial-numbered asset remain available in the inventory list.

The matching device type uses asset name, category, and model. Requests and assignments stay within one institution. Staff need an assigned lab, and an active main technician must exist in the institution to receive a new quantity request.

### Asset list exports

On the dashboard inventory or a laboratory's asset list, choose **Print / download list**. Select the details to include, then print or download a PDF, Word (`.docx`), CSV (`.csv`), or ZIP file. ZIP contains PDF, Word, and CSV versions. The asset name is always included. Dashboard exports use the current institution, search, status, and category filters and include all matching pages; laboratory exports include that lab's assets. All signed-in roles can export records they are allowed to view. Exports are limited to 2,000 assets; narrow the filters for a larger inventory.

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

Azure container and CI/CD configuration is in the repository. See [AZURE_DEPLOYMENT_PLAN.md](./AZURE_DEPLOYMENT_PLAN.md) for the architecture, GitHub configuration, and release gates. The GitHub workflow runs CI on pull requests. A push to `main` builds and publishes images, runs migrations and deploys to staging, then proceeds to production through its environment approval gate. Migrations run against each environment's existing database; the destructive seed is only used in CI's disposable database.

| Environment | Application | Health check |
| --- | --- | --- |
| Staging | [Open staging](https://labasset26-staging-web.victoriousrock-e50850ed.centralindia.azurecontainerapps.io/login) | [Staging health](https://labasset26-staging-web.victoriousrock-e50850ed.centralindia.azurecontainerapps.io/api/health) |
| Production | [Open production](https://labasset26-production-web.victoriousrock-e50850ed.centralindia.azurecontainerapps.io/login) | [Production health](https://labasset26-production-web.victoriousrock-e50850ed.centralindia.azurecontainerapps.io/api/health) |

These are the deployment URLs supplied by the project team. A healthy instance returns `{"ok":true}` from `/api/health`. See [SECURITY.md](./SECURITY.md) for security controls and limitations.

## Project layout

- `src/app/` — pages and API route handlers
- `src/components/` — user interface components
- `src/lib/` — authentication, authorization, validation, rate limiting, and audit helpers
- `src/db/` and `drizzle/` — schema and committed migrations
- `src/scripts/seed.ts` — destructive demo-data seed
- `tests/` — unit and API integration tests

See [CHANGELOG.md](./CHANGELOG.md) for release history.
