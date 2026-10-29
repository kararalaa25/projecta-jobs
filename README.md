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

The Python worker is separate from the Vite frontend and Vercel's static hosting. Run it on a trusted machine or worker with Python 3.11+, HTTPS access to Gemini/Supabase, and Telegram network access. Use only channels you are authorized to access and whose posts you are permitted to process. Raw post text and any contact details it contains are sent to Gemini and stored in Supabase; account for this when selecting sources.

1. Create a virtual environment and install dependencies:
   ```sh
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   cp .env.example .env
   ```
   If `.env` already exists, edit it rather than overwriting it. The scraper loads `.env` next to the script; exported environment variables take precedence. Vite uses its separate `VITE_` variables.
2. Apply [the job_offers migration](supabase/migrations/202610300001_job_offers.sql) to your Supabase project. It enables RLS and allows service-role ingestion only; it does not expose scraped posts publicly. If a `job_offers` table already exists, compare its schema before applying: `create table if not exists` does not migrate incompatible existing columns.
3. Obtain your Telegram API ID/hash from `my.telegram.org` and set all server-side variables in `.env`. Set `TELEGRAM_CHANNELS` to comma-separated real channel usernames (e.g. `@your_channel`) or numeric IDs; there are no invented default channels. The Telegram account must already have access, including membership for private channels. The phone number must include its country code. Set the Gemini API key and Supabase URL/service-role key securely. Never use a `VITE_` prefix for server credentials.
4. Authorize once interactively:
   ```sh
   .venv/bin/python telegram_scraper.py --login
   ```
   Telethon will request the login code and, if enabled, the account's two-factor password in the terminal. Protect the generated `.session` file as a credential. Use a private `TELEGRAM_SESSION` path if desired; its parent directory must exist. No login code or password belongs in Git or chat.
5. Validate parsing without accessing Supabase, then ingest:
   ```sh
   .venv/bin/python telegram_scraper.py --dry-run --limit 10
   .venv/bin/python telegram_scraper.py --limit 100
   ```
   Dry runs still read Telegram and call Gemini (which may incur API charges); logs show aggregate outcomes, not raw posts or secrets. Normal runs require the service-role key. Fetch size defaults to `TELEGRAM_FETCH_LIMIT=100` latest messages per channel (maximum 10,000). Increase it for backfills; this is a bounded polling worker, not a complete channel archive.

Gemini `gemini-2.5-flash` returns schema-validated JSON with the requested eight job fields plus an internal `is_job_offer` classification. Non-job posts, candidate requests, uncertain healthcare categories, and missing titles are skipped; missing details stay null. Short transient Gemini rate-limit/server errors are retried with backoff. Channel/message failures are isolated and the process exits nonzero if any failed, so a scheduler can alert or retry. Telegram flood waits are reported as retry delays; the worker does not join channels or send posts/messages.

The unique `(source_chat_id, source_message_id)` constraint prevents duplicate rows from reprocessing the same post. A SHA-256 hash skips unchanged messages before calling Gemini; edits update the same row. An existing offer edited into non-job content is removed. Identical reposts with different message IDs or from different channels remain separate source listings. Deleted source messages are not reconciled automatically. Keep the private session and `.env` outside backups/artifacts intended for public sharing.

For periodic ingestion, schedule the normal command in this repository's working directory using your worker's scheduler (e.g. cron). Avoid concurrent jobs sharing one Telethon SQLite session. Keep credentials and the session on the worker, never in frontend deployments or logs.

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Tests use mocked Telegram messages, Gemini responses, and Supabase calls; they do not contact live accounts. Actual ingestion requires your credentials, channel selection, session authorization, and applied SQL migration. The frontend still uses demo/device-local listings; reading and displaying `job_offers` requires a separate public-read/API policy and frontend integration.
