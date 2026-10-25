# Azure deployment and CI/CD plan

**Status:** Plan only. The application is not yet deployed to Azure. This plan targets the Next.js app in this repository and uses GitHub Actions for releases.

## Target architecture

Use Azure Container Apps for the web app, Azure Container Registry (ACR) for container images, Azure Database for PostgreSQL Flexible Server for data, Azure Key Vault for secrets, and Azure Monitor/Log Analytics for logs. Create separate staging and production Container Apps, databases, and secrets; the registry can be shared.

```text
GitHub pull request ──> CI checks with temporary PostgreSQL
                               │
Merge to main ──> build image once ──> ACR (image digest)
                                      │
                        staging migration job ──> staging app ──> smoke test
                                                               │
                                                        production approval
                                                               │
                        production backup ──> migration job ──> production app
                                                               │
                                                        health + smoke test
```

ACR supplies a registry login server such as `myregistry.azurecr.io`; Container Apps supplies a default HTTPS app URL. A custom domain is optional and can be added later.

Give the Container Apps managed identities permission to pull from ACR and read their Key Vault secrets. Put PostgreSQL on private networking reachable from the Container Apps environments; expose only the web app through HTTPS. Use `DATABASE_URL` with TLS and a unique `JWT_SECRET` of at least 32 characters per environment. Keep deployment identity permissions separate from application identities.

Start with one web replica because the app's default rate limiter keeps state in process memory. Configure `REDIS_URL` with a shared Redis service before scaling to multiple replicas. Set `TRUST_PROXY=true` only after confirming the Azure ingress overwrites `X-Forwarded-For`. Keycloak settings are needed only if `AUTH_PROVIDER=keycloak` is selected.

## Phase 1 — make the repository deployable

1. Resolve the uncommitted Cloudflare/OpenNext and Freebuff changes separately from this Azure work. Do not include local `.freebuff/` logs, binaries, or generated build output in the image or a commit.
2. Repair `Dockerfile`: use a Node version supported by the installed Next.js (currently Node >=20.9), enable `output: "standalone"` in `next.config.ts`, and copy the files required by `npm ci` before its `postinstall` step. Copy only runtime files into the final image. Run as a non-root user and keep `.env` out of the image.
3. Update `.dockerignore` for generated Cloudflare/Freebuff output. Build the image from a clean checkout, run it against a disposable PostgreSQL database, and confirm `/login` loads and `/api/health` returns HTTP 200 with `{ "ok": true }`.
4. Exclude generated `.open-next/` and related build output from ESLint. The current local `npm run lint` scans those files and fails, so the CI lint gate needs this fix.
5. Package a migration command/image from the same commit as the web image. It must include `drizzle-kit` and committed `drizzle/` migrations; the slim standalone web image does not need migration tooling.

**Exit check:** A clean checkout passes `npm ci`, typecheck, lint, tests, and container build; the container serves a healthy app on port 3000.

## Phase 2 — provision staging and production

1. Choose the subscription, Azure region, capacity, and whether to use the default app URL or an optional custom domain. Define the resources as code (Bicep or Terraform) so staging and production can be recreated and reviewed.
2. Create ACR, a Container Apps environment and app for each stage, private PostgreSQL Flexible Servers/databases, Key Vault secrets, and logging. Configure database backups and retention before the first production migration.
3. Connect the Container Apps environments and databases through the required virtual network and private DNS. Give the app identities `AcrPull` and Key Vault secret read access. Store `DATABASE_URL`, `JWT_SECRET`, and any Keycloak settings as secrets rather than in GitHub or the container image.
4. Configure external HTTPS ingress to target port 3000. Use `/api/health` for readiness because it checks database connectivity. Use a simple TCP startup/liveness probe so a temporary database outage does not cause a restart loop.
5. Create a GitHub-to-Azure federated identity for deployment and scope its Azure permissions to the resources the pipeline updates. Configure separate GitHub staging and production environments; protect production with required reviewers.

**Exit check:** A manually deployed test image can read its secrets, connect privately to its database, and pass health checks in staging.

## Phase 3 — continuous integration

Replace the Vercel deployment portion of `.github/workflows/deploy.yml`. Run CI on pull requests and pushes to `main`:

1. Check out the commit and run `npm ci` with a pinned supported Node version.
2. Start temporary PostgreSQL 16 in the GitHub Actions job; run `npm run db:migrate`, `npm run db:check`, and `npm run seed` **only against that temporary database**.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
4. Build the Docker image and perform a container smoke test. Publish test results and fail the check on any error.

Protect `main` so a failing CI run cannot be merged. Tests must never use staging or production `DATABASE_URL`: the seed script deletes existing records.

## Phase 4 — continuous delivery

1. After CI succeeds on `main`, authenticate to Azure from GitHub Actions with OpenID Connect (OIDC). Build once, push the image to ACR with the commit SHA, and record its immutable digest.
2. Start a **manual Container Apps Job** to apply committed migrations to staging. Run it inside the same private network as the database. Wait for success before deploying the image digest to the staging app.
3. Wait for staging readiness, then smoke test `/api/health`, `/login`, and an authenticated asset workflow using a staging-only account.
4. Require approval through the GitHub production environment. Confirm the production database backup/recovery point, then run the production migration job and deploy **the same image digest** to production.
5. Wait for production readiness and run smoke checks. Keep the previous Container Apps revision available for traffic rollback. Design schema migrations to work with both the previous and new app versions during rollout; an image rollback does not reverse a database migration.

Never run `npm run seed` as a deployment step. Create real accounts through the app's admin flow or an approved provisioning process; remove or rotate demo credentials before production use.

## Completion criteria

- A pull request receives typecheck, lint, test, migration, and container-build results.
- A merge to `main` deploys the same image digest to staging, then to production only after approval.
- Application secrets are absent from GitHub workflow files and container layers.
- Health checks, logs, backup restoration, and revision rollback have been exercised in staging.

## Decisions before provisioning

Confirm the Azure subscription and region, expected traffic and budget, whether a custom domain is wanted, whether Keycloak is required, and who can approve production releases. These affect capacity, networking, identity, and DNS choices.

## Azure references

- [Deploy Container Apps with GitHub Actions](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)
- [Authenticate GitHub Actions to Azure with OIDC](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
- [PostgreSQL Flexible Server private networking](https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-private)
- [Use Key Vault secrets in Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- [Run manual Container Apps Jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs-get-started-cli)
- [Container Apps health probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)
- [Container Apps revisions and rollback](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
