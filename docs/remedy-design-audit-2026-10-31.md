# Projecta design and system audit

Date: 31 October 2026, Asia/Baghdad. Reference inspected in a browser:
https://www.remedyplatform.com/.

## Design decisions

Remedy's prominent headline, teal emphasis, quiet navigation, spacious sections
and clear card hierarchy inform the redesign. Projecta keeps its Arabic identity,
medical job-board purpose and its own content. A deep navy hero now introduces
the two opportunity streams, with a translucent pathway panel, subtle decorative
orbits and direct navigation to the board. No fabricated job counts, testimonials
or verification claims are used as decorative content.

Medical teal replaces the electric-blue primary gradient. Existing locally hosted
Cairo/Sora fonts remain, with stronger heading hierarchy and more readable muted
text. Shared preview cards, filters, search controls, modals and the uploader use
consistent borders, soft shadows and rounded surfaces. Candidate cards have a
distinct initial avatar and professional-summary label; example/device-local
profiles retain their disclosure. The mobile action bar again has five items and
a centered post button; account access remains in the header.

Keyboard focus, a skip-to-board link, reduced-motion handling, backdrop-filter
fallbacks and responsive layouts are included. Hero actions switch to the intended
feed and move focus to its results. Browser sizing checks cover 320, 390, 768 and
1440 pixels, including visible Telegram filters on mobile.

## Architecture and implementation findings

| Area | Audit finding and action |
| --- | --- |
| Resume inputs | Application forms already use PDF/DOCX browsing and drag-and-drop. No new external `cv_url` field is exposed; historical URLs remain read-only for authorized administrators. |
| Resume submission race | File controls previously remained active while an application was being saved. They now lock during submission; an immediate ref guard also prevents overlapping upload/remove actions and repeated application submissions. Empty file-picker cancellation is ignored. |
| Private Storage | Production bucket exists, is private, permits PDF/DOCX only and limits files to 5 MiB. Ownership, server validation, upload quotas, ready-only attachment and short-lived download authorization remain unchanged. Durable asset IDs are stored on applications instead of expiring signed URLs. |
| Job preview | Public cards, detail dialogs and admin previews continue to share `JobPreview`: title, description, salary, Iraqi location and phone. Missing imported data stays explicitly unknown. |
| Official postings | The platform tab remains restricted to complete manual offers. Publication is authenticated; source, status and publisher ownership are assigned server-side. Admin edits preserve imported source provenance. |
| Telegram stream | Source-filtered API queries, a dedicated tab and specialty/governorate/work-schedule controls remain intact. Unsorted/unknown values stay selectable. Existing Gemini/hybrid classification and conservative matching remain server-side; no new model billing or history replay was triggered by the redesign. |
| Database contracts | Read-only production checks confirm the exact job, application, asset, catalog and settings columns expected by current handlers. Migrations 008/009 are already applied; this release needs no additional SQL. |
| Super admins | Both configured owner identities exist, have confirmed emails and pass the shared server super-admin/publishing rules. User-editable metadata does not grant these privileges. Owner sessions are not impersonated. |
| API reliability | Existing server requests have bounded timeouts and safe errors. Public jobs responses allowlist fields and keep source filtering before pagination. Protected endpoints deny anonymous callers before privileged queries. |

## Validation

- Node unit tests: 63 passed, covering authorization, source boundaries, schema
  diagnostics, resume validation/ownership, official fields and targeting.
- Python unit tests: 41 passed, including governorate aliases, role parsing and
  full-time/part-time extraction. No live ingestion was run.
- Vite production build: passed.
- Browser checks: hero navigation, all five preview fields, direct/Telegram source
  isolation, combined Telegram filters, candidates, Arabic RTL, mobile sizing,
  PDF/DOCX browsing and PDF drag/drop, rejected file types, removal and application
  asset-ID payloads passed. Application controls/modal remain locked during a
  deliberately delayed mocked submission. Test uploads do not contain real CVs.
- Production schema and owner checks above are actual read-only remote checks.
  Hosted API/admin/Storage smoke checks follow deployment using temporary test
  identities/files, never candidate documents or owner impersonation.

## Operational limits and follow-up

The availability claim is measured successful requests, not a guarantee of zero
future 502s from Vercel, Supabase or network failures. Use monitored availability
and error-rate targets rather than hiding dependency failures as successful empty
results. No background ingestion scheduler is created by this UI release; the
existing scraper/scheduling arrangement continues to apply.

Existing unknown data is not fabricated or bulk rewritten. No qualifying direct
offers existed at preflight; the empty platform view explains this and links to
the populated Telegram feed. Record completeness is different from factual job
verification or medical-license approval.

Automatic orphan/attached-resume retention remains a separate policy decision.
Format checks are not antivirus scanning. Draft migration 010 and the historical
backfill remain excluded from execution. No new service-role key, provider
credential, database migration, public Storage policy or free-form SQL endpoint
is introduced by this redesign.
