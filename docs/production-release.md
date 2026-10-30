# Production release checkpoint — 30 October 2026

The owner approved committing, pushing to main and deploying the prepared resume,
job preview and categorization release. No additional deployment approval is
needed once its database prerequisites are satisfied.

## Initial preflight result (before the owner applied 008/009)

- JavaScript: 58 tests passed; Vite production build passed.
- Python: 40 tests passed. These were mocked unit tests, not a production scraper run.
- Production `/`, `/admin`, `/api/jobs` and `/api/platform`: HTTP 200.
- Anonymous `/api/admin?section=session` and `/api/applications`: HTTP 401 as expected.
- Both expected owner accounts are confirmed and pass the shared super-admin and
  professional-verification bypass rules. No owner session was impersonated.
- Production `resume_assets`, `job_applications.resume_asset_id`, and the private
  `projecta-resumes` bucket are absent. The General Physicians catalog entry is
  also absent. The currently deployed `/api/resumes` returns 404.

## Required coordinated release

1. Apply `supabase/migrations/202610300008_private_resumes.sql` in the production
   Supabase SQL Editor, then `202610300009_general_physicians.sql`.
   This environment has a service-role API key, but no database connection or
   Supabase management credential capable of applying arbitrary SQL. Do not try
   to work around that by exposing a general-purpose SQL execution RPC.
2. Recheck the table, attachment column, private bucket, service-only resume RPCs
   and physician catalog entry before pushing. The new admin applications query
   depends on the attachment column, so pushing before migration would regress
   that module. Existing application attachments are not rewritten.
3. Push the tested commit to main, allowing the existing Vercel Git integration
   to deploy it. Verify that the served bundle matches the new build before
   reporting a successful deployment.
4. Smoke-test the hosted home, job/platform APIs, admin authentication gate and
   resume authentication boundary. Authenticated owner and real hosted upload
   checks require an authorized test session; local staging evidence alone is
   not proof of the hosted authenticated workflow.

Migration 010 and the historical-data reconciliation remain excluded from
execution. No automatic resume-retention deletion or malware-scanning service
is enabled by this release. Keep the previous Vercel deployment available for
rollback; migration 008 is additive and should remain in place during code
rollback.

## Completed production release

The owner subsequently applied 008 and 009 successfully. Remote checks confirmed
the resume table, application attachment column, private 5 MiB bucket, discard
RPC and active General Physicians category. Release commit `517b1c2` was pushed
to GitHub main and the connected Vercel deployment became live. Its production
bundle includes the new upload UI, attachment field and resume endpoint. Bundle
hashes differ from the local build because build-time environment values differ.

Hosted acceptance used a temporary confirmed synthetic account, not an owner
session. Its temporary trusted admin role exercised session, overview, users,
jobs, catalog, settings, applications, audit and allowlisted data reads; every
request returned 200. Removing the role immediately produced 403 on admin access.
As an ordinary member, it successfully reserved, uploaded, finalized, downloaded
and discarded synthetic PDF and DOCX files. Downloaded bytes matched, and download
authorization used the configured 60-second lifetime. The account and all test
Storage objects were removed afterward.

Public jobs/platform requests returned 200; anonymous admin, application and
resume requests returned 401. No 502 occurred in these checks. This is observed
release evidence, not a guarantee against future dependency or network failures.
Migration 010, historical backfill and automatic retention cleanup were not run.
