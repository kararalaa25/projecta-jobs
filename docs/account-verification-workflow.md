# Account menu, verification review and reactive recommendations

This release uses the existing production schema; no additional database migration is required. Backend and interactive browser tests use mocked services. Production validation additionally checks existing table permissions and JSON revision predicates in a rolled-back transaction; no real medical accounts are approved as test fixtures.

## Account menu

The signed-in account entry opens a desktop popup card or mobile sheet with a greeting, actual profile-completion percentage, a separate verification badge, and all seven requested destinations. Keyboard focus, Escape, backdrop clicks, scroll position, reduced motion and drawer handoffs are supported. Shared overlay locks prevent a closing drawer from unlocking the page behind an open dialog.

Profile completion checks name, confirmed email/phone identity, a compatible specialty/account kind, Iraqi governorate and contact number, license number, and an HTTPS credential-evidence link. Completion means submitted information is present, not that its contents have been verified. CV upload is optional, including for clinics.

The profile editor saves allowlisted self-declared data through authenticated `/api/verifications`. CV upload reuses the existing private resume pipeline; linking checks owner and ready-file state. Unlinking a CV does not delete files already used in applications. The clinical-profile builder link opens the existing local talent editor; it does not silently publish a profile or CV.

Saved Jobs opens saved listings, Training opens `/training`, and Support explains verification/privacy/matching with a link to the existing contact section. My Interviews displays real account-scoped application statuses and clearly states that interview scheduling is not implemented; it does not invent interview appointments.

## Verification storage and authorization

No new table or publication is needed. The existing service-only `profiles` table stores the structured workflow in `medical_credentials.verification_request`; it includes an immutable submitted snapshot, request UUID, timestamps, review decision, and independently approved credential flags. `verification_history` retains the last 20 completed decisions. The profile row is already protected by RLS and denies browser access.

Only the authenticated owner may save/submit/withdraw their profile. All administrative actions use the existing remotely checked super-admin authorization. Reviewers cannot approve themselves. Generic user-management approval toggles and the legacy `license.submit` action cannot bypass the new review panel.

Requests require all completion checks and a confirmed, unsuspended identity. Administrators review them at `/admin/verifications`, with a pending-count notification and filterable request list. Approval requires explicitly confirming evidence review. Syndicate membership and specialist credentials are separate opt-in administrator decisions; clinic/medical-center review instead permits facility-license verification. Rejections require a reason.

Writes use random revision tokens and compare-and-swap predicates on the private profile row. Pending requests cannot be edited without withdrawal; a review claim prevents competing decisions. Role/ban changes share the same lock protocol and merge fresh Auth metadata so a stale review cannot restore an old privilege.

The durable request states are `submitting → pending → reviewing → approved/rejected`, or `pending → withdrawing → withdrawn`. Auth and profile-row updates are separate operations, so intermediate states are intentional. Failed submission/withdrawal retries reuse the same request. A partially completed review accepts only the same decision, credential flags and note; another authorized reviewer may finish that identical decision. An interrupted profile-save lock expires after one minute. Refresh and retry after an uncertain network result; do not force a different decision into an in-flight request.

Approved professional/organization claims are written only to administrator-controlled Auth `app_metadata`; the private profile row mirrors review status and credential approvals. Material identity/credential edits remove prior approval. Clinic/center organization approvals can authorize job posting without claiming that a facility is an individually licensed doctor.

## Reactive delivery

After successful changes, the server sends a content-free Supabase Realtime broadcast on `projecta:trust`, event `changed`. It carries a timestamp only. Clients re-fetch the authoritative account, listing-trust summaries, published talent and admin pending counts. Broadcast payloads never grant a badge; spoofing a notification can only request a bounded refresh. Client subscriptions are shared and cleaned up, with immediate/trailing refresh coalescing for bursts. Existing visible-tab/focus polling remains a fallback when WebSockets or a broadcast are unavailable.

## Matching

Saving the matching form updates its account-scoped local preference and enables the recommendation filter immediately. Both job feeds derive their filtered arrays, counts, scores and fit ranking from that same React state. The selected specialty and any selected governorate/shift require positive matching evidence; advertised skills with no overlap are excluded, while unspecified job skills remain eligible with limited-data scoring. Candidate-directory cards are unaffected.

The `الفرص المناسبة لملفي فقط` switch shows all jobs while retaining advisory badges. Disabling matching removes its effects entirely; clearing search does not silently re-enable a disabled profile. Native storage events handle other tabs, and a same-window event updates other subscribers immediately. Missing job details never become positive score evidence. Shift/day/evening/night metadata survives job normalization.

## Validation

Run `npm test` and `npm run build`. Tests cover completion, authorization, stale/competing decisions, interrupted Auth/database operations, organization credentials, private CV ownership, notification cleanup/coalescing, overlay handoffs and bilingual recommendation filters. Browser fixtures exercise all account destinations, local form/CV actions, admin notification/review, reactive badges, same-window/cross-tab matching, saved jobs/sign-out, and seven viewport widths. All external services are blocked or mocked for local validation.
