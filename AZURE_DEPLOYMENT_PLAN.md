# Azure deployment and CI/CD plan

**Status:** Repository implementation is in place; Azure resources, identities, GitHub variables, and deployment are not yet configured. The bootstrap and GitHub setup steps are below. This plan targets the Next.js app in this repository and uses GitHub Actions for releases.

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
2. The updated `Dockerfile` uses: use a Node version supported by the installed Next.js (currently Node >=20.9), enable `output: "standalone"` in `next.config.ts`, and copy the files required by `npm ci` before its `postinstall` step. Copy only runtime files into the final image. Run as a non-root user and keep `.env` out of the image.
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

The Vercel deployment portion of `.github/workflows/deploy.yml` has been replaced. Run CI on pull requests and pushes to `main`:

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

Never run `npm run seed` as a deployment step. Migration `0001_add_mahe_institutions` adds MCODS and MCOPS; migration `0002_add_demo_inventory` adds the curated sample labs, assets, and accounts without replacing existing records. The release pipeline applies these to staging and then production. Newly inserted accounts have no password until an administrator sets one in User Management. Sample assets are marked `Demo inventory` in their notes and must not be treated as verified physical inventory. Remove or rotate existing demo credentials before production use.

## Completion criteria

- A pull request receives typecheck, lint, test, migration, and container-build results.
- A merge to `main` deploys the same image digest to staging, then to production only after approval.
- Application secrets are absent from GitHub workflow files and container layers.
- Health checks, logs, backup restoration, and revision rollback have been exercised in staging.

## Decisions before provisioning

Confirm the Azure subscription and region, expected traffic and budget, whether a custom domain is wanted, whether Keycloak is required, and who can approve production releases. These affect capacity, networking, identity, and DNS choices.

## Infrastructure setup and first deployment

The templates create a shared Azure Container Registry and separate staging and production environments. Each environment includes a VNet, private PostgreSQL Flexible Server, Key Vault, Container Apps environment, web app, migration job, managed identities, and Log Analytics. PostgreSQL is private; the web app receives a default HTTPS URL. A custom domain is optional.

### Prerequisites

- An Azure subscription where you can create resource groups, role assignments, federated identities, and the services above.
- Azure CLI with Bicep support, Docker, and a Bash shell for local bootstrap.
- A globally unique registry name and unique short lowercase prefix (10 characters maximum). Choose a region that supports VNet integrated Container Apps and PostgreSQL Flexible Server.
- Decide whether production requires higher PostgreSQL capacity or high availability; the sample template uses a small Burstable server and one app replica.

### Bootstrap

The first two images must exist in ACR before the environment template can create the app and job. The migration job has to run once after infrastructure deployment to initialize each empty database. Run these steps from a clean checkout with an Azure account authorized for the target subscription:

```bash
az login
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
az group create -n "$REGISTRY_RG" -l "$AZURE_REGION"
az group create -n "$STAGING_RG" -l "$AZURE_REGION"
az group create -n "$PRODUCTION_RG" -l "$AZURE_REGION"
az deployment group create -g "$REGISTRY_RG" -f infra/registry.bicep -p registryName="$ACR_NAME"
az acr login -n "$ACR_NAME"
ACR_SERVER=$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)
docker buildx build --platform linux/amd64 --push -f Dockerfile -t "$ACR_SERVER/labasset-web:bootstrap" .
docker buildx build --platform linux/amd64 --push -f Dockerfile.migrate -t "$ACR_SERVER/labasset-migrate:bootstrap" .
```

Read the immutable digests with `az acr repository show-tags --name "$ACR_NAME" --repository labasset-web --detail` or from Docker build metadata. Set `APP_IMAGE` and `MIGRATION_IMAGE` to `server/repository@sha256:...` values. Generate separate 32+ character JWT secrets and strong PostgreSQL passwords. Supply them as secure parameters from a protected local parameter file or interactive prompt; do not commit them, add them to shell history, or print them in CI logs.

```bash
az deployment group create -g "$STAGING_RG" -f infra/environment.bicep \
  -p prefix="$PREFIX" stage=staging registryName="$ACR_NAME" registryResourceGroup="$REGISTRY_RG" \
     appImage="$APP_IMAGE" migrationImage="$MIGRATION_IMAGE" \
     postgresAdminPassword="$STAGING_DB_PASSWORD" jwtSecret="$STAGING_JWT_SECRET"
az deployment group create -g "$PRODUCTION_RG" -f infra/environment.bicep \
  -p prefix="$PREFIX" stage=production registryName="$ACR_NAME" registryResourceGroup="$REGISTRY_RG" \
     appImage="$APP_IMAGE" migrationImage="$MIGRATION_IMAGE" \
     postgresAdminPassword="$PRODUCTION_DB_PASSWORD" jwtSecret="$PRODUCTION_JWT_SECRET"
```

If your environment uses a shell with command history, prefer `az deployment group create --parameters @<protected-file>` and delete the protected parameter file securely after deployment. Apply the committed migrations once to each new database with `az containerapp job start -g <environment-rg> -n <migration-job-name>`; wait for `Succeeded` before using the app. Do not run `npm run seed` against these databases. Create real accounts through the admin flow or your approved provisioning process.

### GitHub Actions configuration

Create one Entra app or user assigned identity for image publishing, plus separate deployment identities for staging and production. Add GitHub federated credentials for these subjects:

- Publisher: `repo:<owner>/<repo>:ref:refs/heads/main`
- Staging deployer: `repo:<owner>/<repo>:environment:staging`
- Production deployer: `repo:<owner>/<repo>:environment:production`

Give the publisher `AcrPush` on the registry. Give each deployer only the permissions required to start its migration job, update its Container App, read its PostgreSQL backup metadata, and read app state in its resource group. Scope production access to the production resources. Require reviewers on the GitHub `production` environment and protect `main` with the CI check.

Set repository variables `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_ACR_NAME`, and `AZURE_PUBLISH_CLIENT_ID`. Set these variables separately in each GitHub environment: `AZURE_CLIENT_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_APP_NAME`, `AZURE_MIGRATION_JOB`, and `AZURE_POSTGRES_SERVER`. The workflow publishes only from `main` and skips publishing until publisher variables exist. Application secrets remain in Key Vault and are never GitHub variables.

The release workflow builds the web and migration images from the same commit, records their digests, migrates staging, deploys and probes staging, then waits for production environment approval. It checks that a production PostgreSQL recovery point exists before migration. Confirm backup restoration and app revision rollback in staging before production use. Schema migrations must remain compatible with the previous app revision during a rollout.

### Configuration notes

- App and migration identities have ACR pull and Key Vault Secrets User permissions. Cross-resource-group ACR role assignments require role assignment privileges on the registry resource group.
- This template uses versionless Key Vault secret references so new secret versions are picked up automatically. Keep separate staging and production vaults.
- The app starts at one replica because its fallback rate limiter is process local. Add a shared Redis service and set `REDIS_URL` before raising `maxReplicas`.
- If you select Keycloak, add its URL, client ID, and client secret to the app configuration and Key Vault. Review `TRUST_PROXY` against Azure ingress behavior before enabling it.
- The default Container Apps HTTPS hostname works without a purchased domain. Add a custom hostname and certificate only if desired.

## Azure references

- [Deploy Container Apps with GitHub Actions](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)
- [Authenticate GitHub Actions to Azure with OIDC](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
- [PostgreSQL Flexible Server private networking](https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-private)
- [Use Key Vault secrets in Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- [Run manual Container Apps Jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs-get-started-cli)
- [Container Apps health probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)
- [Container Apps revisions and rollback](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
