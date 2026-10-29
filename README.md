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

Apply `supabase/migrations/202610300002_reconcile_job_offers.sql` in the Supabase SQL editor. This migration works independently for existing tables: it adds required columns, preserves rows, uses text channel-qualified `telegram_message_id` keys, backfills earlier ingestion identities, creates a unique index, and reloads the API schema. It also retains source metadata needed by the worker. Duplicate existing keys or incompatible ID types cause an atomic failure requiring manual reconciliation; the migration does not delete data. Existing RLS policies are preserved and RLS is enabled.

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

The default model is `gemini-2.5-flash`, with `gemini-1.5-flash` fallback on model-not-found (404). Both must be available to your account; code cannot restore retired or restricted models. `GEMINI_MODEL` optionally overrides the primary. Gemini receives standard `response_mime_type="application/json"` only—neither request schema parameter is sent. The expected shape is included in the system prompt and output is validated locally with Pydantic. Missing facts stay null; non-offers, candidates seeking work, missing titles, and uncertain categories are skipped. Short transient rate limits/server errors get bounded retries.

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
