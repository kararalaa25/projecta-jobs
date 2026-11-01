# Local card, posting and verification polish

The hero's Platform Jobs and Telegram Jobs choices now share an explicit 24px radius; the platform gradient and brand palette are retained. Posting uses six ascending IQD salary options (500k, 750k, 1M, 1.25M, 1.5M, 2M+) and native specialty/governorate/schedule selectors. Imported Telegram salary parsing and older API clients retain their existing free-form salary compatibility.

The feed removes duplicate Telegram selectors, sidebar marketing text and repeated ready/count banners. Search, sidebar/mobile filters, empty/error states, refresh, source attribution and automatic sync status remain accessible. The connection and loading feedback are compact.

Dentist, pharmacist and physician profiles need a license number and a private uploaded syndicate/license document for completion and verification submission. General specialties can complete their profiles without these optional fields. Clinics/medical centers retain their facility-license requirement. Completion is data readiness; only an administrator can grant verified status or a syndicate badge.

Uploads accept PDF, PNG and JPEG up to 5 MiB. Images are converted locally into a single-page PDF, preserving aspect ratio, so the existing private `projecta-resumes` bucket, upload reservation/inspection API and `resume_assets` table can be reused. The PDF-generation library is lazy and loads only after image selection. The original image is never uploaded separately. Existing byte checks, content inspection, quotas and signed upload/download URLs remain active.

`license_asset_id` is carried in the private profile workflow and Auth's editable profile draft; the actual file ID is also retained in the existing profile `medical_credentials` JSON and immutable review snapshot. A submitted ID alone is never trusted: saves, submissions and approvals check the ready PDF asset belongs to the subject user. A CV or random ID does not establish authenticity; the administrator must inspect the actual document. Approving core medical accounts requires explicit syndicate-membership confirmation. No automatic badge is granted by upload, file naming or profile completion.

Documents linked to a profile, current request or retained review history cannot be discarded through the upload API. Reviewers use an authenticated temporary download action instead of an arbitrary external URL for new medical requests. Existing external links remain available for facility/legacy review. Existing approvals are not retroactively revoked; edited medical identity/evidence still triggers the existing re-review behavior. Badges derive exclusively from administrator-controlled trust claims and remain absent from illustrative/local talent records.

Syndicate signals are prominent in profile identity/CV/menu views, published talent cards and details, job cards and the applicant header. No private document URLs or contents are placed on public cards.

No new tables, bucket policies or SQL migrations are required. All changes are local; nothing was deployed and no database migration or production-data write was performed. Browser checks use mocked Auth/storage/API traffic, while backend tests verify ownership, readiness, completion, explicit review, deletion retention and untrusted evidence handling.
