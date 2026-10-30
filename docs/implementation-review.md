# Prepared implementation and approval plan

Status: local code prepared; approved local staging acceptance is complete (see `staging-acceptance.md`). Baseline production commit `fd78adf` is unchanged. Nothing in this document authorizes an automatic production migration or deployment.

## 1. Private resume attachment

Prepared code: `api/resumes.js`, `server/resumes.js`, `config/resumes.js`, `src/resumes.js`, `ResumeUpload`, `ResumeDownload`, the updated application form/API/admin view, and migration 008.

Flow:

1. A confirmed, non-suspended applicant selects or drops a single PDF/DOCX. Client checks extension, MIME compatibility and 5 MiB limit; the server repeats metadata validation.
2. `/api/resumes` authenticates the bearer remotely, checks maintenance, reserves a server-generated owner/UUID path, and enforces a serialized 20-upload/24-hour quota. Clients cannot choose another user's path. A signed upload token permits a non-overwriting upload to that one private object. Supabase upload tokens have a 2-hour lifetime.
3. The browser uploads directly to private Supabase Storage, avoiding Vercel's request-body limits. The standard Supabase SDK is used; upload requests have a 120-second timeout, API requests a 20-second timeout. The UI shows actual processing stages, not simulated upload percentages.
4. Completion downloads the bounded file server-side and checks actual size, PDF signature/trailer or DOCX ZIP members, limits on ZIP entry count/expanded sizes, encryption and macro filename exclusions. A SHA-256 digest and `ready` state are saved. Rejected objects are removed; only ready assets can be attached.
5. Applications store a `resume_asset_id` linked to the same applicant through a composite FK. Public URLs and signed download tokens are **not** persisted in the database. This satisfies the attachment requirement through a durable private object reference.
6. Only the owner or a confirmed super admin can request a 60-second signed download URL. Administrators can download from the application list. New submissions reject the old external `cv_url` input; existing historical URLs remain visible to authorized administrators for compatibility.

The file remains optional, matching the existing application form. Making it mandatory is a product choice. No applicant receives access to someone else's object. A linked asset cannot be discarded from the upload component. A database trigger and discard RPC serialize attachment/deletion on the same asset row to prevent concurrent deletion races. Closing the modal while upload/submission is in flight is blocked to avoid accidental interrupted submissions.

### Required approval and acceptance before production

- Approve the private bucket and migration 008. Do not make it public to avoid signed-link work.
- Approve a retention policy and a cleanup schedule. Suggested staging policy to review: delete abandoned pending/rejected/unlinked objects after 24 hours, only after their 2-hour upload tokens have expired; do not automatically delete attached resumes until the retention period is agreed. Account/job deletion can otherwise leave orphan Storage objects, so include an explicit cleanup process.
- Structural/file-size checks are **not antivirus scanning or proof that a PDF is harmless**. Consider an asynchronous quarantine + malware scanning service before expanding resume distribution to employers. That infrastructure and its handling of personal data need explicit approval and are not silently enabled.
- Completed: real signed upload + completion + download against an isolated self-hosted Supabase staging stack. Run the hosted release smoke checks after production approval. The PostgreSQL fixture validates schema/RLS/quotas, while browser tests mock Storage transport; neither replaces that staging acceptance test.
- Verify ownership denial, signed-link expiry, browser CORS, quota behavior, app FK and backups/retention using staging identities, never owner impersonation or real candidate documents.

## 2. Uniform preview and missing-data contract

`JobPreview` is shared by public cards, full job dialogs and admin listing previews. It always displays a clear title, description, expected salary, Iraqi location and phone number. The card truncates long descriptions; the details dialog preserves the complete text. Missing salary/location/phone has an explicit Arabic unavailable value. Only a normalized real Iraqi phone becomes a dial link. Raw posts retain their unverified badge. No salary, city or contact is fabricated.

This makes layout consistent; it cannot retroactively produce factual data missing from the original posts. The current local changes also limit public response fields/metadata and add deterministic ID ordering for equal timestamps.

## 3. Medical targeting and existing AI pipeline

Prepared shared rules and fixtures drive JS classification and the Python fallback. The existing Gemini parser's allowed schema/prompt now includes `General Physicians` alongside dentists, pharmacists, assistants/technicians, medical reps and admin/reception. Migration 009 adds the sixth production catalog entry. Arabic/English titles have priority over description context, assistants are not dentists, pharmacy venue names do not imply a pharmacist vacancy, and medical-rep educational requirements/visiting audiences do not imply a second hired profession.

Manual publication automatically records the recognized target role and a categorization provenance/needs-review marker. Multiple advertised roles are retained; unknown/ambiguous content remains reviewable instead of receiving invented certainty. The current Gemini pipeline remains server-side in the scraper; no new external model calls or billing occurred in this task. API publication uses deterministic classification, not a blocking Gemini call. A shared fixture corpus checks JS/Python agreement; it is not a statistically representative accuracy benchmark.

A production category change and any old-post reclassification need approval. The prepared `scripts/reconcile_job_categories.py` defaults to read-only. Its real dry run scanned 867 records and found 541 with a recoverable canonical category already in metadata; it updated **zero** rows. `--apply` uses a compare-and-set check on the original metadata and empty physical column. Do not run it without reviewing/approving the proposed reconciliation. It deliberately skips guessing from unstructured posts.

## 4. Availability/security improvements prepared

- Shared server requests now have bounded timeouts both on Vercel and in the proxy-based cloud environment, preserving caller cancellation.
- Raw third-party status/message fields are not blindly returned as trusted user-facing errors.
- `/api/jobs` uses deterministic pagination order, explicit public field/metadata allowlists and no-store on errors.
- Proposed migration 010 revokes direct anon/authenticated job-table SELECT to eliminate the observed publisher-ID read path. **Hold this until other consumers, including the main Projecta hub, are inventoried.** The website's API already uses a server service key.
- A CI workflow is prepared for Node/Python tests, build and dependency audit. GitHub required-check rules and Vercel deployment gates still need configuration after approval; committing the workflow alone cannot prevent Vercel racing a failed check.
- Owner authorization and professional-verification bypass are retained, not replaced by frontend-only email checks.

No code claims to eliminate all future 502s or to synchronize missing facts automatically. Use a monitored availability target and explicit migrations/data contracts.

## Review / rollout order

1. Owner reviews this plan and audit; approve private Storage + retention/scanning approach and the physician category. Decide whether any external consumer requires direct listing SELECT before approving 010.
2. Provision/test 008 and 009 in staging; run isolated SQL tests, unit tests, shared Python fixtures, browser upload/card/auth tests and actual Storage E2E. Add smoke checks for both APIs. No production data migration or main push yet.
3. Review the 541-row metadata-only reconciliation and a backup/rollback procedure. Apply only the approved scope; unknown posts stay unknown. A future review queue/backfill is a separate decision.
4. Following final deployment approval, apply the approved production migrations, publish code, verify the 200 job/platform APIs and authenticated resume workflow, and retain the prior Vercel deployment for rollback. Code and migration 008 must be released together: the new application/admin attachment fields require that migration.
5. If compatibility is confirmed, apply 010 and verify the main hub/external consumers continue to work via their intended server APIs. Implement the agreed orphan cleanup/retention job and monitoring as release gates, not a later untracked task.

## Validation evidence

- Node suite: 58 tests, including resume ownership, file checks, quotas, signed downloads, response redaction, target audiences and existing owner/admin/auth cases.
- Python suite: 40 tests, including the six-role shared fixtures and existing scraper safeguards; no live Telegram/Gemini ingestion was run.
- `npm run build`: successful; service-role credential absent from browser assets.
- `npm audit`: zero known advisories in the current local dependency lockfile.
- Disposable PostgreSQL 17: proposed 008/009/010 schema, restrictive private-bucket RLS despite an existing permissive policy, service-only quota RPC, same-owner attachment FK, sixth category, and direct table read restriction passed. This database is a fixture, not Supabase production.
- Local browser tests: PDF and DOCX browsing, PDF drag/drop, invalid extension rejection, private upload/completion requests, removal, attachment ID submission, unified card/details, Arabic RTL/mobile and existing OTP/OAuth guards. All writes/uploads mocked.
- Live read-only evidence: jobs/platform 200, admin/applications deny anonymous users, both owners confirmed and not suspended, private admin tables deny anonymous reads. Snapshot specifics are in the audit document.

The real local Storage acceptance test is complete. Cleanup/retention implementation, any AV service, production backfill, required-check settings, hosted release smoke checks and final deployment remain pending approval. See `staging-acceptance.md` for the exact real-service test scope and results.
