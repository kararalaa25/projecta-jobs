# Multi-job Telegram ingestion

Production uses Supabase Cron → Vercel `/api/telegram-sync` every five minutes.
Both this path and the optional persistent Telethon listener use
`telegram_pipeline.py`. Vercel requires a **server-only** `GEMINI_API_KEY`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `TELEGRAM_CHANNELS`.

Apply `supabase/migrations/20261101003445_telegram_multi_job_pipeline.sql` before
releasing this code. It adds the service-role-only `telegram_ingestion_messages`
inbox and two transaction RPCs; it does not grant browser access to raw posts.

## Extraction and publication

Gemini returns a validated `ParsedPost` containing up to 100 jobs and exact shared
context excerpts. Each job supplies an exact contiguous source excerpt, a concise
title and one canonical specialty. Different offerings with the same specialty
remain separate; a headcount for one offering does not create duplicate jobs.
An incomplete extraction is retried rather than silently dropping that offering.

Descriptions contain the individual excerpt plus explicitly shared context.
Local contacts and location take priority over shared details. The contact
extractor grounds phone, WhatsApp and Telegram values in those excerpts; it never
borrows another section's contact or invents WhatsApp availability from a phone.
Every job keeps the original message URL and original publication timestamp.
Unknown locations and schedules remain unknown. Contract/internship values map
to the marketplace's supported `locum_temp` database value, while metadata keeps
the original classification.

The first job keeps the original deterministic message UUID; subsequent jobs use
stable message/index UUIDs. `commit_telegram_jobs` locks the message receipt,
upserts all jobs and removes obsolete child IDs in **one transaction**. A group
cannot be half-published. Successful unchanged receipts skip AI and writes;
`ON CONFLICT` prevents duplicate rows across cron, retries and listener events.
Edits replace the group, including removing stale jobs when the post becomes a
non-offer. The RPC rejects stale hashes and completed duplicate commits. It
preserves existing moderation status when updating a listing.

## Recovery and processing limits

Each fetched post is durably enqueued before the source checkpoint advances.
Cron re-fetches at least 24 hours of public previews. The inbox survives Vercel
restarts and retains failures after they leave that history window. A run handles
up to 24 new messages and reserves capacity for six due retries, concurrently
processing three messages. Channel fetches have a 100-second phase budget within
the 240-second invocation deadline; a slow channel cannot consume all retry time.
Higher traffic may require raising throughput or hosting the persistent worker.

AI failures publish conservative numbered-section regex fallbacks (or a raw job
post) and leave the receipt in `retry`. Already published split groups survive
failed enrichment. Retries use exponential delay from five minutes to six hours;
there is no maximum attempt count. Database errors retry transient calls three
times; failed writes leave the inbox pending. Persistent workers additionally
re-enqueue their private local outbox instead of replaying old single-record
writes over successfully split groups.

The Telethon worker registers new-message/edit handlers before catch-up and
requests missed updates. Historical processing does not hold one global lock
against live messages; database receipt locks protect competing commits.

Public-preview collection is scheduled, not instantaneous. New posts normally
arrive within the next five-minute run plus parsing time; backlog, Telegram/CDN
availability or AI retries may add delay. The persistent listener handles live
Telegram events immediately on an MTProto-capable host. Private, deleted and
image-only text is not available to the HTTPS collector.

## Verification and monitoring

```sh
.venv/bin/python -m unittest discover -s tests -v
npm test
npm run build
```

`tests/sql/telegram_multi_job_pipeline.sql` verifies the real transaction RPCs,
deduplication, edit cleanup, stale-write rejection, rollback on a malformed child,
retry recovery and permissions. All fixtures run in a rolled-back transaction.

Inspect aggregate counts without selecting raw post text or contact data:

```sql
select state, count(*), min(posted_at), min(next_attempt_at)
from public.telegram_ingestion_messages group by state;
select last_success_at, last_error, last_summary from public.telegram_sync_control;
```

A source checkpoint means the messages were durably captured, not necessarily
fully parsed. `last_summary` reports processed messages, published jobs and retry
counts. Continue to inspect cron HTTP outcomes as described in
[realtime-pipeline.md](realtime-pipeline.md). An unchanged post timestamp is not a
sync timestamp. Realtime and `/api/jobs` keep their existing uncached sanitized
read path; short successfully parsed individual offers are no longer hidden by
the raw-message minimum-length heuristic.
