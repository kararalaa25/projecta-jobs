# Production release: 1 November 2026

Target: `projecta-jobs.vercel.app`, Vercel project `projecta-jobs`, Supabase project `aqptjxmcclstxzpazbur`. Backend functions, Telegram workers, and frontend share this repository.

## Database

`20261101025209_production_directory_and_job_metadata.sql` is an additive migration. It preserves existing rows, permissions, and the live Realtime publication. It adds job source/message-group/split-index/specialty metadata and a reserved administrator-controlled publisher review flag. The write trigger derives metadata for new/updated jobs; existing rows keep their original `contact_info` representation without a bulk rewrite.

The feed table is `public.job_offers`, not a duplicate `jobs` table. It is already in `supabase_realtime` with only `id`, `source`, and `status` published. Existing frontend subscriptions on the `public:jobs` channel batch notifications and fetch sanitized cards through uncached `/api/jobs`. Notifications never directly become trusted card objects.

New `profiles`, `talent`, and `courses` tables use RLS and grant access only to the service role. CV references use ownership-enforced foreign keys to the existing private `resume_assets`; no permanent public CV URLs are created. Credential and verification fields cannot be modified from a browser. Live account badges continue to use administrator-controlled Auth metadata, so a self-written profile or Telegram text cannot verify itself.

`/api/directory?kind=talent|courses&offset=0` returns only published, sanitized directory entries, 24 per page. Talent contacts require separate consent. Account IDs, CV asset IDs, private credential evidence, internal review fields, and organizer IDs are excluded. Frontend directories reconcile every visible minute and on focus/online. Local drafts and CVs stay on their device; there is no implicit upload or automatic publication. Operators must explicitly review and publish database records. Example profiles/courses remain labeled and are never inserted into production tables.

## Telegram automation

Supabase Cron invokes the bounded Vercel `/api/telegram-sync` function every five minutes with a single-use bearer token and a database lease. Vercel ships the updated `telegram_scraper.py` and `telegram_pipeline.py` with parser version 3, Gemini multi-offer splitting, contact inheritance, stable child IDs, completeness checks, and the durable retry inbox.

`enqueue_telegram_message` uses `ON CONFLICT DO NOTHING` for receipt creation. Atomic child upserts intentionally update existing Telegram records on edited source posts; replacing them with unconditional conflict-ignore would leave stale job details. Receipt locks and deterministic IDs prevent duplicate jobs across retries or concurrent listeners.

The optional Telethon `--listen` daemon and systemd unit remain available. Vercel functions do not host a persistent MTProto daemon, and no permanent worker host is provisioned in this environment. Production uses the existing reliable five-minute scheduled fallback. WebSocket delivery is immediate after insertion; source collection has schedule and parsing latency. Failed AI extraction remains durably retryable and does not imply source collection has stopped.

## Checks

- `npm test`: 126 tests.
- `.venv/bin/python -m unittest discover -s tests -v`: 74 tests.
- `npm run build`: strict matching-helper TypeScript check and Vite build.
- `tests/sql/production_directory.sql`: rolled-back metadata, permissions, publication, and accreditation constraints.
- `tests/sql/telegram_multi_job_pipeline.sql`: rolled-back atomic splitting, deduplication, edits, stale-write rejection, failure rollback, retry recovery and service-only RPC permissions.

Supabase security advisors report informational RLS-without-public-policy entries for intentionally service-only tables, plus the pre-existing leaked-password-protection warning. This release does not change Auth password settings. The lazy PDF renderer retains its existing Vite bundle-size advisory.
