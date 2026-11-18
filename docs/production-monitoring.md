# Production monitoring and alerting

Status: **IMPLEMENTED IN CODE — NOT ACTIVE IN PRODUCTION**

The code detects operational failures and can deliver email alerts through Resend.
It is inert until the documented environment variables are configured and a real
end-to-end delivery test confirms that both administrators receive an alert.

No production environment variable, Vercel setting, Supabase schema, cron schedule,
Telegram checkpoint, or deployment was changed by this work.

---

## 1. Signals inspected

Existing sources were reused unchanged:

| Source | Signal used |
| --- | --- |
| `public.telegram_sync_control` | `last_success_at` heartbeat, `last_error`, `last_summary.error`, `lease_until` |
| `public.telegram_ingestion_messages` | retry count, `attempts`, `error_type`, `next_attempt_at` |
| `public.telegram_sync_checkpoints` | `counts.newest_source_post_at` (informational only — never an alert trigger) |
| `public.job_offers` | pending count; `created_at` is source-post date and is **not** used as queue age |
| `public.telegram_ingestion_messages` | oldest `review:*` hold `updated_at` for moderation SLA |
| `server/backend-errors.js` | bounded error categories (`configuration`, `schema`, `permissions`, `connection`, etc.) |
| Supabase `cron.job_run_details` | inspected during readiness checks; the endpoint does not depend on it |

**Idle channel vs broken pipeline:** a channel with no new posts is healthy when the
sync heartbeat is current, no error is recorded, retries are not stuck, and the
moderation queue is within SLA. Missing new posts alone never produces an alert.
`newest_source_post_at` is returned for context only.

## 2. Alert catalog

| Code | Severity | Condition | Cooldown | Action in alert |
| --- | --- | --- | --- | --- |
| `database_error` | critical | Sync error classified as database/schema/permissions/connection | 30 min | Check service-role access and schema; do not replay or reset checkpoints |
| `ingestion_error` | warning | Other sync error (e.g. `channel_failure`, `fetch_timeout`) | 30 min | Inspect scheduled run and generic category; do not replay or reset checkpoints |
| `ingestion_stalled` | warning | No successful heartbeat for 45 min and no active lease | 30 min | Confirm `projecta-telegram-sync` is active and completing; new posts are not required |
| `classification_retry_storm` | warning | At least 3 non-review retries with `attempts >= 3` | 30 min | Check Gemini availability, quota and model configuration |
| `retry_backlog` | warning | At least 50 non-review rows in `retry` state | 30 min | Inspect retry queue and write path; avoid manual replay |
| `moderation_backlog` | warning | At least 10 pending jobs or oldest review hold older than 24 h | 30 min | Assign reviewer and clear `/admin/jobs?status=pending` |
| `monitoring_check_failed` | critical | The monitoring query itself failed | 30 min | Verify Supabase connectivity and function configuration |

`review:*` rows are moderation holds, not classifier failures, and are excluded from
both the retry-storm and retry-backlog signals. Moderation age uses the hold record's
`updated_at`, because `job_offers.created_at` is the original Telegram post date.
Recovery notices are sent once, 5 minutes after a condition clears. Cooldown state
advances only after the provider confirms delivery, so a rejected send is retried on
the next invocation. Every condition, including a failed monitoring check, uses the
same deduplication path. A failed check explicitly skips the recovery pass, so an
outage can never fabricate an "all clear" for unrelated alerts that could not be
evaluated.

## 3. Provider setup required (not performed)

Alerts use the Resend REST API directly with `fetch`; no npm dependency was added.

1. Create a Resend account and verify the sending domain used by `ALERT_FROM_EMAIL`.
2. Create an API key scoped to sending email.
3. Set these Vercel **Production** environment variables (values are never committed):
   - `RESEND_API_KEY` — Resend sending key.
   - `ALERT_FROM_EMAIL` — verified sender, e.g. `alerts@your-verified-domain`.
   - `MONITORING_SECRET` — random bearer token for the cron endpoint.
   - Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are also required.
4. Invoke `POST /api/monitoring` with `Authorization: Bearer $MONITORING_SECRET`
   every 5 minutes using an external scheduler or Vercel Cron. **Do not modify the
   existing Supabase `projecta-telegram-sync` or `projecta-expire-jobs` schedules.**
5. Send a real test alert and confirm delivery to both addresses in
   `config/access.js` (`OWNER_EMAILS`). Until that confirmation exists, monitoring
   is **not active**.

Recipients are read only from `config/access.js`; they are not configurable via
request input. If either the API key or sender is missing, the endpoint returns
`503` and sends nothing (fail closed).

## 4. Privacy and security properties

- Alert bodies contain only allowlisted labels, generic categories, integer counts,
  timestamps and fixed remediation text. No raw error strings, job titles, message
  text, channel names, phone numbers or API keys are interpolated.
- The API key is sent only in the `Authorization` header; it is never logged or
  placed in the email body.
- A deterministic `Idempotency-Key` is sent on every delivery, including a
  per-condition generation counter so a real re-alert after recovery is not deduped
  away. Confirm provider idempotency behaviour during setup; in-process cooldown
  state resets on serverless cold starts, so provider-side dedupe is the
  cross-invocation safeguard.
- The endpoint requires a bearer secret and supports only `GET`/`POST`.
- Database access is read-only; there is no schema migration, replay, checkpoint
  reset, ingestion trigger, or privilege change.

## 5. Verification performed

- `tests/monitoring.test.js`: 15 tests, all passing, covering idle-channel no-op,
  ingestion failure sanitization, stale heartbeat, retry storm, moderation backlog,
  cooldown, delayed recovery, provider payload/recipients, fail-closed configuration,
  endpoint authorization, read-only snapshot, check-failure deduplication, no false
  recovery notices during an evaluation outage, failed delivery retry, and a local
  end-to-end handler → provider delivery test asserting both administrator addresses
  receive the alert.
- The end-to-end test uses a **local stub provider**; it proves the application
  delivery path but **does not prove real Resend delivery**. Real delivery must be
  confirmed after the provider and environment variables are configured.

## 6. Known limitations

- Cooldown/recovery state is in-memory and does not survive cold starts; provider
  idempotency plus the fixed cooldown window limit duplicates in practice.
- Repeated Gemini failures are inferred from durable inbox retry rows and exception
  class names, not from provider logs.
- The endpoint does not read Vercel runtime logs or `cron.job_run_details`; those
  remain manual dashboard checks until log-access credentials are available.
