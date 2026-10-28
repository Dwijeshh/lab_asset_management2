# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Administrators** oversee the MAHE-wide inventory. In the current app, the admin role can switch between institutions and manage users, laboratories, and assets.
- **Main technicians** oversee asset and laboratory work within their assigned institution, including reviewing borrowing requests and recording returns.
- **Technicians** find and update assets they are permitted to manage, and request assets for their assigned laboratory.

The product is intended for use across MAHE institutions. The team has not yet chosen which role's daily workflow should take priority in future design work.

## Product Purpose

Lab Asset Manager gives MAHE staff a shared, role-aware record of laboratory equipment. Staff need to find an asset, understand its institution, lab, location, and status, keep its details current, and handle borrowing with a visible request and approval trail. Success means those everyday tasks can be completed using the same inventory record instead of disconnected lab records. No adoption or time-saving target has been set.

## Operating Context

- Assets belong to laboratories within MAHE institutions. The inventory includes computing, electronics, mechanical, and general laboratory equipment.
- Administrators can work across institutions; other roles are scoped to their assigned institution. A technician must be assigned to a lab before requesting an asset.
- Borrowing is **within an institution**. The current app blocks requests for an asset owned by another institution; this is an intended product rule, not a temporary technical limitation.
- A requester can propose a temporary loan with an expected return date or a permanent transfer. An admin or main technician reviews the request. An approved temporary loan marks the asset in use until a permitted reviewer records its return; an approved permanent transfer changes the asset's lab.
- Users sign in before using the inventory. The app currently supports local password sign-in and an optional Keycloak OIDC configuration. Which sign-in method MAHE will use long term is not yet established.

## Capabilities and Constraints

- Search inventory by name, serial number, manufacturer, or location, and filter by status and category.
- Create and maintain assets and laboratories according to role and scope. Administrators can create accounts, assign roles and institutions or labs, disable accounts, and reset passwords.
- Show asset counts and statuses, pending borrowing requests, active loans, in-app notifications, and an audit trail of important changes.
- Keep institution boundaries and role permissions enforceable at the API, including borrowing decisions.
- Preserve the distinction between an asset's owner lab and a temporary borrower's lab. A temporary loan does not permanently move ownership.
- Asset records include category, manufacturer, model, serial number, location, status, purchase date, warranty expiry, and notes where supplied.

## Brand Commitments

The existing application calls itself **Lab Asset Manager** and identifies Manipal Academy of Higher Education (MAHE) by name. It uses the MAHE logo asset at `public/logo.jpg`. Treat that identity as existing product context; no broader brand rules have been provided.

## Evidence on Hand

- The routes, components, database schema, and access checks in `src/app/`, `src/components/`, `src/db/schema.ts`, and `src/lib/` show the current roles and workflows.
- The repository contains automated tests in `tests/`. GitHub Actions run [#18](https://github.com/Dwijeshh/lab_asset_management2/actions/runs/40459516488), attempt 3, completed CI, image publishing, staging, and production successfully on 27 October 2026.
- Staging and production login pages are deployed on Azure Container Apps. Both public `/api/health` endpoints returned `{"ok":true}` when checked on 27 October 2026.
- The login page currently displays demo credentials. Those accounts and displayed passwords are demonstration data, not a product requirement or evidence of a production authentication policy.
- No user research, adoption measures, usability findings, or accessibility requirements were supplied. Future product decisions should not treat such evidence as established.

## Product Principles

1. Make asset identity, location, and current status easy to verify before someone acts on a record.
2. Keep each institution's inventory and borrowing decisions within its assigned scope.
3. Match actions to the responsibility of administrators, main technicians, and technicians.
4. Make borrowing, approval, return, and permanent transfer traceable to the people involved.
