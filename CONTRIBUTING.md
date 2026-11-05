# Contributing

Thanks for helping improve Lab Asset Manager. Changes should preserve institution boundaries, role permissions, and the asset borrowing trail.

## Before you start

- Check existing issues and pull requests. For a substantial change, open an issue describing the staff workflow and intended behavior.
- Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Do not open a public issue with exploit details.
- Use sample data in reports and screenshots. Do not include real staff credentials, personal information, or database exports.

## Local setup

Follow the [README](README.md#run-locally) for installation, environment variables, and migrations. Use a disposable database for tests and seed data; `npm run seed` deletes existing records.

## Make a change

1. Create a branch from the latest `main`.
2. Keep the change focused. Add or update tests when behavior changes.
3. Preserve the API's role and institution checks. Add a reviewed migration for schema changes; never edit a migration that has already been applied.
4. Update documentation when a user-facing workflow, configuration, or deployment step changes.
5. Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test`. Integration tests need a separate disposable database through `TEST_DATABASE_URL`.

## Pull requests

Open a pull request against `main` and fill in the template. Explain affected roles and institutions, testing, and any migration or configuration steps. Add before-and-after screenshots for UI changes without exposing real user data. Wait for the required CI check and review before merging.

The repository code is distributed under the [MIT License](LICENSE). Campus photos, the MAHE logo, and other third-party media may have separate rights; only add media you have permission to use and document its source and terms.
