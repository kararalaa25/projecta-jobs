# Projecta Jobs Marketplace

A responsive dental and medical careers frontend for Iraq, built with React, Vite, Tailwind CSS, Lucide icons, and Supabase Auth. Its slate background, navy navigation, teal actions, left filtering sidebar, and square white cards follow a compact professional job-search layout.

## Develop

Requires Node.js 20.19+ or 22.12+ (validated with Node 24).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`npm run build` produces `dist/`; `npm run preview` serves the production build.

## Authentication

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using your Supabase project URL and public anonymous key. Never use a service role key in the browser. Restart Vite after changing these values.

In the Supabase dashboard, enable Google under Authentication → Providers and configure its OAuth credentials. Add your app origin to Authentication → URL Configuration → Site URL and the redirect allowlist (for local development, `http://localhost:5173`). Configure the provider's authorized callback URL as instructed by Supabase. Create an email/password user in Supabase to use the email sign-in form; this application does not include a registration flow.

Without these variables, the frontend works in demo mode and the sign-in modal explains the missing configuration. Real authentication requires your Supabase project and provider setup.

## Listings and interactions

- Search by title, organization/name, or description; filter by healthcare role, Iraqi city, schedule, and minimum monthly salary. Both listing tabs preserve the filters.
- Switch between job openings and candidates, save listings, and revisit saved listings in either tab.
- Create a listing with an international phone number to enable direct WhatsApp and phone actions; add an optional Telegram username for Telegram contact.
- Demo listings do not contain fabricated phone numbers and are explicitly identified as samples.
- Created listings and saved IDs persist in localStorage on the current browser/device. Listings are **not publicly published**, synced to Supabase, or shared across devices. The post form explicitly explains this scope.

The Supabase integration covers authentication. A public marketplace will additionally need a listings database, access policies, moderation, and backend persistence. No secrets or backend credentials are committed.

## Deploy to Vercel

Import `kararalaa25/projecta-jobs` in Vercel and select the `main` branch. The committed `vercel.json` selects Vite, runs `npm run build`, and publishes `dist/` with an SPA fallback.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment settings before deploying if authentication is required. Without them, the marketplace runs in demo mode. After deployment, add the production origin to the Supabase site URL and redirect allowlist. Listings remain device-local until backend persistence is implemented.

## Telegram → Gemini → Supabase ingestion

The Python worker runs separately from Vite/Vercel static hosting. It requires Python 3.11+ and HTTPS access to Telegram public previews, Gemini and Supabase. Process only channels you may access and whose posts you may process: post text and contact details are sent to Gemini and stored in Supabase.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# Create .env from .env.example only if you do not already have one.
```

Set credentials securely in `.env` or environment settings. Exported variables override `.env`. Never put the service-role key, Telegram credentials, session files or a database connection URL in frontend `VITE_` variables or Git.

### Database migration

The published marketplace schema is supported directly without a migration (see the mapping below). If using the separate ingestion-specific schema, apply `supabase/migrations/202610300002_reconcile_job_offers.sql` in the Supabase SQL editor. This migration works independently for existing tables: it adds required columns, preserves rows, uses text channel-qualified `telegram_message_id` keys, backfills earlier ingestion identities, creates a unique index, and reloads the API schema. It also retains source metadata needed by the worker. Duplicate existing keys or incompatible ID types cause an atomic failure requiring manual reconciliation; the migration does not delete data. Existing RLS policies are preserved and RLS is enabled.

Alternatively, configure the PostgreSQL connection string `SUPABASE_DB_URL` securely and run:

```sh
.venv/bin/python scripts/apply_ingestion_migration.py
```

The helper verifies TLS certificates and hostnames. It requires actual database credentials and a permitted PostgreSQL network route. The service-role REST key cannot execute arbitrary SQL or create an SQL RPC; no such RPC is assumed. Migration 001 is the original fresh-table schema; use migration 002 to reconcile an existing table even if 001 cannot run on it.

### Telegram transport and sessions

Set `TELEGRAM_CHANNELS` to comma-separated public usernames, `@usernames`, `https://t.me/usernames` URLs, or numeric channel IDs (numeric IDs require authenticated Telethon access).

- `TELEGRAM_TRANSPORT=auto` (default) tries a bounded direct MTProto connection. If unavailable or unauthenticated, it reads public `https://t.me/s/<channel>` previews over the inherited HTTPS proxy.
- `TELEGRAM_TRANSPORT=https` skips Telethon entirely. Public previews need neither a phone login nor a Telegram session. They cannot read private channels, protected/unavailable previews, media-only content or content not exposed by Telegram. Empty/unreadable previews fail visibly. Fetches are bounded and paginate older public text posts.
- `TELEGRAM_TRANSPORT=telethon` requires a reachable Telegram socket and authorized session; it never silently falls back. `HTTP_PROXY` does not tunnel MTProto traffic. For this mode, authorize once from a machine with Telegram connectivity:
  ```sh
  .venv/bin/python telegram_scraper.py --login
  ```
  Enter the code and any two-factor password privately in the terminal. Session parent directories are created and session files get owner-only permissions. Do not run concurrent workers sharing the same SQLite session.

HTTPS fallback uses only Telegram's public website and does not join channels or impersonate the user's session. The worker does not send channel posts or user messages.

### Gemini parsing and running

The worker discovers available text-generation models using `client.aio.models.list()`, preferring Flash models over other Gemini models. Discovery excludes audio/image/embedding models. Listing does not guarantee model access: 404s advance to the next model, and a working model is reused. If listing fails or candidates fail, the requested fallback names are tried in order: `gemini-2.5-flash`, `models/gemini-2.5-flash`, `gemini-1.5-flash`, `models/gemini-1.5-flash`. Those prefixed names are retained as explicit compatibility attempts even though the service may treat them as aliases. Overall discovery/parsing is bounded to 45 seconds per post. Gemini receives standard `response_mime_type="application/json"` only—neither request schema parameter is sent. The expected shape is included in the system prompt and output is validated locally with Pydantic. Missing facts stay null. Successfully classified non-offers and candidates seeking work are skipped. Parsing exceptions, timeouts, invalid JSON, and incomplete job offers produce raw fallback records instead of terminating ingestion. Short transient rate limits/server errors get bounded retries.

```sh
# Reads Telegram and calls Gemini (may incur API charges), never accesses Supabase:
.venv/bin/python telegram_scraper.py --dry-run --limit 1
# Actual ingestion:
.venv/bin/python telegram_scraper.py --limit 100
```

`TELEGRAM_FETCH_LIMIT` defaults to 100 newest messages per channel (maximum 10,000). This is a bounded polling worker, not a full channel archive. Schedule it on a trusted worker; Vercel static hosting does not run it.

`telegram_message_id` is `channel_username:message_id` (or `chat_id:message_id` for private channels). This prevents collisions between channels and deduplicates public HTTPS/Telethon runs. SHA-256 hashes skip unchanged posts before Gemini; edits update the row. Renaming a public channel changes its canonical namespace; reconcile earlier rows if that occurs. An offer edited into non-job content is removed. Deleted Telegram posts are not reconciled; reposts with different IDs remain separate source listings. Logs show outcome counts/error types and codes, not raw posts or secrets. Failures produce a nonzero exit status.

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Tests mock external services. Live readiness additionally requires accessible channels, an available Gemini model, and the applied database migration. Frontend listing reads are still demo/device-local; public display of ingested rows requires a separately designed read policy and frontend integration.

### Published marketplace schema mapping

The worker checks column availability before reading posts. If the live table uses the published marketplace schema, no migration is required: parsed `city` maps to `location_city`, `salary_text` to `salary_range`, and the original post to `description`. `title` and `role_category` retain their parsed values. Explicit employment types use the table's snake_case convention (`full_time`, `part_time`, `contract`, `internship`); unknown types use the table default. Parsed offers with no known city use the raw preservation path because `location_city` is required.

`contact_info` stores JSON text containing `phone`, `telegram`, `company_name`, `source_url`, and `telegram_message_id`. This preserves extracted details without writing nonexistent columns. `source` is `telegram`. A deterministic UUID derived from channel and message ID is used as `id`, allowing upsert/deduplication on the existing primary key. `created_at`, `status`, and nullable `publisher_id` use table defaults. Unchanged raw `description` hashes skip repeated Gemini calls. The optional ingestion-specific schema remains supported as a fallback when its columns are present instead.

### Raw preservation and retry outbox

If all models fail, the full original text is stored as `title`, with no truncation. In the live marketplace table it also goes into `description` (the table has no `raw_text` column); `role_category` and `location_city` are empty strings to represent unknown values, and `contact_info` contains `parsing_status: "unparsed"` plus the source identity/URL. These records are unverified raw posts, not confirmed job offers. No employer, phone, role or city is invented. A later processing/review workflow should distinguish them using that metadata. The worker uses existing table defaults for status and schedule.

The optional ingestion-specific schema instead receives the original `raw_text` column. If that schema still enforces the original five-role check constraint, raw records may be rejected until that constraint permits unclassified records. Any database lookup/write failure queues a private, deterministic JSON record in `.telegram_outbox/` (ignored by Git, files mode 0600). The next normal run replays pending records before fetching posts, deleting each file only after successful upsert. `TELEGRAM_OUTBOX` optionally changes the directory; keep a custom path private and outside Git. Preserve this directory on persistent worker storage. Database failures still produce nonzero exit status and are never counted as successful inserts. Disk failure, inaccessible channels, or storage loss cannot be guaranteed against; back up private worker state appropriately.

Raw fallback records are deduplicated using the same source identity and text hash as parsed records. Unchanged raw records are skipped on subsequent runs; reprocessing them after model access recovers requires a deliberate backfill/reparse workflow.

The live marketplace currently also enforces `job_offers_role_category_check`, which rejects an empty role even for unparsed posts. Apply `supabase/migrations/202610300003_allow_unparsed_telegram.sql` through an authorized database connection or the Supabase SQL editor to permit explicitly unknown roles for Telegram rows. It preserves the original allowed categories and existing data. A service-role REST key alone cannot apply this DDL. Until applied, raw rows rejected by this check remain in the private outbox and the run reports failure; they are not falsely categorized to bypass the constraint.
