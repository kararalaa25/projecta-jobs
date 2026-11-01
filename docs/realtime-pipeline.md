# Telegram ingestion and live job delivery

Implemented 1 November 2026 (Asia/Baghdad). The authoritative table is
`public.job_offers`; `public:jobs` is the client channel name, not a new jobs table.

## Deployed ingestion fallback

The Vercel project is on Hobby, whose native cron frequency is insufficient for
five-minute ingestion. Supabase Cron therefore dispatches the existing Vercel
Python function `/api/telegram-sync` every five minutes using `pg_net`. Production
needs only its existing Supabase server credentials and `TELEGRAM_CHANNELS`.

`private.dispatch_telegram_sync()` creates a short-lived, single-use bearer token.
Only its SHA-256 hash is stored in a private table. The service-role-only
`claim_telegram_sync` RPC consumes the token and acquires a six-minute database
lease. Unauthenticated requests cannot invoke ingestion; overlapping invocations
return 409. No browser or public RPC can mint tokens. Responses and logs contain
aggregate counts/error types, never credentials or source post text.

`telegram_sync.py` fetches complete public text history since each channel's last
successful checkpoint, with a one-hour overlap and at least 24 hours of lookback
to recover delayed public previews and reconcile recent edits. Initial
catch-up covers three days. Three channels run concurrently, with bounded retries
and a 240-second invocation deadline. An incomplete fetch, write failure, or
exhausted history budget does not advance that channel's checkpoint. Successful
channels retain their progress even if a different channel fails. This durable
checkpoint is the serverless retry mechanism; it does not depend on `/tmp`.

Stable channel/message UUIDs enforce database deduplication. New rows use
`ON CONFLICT DO NOTHING`; changed source text updates the existing row, and
unchanged source text does not rewrite moderated metadata or emit redundant events.
The scheduled path uses deterministic regex classification and explicitly raw
fallbacks, without a Gemini credential or model calls.

## Persistent listener alternative

On an existing persistent, MTProto-capable host:

```sh
.venv/bin/python telegram_scraper.py --login
.venv/bin/python telegram_scraper.py --listen --parser hybrid
```

Authorize interactively only once. Keep `.env`, the Telethon session and
`TELEGRAM_OUTBOX` private on persistent storage. An optional systemd user service
is provided at `deploy/projecta-telegram-worker.service`; adjust its repository
path before installation. No persistent worker host was provisioned by this
release. The deployed ingestion mode is the five-minute scheduled fallback.

The listener registers `events.NewMessage` and `events.MessageEdited` before
catch-up. Writes are serialized, retried, and retain the existing durable local
outbox. Periodic checkpoint-based history catch-up and supervised restarts cover
connection interruptions. The same canonical IDs allow it to coexist with the
fallback without duplicate rows.

## Browser delivery

`job_offers` is in `supabase_realtime`, with a publication column list restricted
to `id`, `source`, and `status`. The channel subscribes to INSERT/UPDATE/DELETE;
the socket is an identity notification, not a raw public card. It never broadcasts
`publisher_id`, contact metadata, or internal fields.

Notifications are batched over 100 ms and fetch at most 100 IDs through the same
`publicJobOffer` sanitizer as ordinary listing requests. Changed cards prepend by
ID; removed/hidden records disappear. A version check prevents a stale response
from resurrecting a deleted card, and snapshot reconciliation prevents a late
initial load from overwriting a socket update. Existing filters and counts derive
from the updated client state.

All `/api/jobs` responses explicitly disable browser/shared/CDN caching. The
client reconnects through Supabase, reconciles on subscribe/focus/online, and
performs a visible-tab reconciliation every minute. This also removes rows whose
new inactive status prevents an RLS-protected UPDATE from being delivered.
Unmount aborts in-flight requests and removes the channel, timers and listeners.

WebSocket delivery is immediate after database insertion. Scheduled Telegram
collection has up to roughly five minutes of schedule latency, plus processing
and platform delays; second-level source ingestion requires hosting the optional
persistent listener.

## Operation and verification

Inspect `cron.job` for `projecta-telegram-sync` and `cron.job_run_details` for
scheduler outcomes. The dispatcher being successful means the HTTP call was
queued; inspect `net._http_response` status/error and `telegram_sync_control`
for the actual ingestion outcome. Channel freshness/counts are retained in
`telegram_sync_checkpoints`. All of these ingestion tables deny browser access.
Never print request headers or token-bearing pg_net queue rows.

The scheduling migration creates the cron job inactive so an undeployed endpoint
cannot consume jobs. Activate only after deployment verification:

```sql
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname='projecta-telegram-sync'),
  active := true
);
```

To pause, use the same call with `active := false`. To request a checked immediate
run, execute `select private.dispatch_telegram_sync();` as the database operator.

Validation: clean Vite build; 71 Node tests and 47 Python tests; real anonymous
WebSocket subscription; real Telegram ingestion to Supabase to browser. In the
browser test eight genuine INSERTs raised the visible count from 874 to 882,
without page reload, through one batched sanitized API read. All event payloads
contained only the publication's permitted identity/status columns. No synthetic
public job listings were created for verification.

Production verification completed with HTTP 200 from the authenticated scheduled
endpoint: all seven channels completed and 131 genuine listings were inserted,
with no ingestion errors. The production browser received identity-only INSERT
events and updated its count without reloading. The five-minute cron is active;
all seven channels have durable checkpoints. The worker normalizes Supabase API
URLs and uses synchronous SDK options with a bounded 20-second RPC timeout.

## Freshness visibility and late previews

The public `/api/telegram-status` endpoint exposes only the last successful check,
the five-minute interval and a normalized health state. It never publishes lease
owners, internal errors, tokens or per-channel metadata. The Telegram section
refreshes this status automatically every minute and on focus/online. Job cards
explicitly label their original publication time, separate from ingestion status.

Scheduled HTTPS requests use no-cache headers and a polling-window query parameter.
Every run revisits at least the previous 24 hours, even with a recent checkpoint,
so delayed preview content does not fall permanently behind a moving one-hour
window. Deduplication prevents old posts from being republished as new. Private
checkpoint diagnostics retain fetched counts and the newest observed text-post time.

A November 1 check confirmed that cron requests were succeeding every five minutes
for all seven channels. Newer public entries included promotional/image-only posts;
an old job publication timestamp did not mean that sync itself had stopped.
