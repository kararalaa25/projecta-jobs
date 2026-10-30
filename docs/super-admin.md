# Projecta Super Admin

The production entry point is `https://projecta-jobs.vercel.app/admin`.

## Identity and access

Confirmed Supabase identities for `kararalkhafaji892@gmail.com` and `kararalkhafaji20@gmail.com` are owners. Their effective role is `super_admin`, and they bypass the medical-professional approval gate. This does not create accounts, bypass email confirmation, or change anyone's password. Sign in normally using the matching confirmed email. Other people require a trusted `app_metadata.role = "super_admin"` claim assigned by an existing super admin. `user_metadata`, local storage claims, URL parameters, and client-supplied roles never authorize a server operation.

Every request to `/api/admin` calls `auth.getUser(bearerToken)` before using service-role queries. Identity checks may use the public anon key; privileged operations always require the server service-role key. Anonymous requests fail before creating a client, and a verified owner sees an explicit configuration error if the privileged server key is missing. Browser route gating is only presentation. Owner accounts cannot be suspended or demoted from the dashboard; other super admins cannot edit their own privileges. Suspended users cannot administer, publish, or submit applications. A seven-day suspension expires without needing a manual metadata edit. Role labels `member`, `moderator`, and `admin` are stored but do not independently grant entry to this super-admin-only dashboard.

## Required production migration

Run [migration 007](../supabase/migrations/202610300007_super_admin.sql) in the Supabase SQL Editor (or `python scripts/apply_ingestion_migration.py --migration 202610300007_super_admin.sql` with an actual `SUPABASE_DB_URL`). A service-role REST key cannot execute DDL. No management token/database credential was available in the development environment, so this migration is delivered and tested, **not applied to production**.

The transaction creates:

- `admin_catalog`: stable IDs, editable Arabic labels, ordering and visibility for specialties, locations and tags; seeded with the five professions and all 18 governorates.
- `platform_settings`: global notification banner and maintenance mode.
- `job_applications`: authenticated applicant submissions, unique per applicant/job, with review statuses.
- `admin_audit_log`: actor, action, target and timestamp; no tokens, passwords or license content.
- `projecta_admin_mutation`: service-role-only atomic catalog/settings/application updates plus audit events.

It also expands native listing moderation statuses and removes the legacy fixed-role CHECK so administrator-added specialty IDs can be used. Existing data is preserved; the expanded status CHECK is `NOT VALID` for legacy rows. Future writes are checked. Browser table writes are revoked. All four new tables have RLS enabled and no browser grants. Reads/writes go through authenticated server handlers. Public `/api/platform` exposes only public banner/maintenance flags and category display data.

Before migration, live user management and existing listing operations work against the existing schema; catalog/settings fall back to the built-in read-only defaults. New moderation statuses or specialties can require the migration's constraint update. Applications and audit logs explicitly report a migration requirement, and unavailable metrics show `—`, never a fabricated zero. A legacy write that succeeds without audit storage returns a visible warning. Auth user updates and legacy job writes are not transactional with their audit insertion; the warning is intentional. Catalog/settings/application RPC writes are atomic with audit insertion after migration.

## Modules

- **Overview:** actual user count, active listing count, pending license submissions, total applications; refreshed every 30 seconds. Very large user scans are explicitly marked unavailable if the scan budget is exhausted.
- **Users:** paginated registered accounts, confirmed identity status, license details/document links, human approval/rejection, badge control, role elevation, seven-day suspension, ban/unban, and recovery emails. User-submitted documents are evidence to review, not proof of professional status. No credential values are displayed. Recovery links land on a session-protected password-change form.
- **Jobs:** paginated search/status filters, create/edit, approve/reject/archive, feature/unfeature and explicit delete confirmation. Direct contact fields and embedded metadata are updated together; reviewing a raw post replaces its unparsed flag. Featured jobs are highlighted and ranked first in the default public feed. Deleting a job also deletes its application records after migration.
- **Catalog:** add entries, rename Arabic labels, set numeric order, hide/show. IDs remain stable for existing references. Public role/location filters and server publishing validation use this catalog. Tags are administered separately and are not automatically inferred by the Telegram classifier, whose five-role baseline remains unchanged.
- **Applications:** authenticated submissions from the public cards, review/accept/reject, CV links, and applicant/job IDs for cross-reference.
- **Settings:** public banner and maintenance mode. Public settings refresh every 30 seconds plus a short CDN cache. Maintenance stops non-admin publish/application writes immediately at the server and shows a maintenance view to visitors; `/admin` remains available.
- **Data viewer:** paginated, read-only, explicit columns from five allowed public tables. Authentication tables and arbitrary SQL execution are not exposed. Emergency changes use the relevant validated CRUD module, or the Supabase SQL Editor for database maintenance.
- **Audit:** paginated action/actor/target timeline after migration.

## Deployment and validation

Set server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and public `VITE_SUPABASE_ANON_KEY` in **Vercel Production environment variables**, then redeploy. Cloud execution environment variables are separate and are not automatically copied to Vercel. When the service key is absent, public catalog reads use built-in defaults; no anonymous client is used for privileged queries. No service key is included in Vite assets. Google and SMS must still be enabled/configured in Supabase before they can be used; email OTP uses the existing six-digit flow. The admin bundle loads only for `/admin`; self-hosted Tajawal/Inter are licensed under the included OFL files.

Validation includes server tests (`npm test`), production build (`npm run build`), browser module/form/mobile/owner-bypass tests with mocked writes, and a disposable PostgreSQL 17 integration test. That integration applies migration 007 twice, checks seed counts, browser privilege denial, service-only RPCs, settings/audit rollback, application status transitions/uniqueness, and job/application delete cascade. `tests/admin-migration.sql` contains assertions for the disposable fixture only and must never be used for live test writes.
