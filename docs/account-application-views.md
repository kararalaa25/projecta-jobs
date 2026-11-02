# Account application visibility

Local implementation; no deployment or schema migration was performed.

The account menu requests `/api/applications?view=summary` using the signed-in session. It shows `طلباتي المقدمة` when the account has submitted applications and `الوظائف المعلنة والطلبات` when the account owns posted jobs. Both appear for combined accounts, regardless of self-declared account type. Counts include history so rejected/archived records remain discoverable. A failed summary request provides a retry action rather than claiming no records exist.

The new dashboard is lazy-loaded only after selecting one of those options. Applicant history includes the database job title, employer name, submission date and actual status. `submitted` is displayed as `قيد المراجعة`, `reviewing` as `تم الاطلاع`; this is not an automatic claim that someone read a request merely by opening a page.

Recruiters see jobs filtered by `publisher_id = authenticated user.id`. Opening one reveals a page of candidate names, declared phone numbers, confirmed email addresses, cover letters, dates, statuses and an authenticated CV download action. No applicant license records, Auth claims, bot chat IDs or notification settings are returned.

The existing API function serves all views, preserving the Vercel Hobby function count. Every request requires a confirmed, non-suspended account. Supplied user IDs never determine access. Applicant history filters by authenticated applicant ID. Recruiter detail/CV requests first prove ownership of the referenced job, then scope application queries to that job. CV access also verifies the ready asset belongs to the applicant and produces a 60-second signed URL. General `/api/resumes` permissions are unchanged. Legacy arbitrary CV URLs are not treated as trusted private assets.

Lists use bounded 20-row pagination. No database columns, RLS policies or grants need alteration; the existing server-only data model and API authorization remain in force. The previous interviews item remains separate and does not imply interview scheduling exists.

Validation: production build and 186 tests pass. Added tests cover account-scoped summaries/history, sanitization, foreign job rejection before identity/storage reads, CV ownership and pagination bounds. Chromium checks use mocked APIs/Auth/storage at 390px and 1440px, exercising applicant-only, publisher-only and combined navigation, job/employer/date/status display, contacts and actual temporary-file downloads. No real applicant records were created or downloaded in browser tests.
