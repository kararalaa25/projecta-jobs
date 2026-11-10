# Feed trust, quick apply, application stages and job freshness

Implemented in the existing React feeds and server handlers. Production activation
requires the migration and server configuration below; a frontend deploy alone
does not change the database or enable social broadcasts.

## Trust and feed behavior

- Candidate syndicate credentials use a soft-blue badge; reviewed facility
  licenses use a mint badge labelled «مركز طبي / عيادة مرخصة».
- Credential buttons expose their descriptions on focus or tap; Escape dismisses
  them. Facilities are never attributed to the Health Ministry or a syndicate
  unless the administrator actually reviewed that evidence.
- «عضوية موثقة فقط» works on the main job/candidate feed and `/talent`.
  It requires an explicitly reviewed syndicate membership or facility license,
  not merely a confirmed email, publishing permission, or submitted license.
  Local, example and Telegram-imported profiles cannot claim verification.
- The main candidate tab now includes published directory profiles and their live
  server trust summaries. Candidate timestamps use the published profile's last
  update; example profiles do not invent publication dates.
- Below 768px, jobs with valid contacts offer a labelled WhatsApp quick-apply
  link, falling back to Telegram. Both prefill the job title. The full application
  button remains available for official platform jobs. External quick apply
  opens a conversation and does not create a tracked application automatically.

## Database activation

Apply `supabase/migrations/20261110170414_job_trust_pipeline_distribution.sql`
through your normal reviewed Supabase migration process after existing migrations.
It has been exercised against disposable local PostgreSQL via PGlite, including
permissions, ownership, queue leases, expiry and renewal. It has not been applied
to production by this change.

The migration:

1. Adds `expires_at`, `renewed_at` and `archive_reason` to jobs. Existing jobs get
   30 days from their original creation date. Already-expired active jobs become
   archived; no records or applications are deleted.
2. Adds `viewed`, `shortlisted` and `archived` application statuses while retaining
   `submitted`, `reviewing`, `accepted` and `rejected` for compatibility.
3. Adds service-only RPCs for employer-owned status changes and job renewal.
4. Registers hourly archive cleanup if `pg_cron` is already installed. If it is
   absent, schedule `select public.projecta_archive_expired_jobs()` yourself.
   Public API reads and application submission enforce expiry independently.
5. Creates an RLS-enabled, service-only transactional broadcast outbox. A narrow
   helper in the private schema checks administrator-controlled Auth claims.
   Nothing grants browser users access to Auth rows, the outbox, or mutation RPCs.

Jobs expire 30 days after publication or the latest employer renewal. API reads
enforce this immediately; open feed views refresh their expiry checks each minute.
Employers can renew their own active jobs and jobs archived specifically for
expiry through **طلباتي ونشاطي → إعلاناتي**. They cannot renew moderated,
rejected or pending jobs. Renewing does not resend the original social broadcast.
The public feed falls back to a creation-date cutoff when talking to an older
schema, but renewal and pipeline actions require the migration.

## Application tracking

Employers use **إعلاناتي → عرض المتقدمين** to set:

- «تمت المشاهدة» (`viewed`)
- «مُرشَّح للقائمة القصيرة» (`shortlisted`)
- «تمت الأرشفة» (`archived`)

Opening a submitted applicant's CV also marks the application viewed. Existing
accept/reject decisions remain available. Seekers see the updated status in
**طلباتي**. Updates send the existing Supabase broadcast invalidation event;
authenticated API refetches provide the data. A 15-second refresh and focus
refresh cover missed events. Broadcasts contain no application or identity data.

`POST /api/applications` accepts either:

```json
{"action":"application.status","job_id":"UUID","application_id":"UUID","status":"shortlisted"}
```

or:

```json
{"action":"job.renew","job_id":"UUID"}
```

Both require a validated bearer token. Ownership is enforced again in the SQL
mutation; client-provided actor IDs cannot replace the authenticated account.

## Optional Telegram and WhatsApp broadcast integration

Set these server-only deployment variables:

- `TELEGRAM_JOB_WEBHOOK_URL`: HTTPS receiver for your Telegram channel adapter.
- `WHATSAPP_JOB_WEBHOOK_URL`: HTTPS receiver for your WhatsApp distribution adapter.
- `JOB_BROADCAST_WEBHOOK_SECRET`: random signing secret, at least 32 characters.
- `JOB_BROADCAST_DISPATCH_SECRET`: separate random worker secret, at least 32 characters.

Receivers are optional and independent. No messages are sent until configured.
The WhatsApp receiver must implement an available, authorized distribution method
for your account; this code does not assume Meta's ordinary messaging API can post
to arbitrary communities or groups.

A new active, unexpired manual job from a publisher with reviewed credentials
creates one outbox row per channel in the **same transaction** as publication.
The publish/admin API immediately attempts configured receivers. Failures leave
retryable events and never turn a committed publication into an error.

Configure a scheduler to call the following **POST** every minute:

```text
POST /api/platform?action=dispatch-jobs
Authorization: Bearer <JOB_BROADCAST_DISPATCH_SECRET>
```

Use your scheduler's secure header/secret storage. No new public function or
unauthenticated cron route is introduced. The worker claims up to 10 events with
`FOR UPDATE SKIP LOCKED`, a two-minute lease, exponential backoff (up to one hour)
and at most 12 attempts. Per-channel states are independent. A crashed final
attempt is marked failed on the next dispatch. Inspect `job_broadcast_outbox`
server-side for pending/failed events. Requeue a failed event after resolving the
receiver issue by setting `state='pending', attempts=0, available_at=now()` through
an administrator-controlled SQL session. Do not replay a delivered event.

Each POST includes:

- `Idempotency-Key`: stable outbox event UUID; receivers must deduplicate it.
- `X-Projecta-Timestamp`: Unix seconds.
- `X-Projecta-Signature`: `sha256=<hex HMAC-SHA256(secret, timestamp + '.' + raw_body)>`.

Verify the signature with a constant-time comparison on the original body bytes,
reject stale timestamps (for example older than five minutes), and deduplicate
before sending to a channel. Delivery is at least once; a timeout can occur after
a receiver has already sent a message. Redirects are rejected. Each receiver has
a five-second timeout and must return 2xx after safely accepting the event.

The JSON body contains `id`, `type: "job.verified.published"`, `version: 1`,
`channel`, `occurred_at`, a sanitized public `job` projection and `verification`.
No account IDs, private license documents or arbitrary internal contact metadata
are included. Current publisher credentials and job expiry are checked again at
dispatch time; revoked or expired jobs are cancelled rather than distributed.

## Verification

```sh
npm ci
npm test
npm run test:db:pipeline
npm run build
# In a separate terminal, start the local app:
npm run dev -- --port 5173
# Uses /usr/bin/chromium, or set BROWSER_EXECUTABLE to your Chromium binary:
npm run test:ui:feeds
```

Database tests use disposable PGlite PostgreSQL, never production. Browser tests
mock network responses and check mobile/desktop behavior, filters, credential
interactions, candidate dates, expiry, and RTL without sending notifications.
