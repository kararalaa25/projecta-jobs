# WhatsApp Cloud API — local implementation

No deployment, database migration, Meta API message, or template registration was performed. HTTP/API tests use injected mocks.

## Phone format

`lib/phone.ts` exports `formatIraqiPhoneNumber(phone: string)`. `+9647800000000`, `07800000000` and `7800000000` all return `9647800000000`. Spaces/dashes, Arabic/Persian digits, `00964`, and an extra national zero after the country code are normalized. Invalid/non-Iraqi mobile numbers are rejected before dispatch.

## API and templates

`lib/whatsapp.ts` exports `sendWhatsAppTemplateMessage(recipientPhone, templateName, languageCode, parameters)`. It uses Node fetch, Bearer authentication and a Meta `type: template` message with body text parameters and a digits-only `to`. `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are server-only; never use `VITE_` variables. Requests time out after eight seconds. Errors do not return Meta payloads, recipient numbers or access tokens.

The requested v17.0 endpoint is the default. `WHATSAPP_GRAPH_API_VERSION` can override it without changing code. **v17.0 is an old Graph API version; verify and select a currently supported WhatsApp Cloud API version in the Meta account before production activation.** Local mock tests do not establish that any version is accepted by Meta today.

Meta must approve these templates and the configured language variant (`WHATSAPP_TEMPLATE_LANGUAGE`, default `ar`) before dispatch:

- `new_job_applicant`: `مرحباً {{1}}، قدم د. {{2}} على وظيفة {{3}}.` Body values: publisher name, doctor name, job title.
- `interview_scheduled`: `مرحباً د. {{1}}، تم تحديد موعد مقابلتك في {{2}} بتاريخ {{3}} الساعة {{4}}.` Body values: applicant name, clinic name, interview date, interview time.

The requested helper signatures do not supply the greeting recipient's name. Optional parameters preserve those signatures while allowing correct personalization:

```ts
notifyPublisherWhatsAppNewApplication(phone, doctorName, jobTitle, publisherName?)
notifyApplicantWhatsAppInterviewScheduled(phone, clinicName, date, time, applicantName?)
```

The defaults are neutral Arabic greetings. A final options argument permits injecting environment/fetch for tests; normal calls read process.env. Caller-provided date/time must use the intended local timezone (Baghdad for this platform).

## Private consent and pending SQL

Review `supabase/migrations/20261102204533_whatsapp_notifications.sql` before later migration execution. It adds nullable `profiles.whatsapp_phone` and `whatsapp_opt_in boolean not null` (existing accounts initialized false; future rows default true), checks the canonical Iraqi phone format and allows a nullable phone. Sending still requires both a valid phone and an enabled flag. Profiles remains private, with RLS enabled and no public/authenticated table access. This is an unexecuted SQL draft.

`/api/whatsapp/preferences` uses bearer authentication, confirmed/non-suspended identity and server-assigned user ownership. GET returns only the caller's preferences. POST requires an actual boolean opt-in, normalizes the phone and ignores supplied user IDs. Withdrawing consent clears the stored phone and flag. Consent is independent from Auth metadata and medical verification, so opting in does not grant/revoke professional badges.

The account profile includes a separate optional consent panel. Existing accounts remain opted out in the pending SQL draft; future profiles use the requested true default. Saving preferences is still an explicit user action. If SQL has not been applied, the panel displays a configuration error and stays disabled; unrelated profile and verification features remain available.

After a successful new application insert, the publisher is resolved from job ownership and notified only if their private profile has `whatsapp_opt_in === true`. The stored recipient name/number is used, never a phone supplied by the applicant. Duplicate/conflicting applications send no new alert. A notification failure does not change the successful application response.

The interview helper is available for future scheduling code; this app has no interview scheduling transaction yet. A future caller must check the applicant's stored opt-in and read the recipient phone server-side after committing the appointment. Low-level send helpers do not themselves grant consent.

Delivery is bounded best effort, not a durable queue. An API acceptance/message ID is not proof of delivery. No automatic retry is made after ambiguous network outcomes, which can otherwise duplicate template messages. Delivery/read-status webhooks and a durable outbox are not part of this change.

## Validation

TypeScript checks now include `lib/phone.ts` and `lib/whatsapp.ts`; pinned Node type declarations are dev-only. Tests cover required phone variants, template parameter ordering, exact API payload/authentication, private preference ownership, opt-in withdrawal, safe errors, duplicate applications, opt-out suppression, and successful application persistence when notification delivery fails. Browser tests exercise all three phone forms and consent toggling using local API mocks. No production schema was inspected or altered for this local task.

## Local environment setup

The ignored `.env.local` contains phone-number ID `1356116324262684`, a token placeholder if no existing token was present, and default version/language entries. Existing real tokens are preserved. Replace `<YOUR_META_ACCESS_TOKEN>` locally with the actual Meta token before live use; placeholders are rejected before HTTP dispatch. No token value is printed or committed. The pending SQL remains unapplied, so the live schema has not been changed or verified.

## Production release update

On 2 November 2026, the notification SQL was applied to Supabase project `aqptjxmcclstxzpazbur` through the authenticated connector, with matching migration-history versions committed locally. Earlier local-only/pending statements above describe the preparation stage and are superseded by this release update. Profile data and the linking RPC remain service-role-only. Deployment does not register the Telegram webhook, approve Meta templates, create an interview scheduler, or prove live message delivery.

Notification endpoints retain their public URLs via Vercel rewrites into the existing verifications function. Handler implementations live under `server/notification-handlers/` to stay within the Hobby function limit; notification dispatch retains each handler’s independent authentication checks.
