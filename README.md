# Projecta Jobs Marketplace

A responsive dental and medical careers frontend for Iraq, built with React, Vite, Tailwind CSS, Lucide icons, and Supabase Auth. Its slate background, navy navigation, teal actions, left filtering sidebar, and square white cards follow a compact professional job-search layout.

## Develop

Requires Node.js 22.19+ (validated with Node 24).

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
- Newly submitted browser listings and saved IDs persist on the current device only; the form explains this scope. The Job Offers feed separately loads active Supabase `job_offers` through `/api/jobs`. Sample job cards are no longer mixed into that feed; candidates remain clearly labeled samples until a candidate backend is connected.

The Supabase integration covers authentication and server-side reads of active marketplace job posts. Browser-created listings still need backend publishing and moderation. No secrets or backend credentials are committed.

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

The worker discovers available text-generation models using `client.aio.models.list()`, preferring Flash models over other Gemini models. Discovery excludes audio/image/embedding models. Listing does not guarantee model access: 404s advance to the next model, and a working model is reused. If listing fails or candidates fail, the requested fallback names are tried in order: `gemini-2.5-flash`, `models/gemini-2.5-flash`, `gemini-1.5-flash`, `models/gemini-1.5-flash`. Those prefixed names are retained as explicit compatibility attempts even though the service may treat them as aliases. Overall discovery/parsing is bounded to 45 seconds per post. Gemini receives standard `response_mime_type="application/json"` only—neither request schema parameter is sent. The expected shape is included in the system prompt and output is validated locally with Pydantic. Missing facts stay null. Successfully classified non-offers and candidates seeking work are skipped. Parsing exceptions, timeouts, invalid JSON, and incomplete offers produce raw fallback records only if they pass the strict job-keyword filter described below. Short transient rate limits/server errors get bounded retries.

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

Tests mock external services. Live readiness additionally requires accessible channels, an available Gemini model, and the applied database migration. Frontend job reads use the server-side `/api/jobs` endpoint described below. Candidate samples and browser-created device-local listings are separate from the ingested job feed.

### Published marketplace schema mapping

The worker checks column availability before reading posts. If the live table uses the published marketplace schema, no migration is required: parsed `city` maps to `location_city`, `salary_text` to `salary_range`, and the original post to `description`. `title` and `role_category` retain their parsed values. Explicit employment types use the table's snake_case convention (`full_time`, `part_time`, `contract`, `internship`); unknown types use the table default. Parsed offers with no known city use the raw preservation path because `location_city` is required.

`contact_info` stores JSON text containing `phone`, `telegram`, `company_name`, `source_url`, and `telegram_message_id`. This preserves extracted details without writing nonexistent columns. `source` is `telegram`. A deterministic UUID derived from channel and message ID is used as `id`, allowing upsert/deduplication on the existing primary key. `created_at`, `status`, and nullable `publisher_id` use table defaults. Unchanged raw `description` hashes skip repeated Gemini calls. The optional ingestion-specific schema remains supported as a fallback when its columns are present instead.

### Raw preservation and retry outbox

If all models fail, the full original text is stored as `title`, with no truncation. In the live marketplace table it also goes into `description` (the table has no `raw_text` column); `role_category` and `location_city` are empty strings to represent unknown values, and `contact_info` contains `parsing_status: "unparsed"` plus the source identity/URL. These records are unverified raw posts, not confirmed job offers. No employer, phone, role or city is invented. A later processing/review workflow should distinguish them using that metadata. The worker uses existing table defaults for status and schedule.

The optional ingestion-specific schema instead receives the original `raw_text` column. If that schema still enforces the original five-role check constraint, raw records may be rejected until that constraint permits unclassified records. Any database lookup/write failure queues a private, deterministic JSON record in `.telegram_outbox/` (ignored by Git, files mode 0600). The next normal run replays pending records before fetching posts, deleting each file only after successful upsert. `TELEGRAM_OUTBOX` optionally changes the directory; keep a custom path private and outside Git. Preserve this directory on persistent worker storage. Database failures still produce nonzero exit status and are never counted as successful inserts. Disk failure, inaccessible channels, or storage loss cannot be guaranteed against; back up private worker state appropriately.

Raw fallback records are deduplicated using the same source identity and text hash as parsed records. Unchanged raw records are skipped on subsequent runs; reprocessing them after model access recovers requires a deliberate backfill/reparse workflow.

The live marketplace currently also enforces `job_offers_role_category_check`, which rejects an empty role even for unparsed posts. Apply `supabase/migrations/202610300003_allow_unparsed_telegram.sql` through an authorized database connection or the Supabase SQL editor to permit explicitly unknown roles for Telegram rows. It preserves the original allowed categories and existing data. A service-role REST key alone cannot apply this DDL. Until applied, raw rows rejected by this check remain in the private outbox and the run reports failure; they are not falsely categorized to bypass the constraint.

## Live job feed on the website

`api/jobs.js` is a Vercel Node function exposing the newest 200 active `job_offers` rows. It selects marketplace fields only, filters `status=active`, and never sends the service-role key or account IDs to the browser. It honors the host's configured HTTPS proxy with TLS verification intact. Vite dev and preview register the same endpoint for local validation.

Set **runtime** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the **Vercel project** environment settings, then redeploy the latest `main`. Cloud worker environment variables are not automatically copied to Vercel. A configured browser-safe anon key is supported instead if your database grants public reads of active rows. Never prefix the service-role key with `VITE_`. Authentication still uses the separate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` build variables.

The frontend fetches `/api/jobs` on startup and on Refresh. It shows loading, unavailable, empty and retry states rather than silently replacing failed reads with sample jobs. Raw Telegram records are labeled **Unverified post**, with unspecified role/city/salary left unknown. Full Arabic text is available in a reading modal, with a validated link to the original Telegram post. No contact is invented when Gemini has not extracted one. Only records actually returned by the active-post feed appear.

Verification commands: `npm test` for feed mapping/API tests, `npm run build` for production output. The server function must be deployed alongside `dist/`; uploading only static build files will not provide `/api/jobs`.

## Job-only filtering and extracted contacts

Before parsing, Telegram posts shorter than 20 trimmed characters, or containing `كورس`, `دورة`, `ورشة`, `#بداية_النشر` (including normalized spelling variants), are rejected. If Gemini fails or returns an incomplete offer, raw fallback is allowed only when the text contains one of `مطلوب`, `وظيفة`, `تجميع`, `صيدلية`, `عيادة`, `مركز`. Successfully parsed non-offers are still skipped. Outbox replay applies these rules too. These substring rules deliberately favor the requested strict filtering and may also reject job posts mentioning training.

Regex extraction works independently of Gemini, including Arabic/Persian digits and separated Iraqi `07…` / `+964…` numbers. `contact_phone` is normalized to local `07…`; `contact_telegram` is a username; `contact_whatsapp` is the nearest number to `واتساب` or `whatsapp`, normalized as `964…`. Multiple phone numbers are handled by assigning WhatsApp to the nearest labeled number. Existing unchanged job posts are contact-enriched without repeated Gemini calls.

The live table currently supports structured contact data through JSON in `contact_info` (`phone`, `telegram`, `whatsapp`). For dedicated columns, apply `supabase/migrations/202610300004_contact_columns.sql` in the Supabase SQL editor, or configure `SUPABASE_DB_URL` securely and run:

```sh
.venv/bin/python scripts/apply_ingestion_migration.py --migration 202610300004_contact_columns.sql
```

The scraper automatically detects those columns and writes them after migration. The API supports both schemas, and the frontend reads direct columns, JSON metadata, or regex-extracted post contacts. Until the migration is applied, native-schema contacts remain in JSON rather than nonexistent columns. The older ingestion-specific schema retains its existing phone/Telegram fields.

`src/components/JobContactActions.jsx` renders Call only for a valid Iraqi number (`tel:07…`), WhatsApp for an explicit WhatsApp number or phone fallback (`https://wa.me/964…`), and Telegram only for an extracted contact username. A separate View source link opens the original post. Contacts are not invented from the source channel. Frontend filtering also hides old raw non-job/promotional rows without deleting additional database records.

The requested title cleanup (`title LIKE '%بداية%' OR title LIKE '%كورس%'`) was applied with a private backup outside the repository. Other database rows were retained. Re-running ingestion does not restore filtered posts.

## Arabic interface and verified professional publishing

The document uses `lang="ar" dir="rtl"`. Navigation, filters, forms, modals, candidate examples, contact actions and status/error messages are Arabic; original user-generated post text is preserved. Latin email addresses, phone numbers and OTPs use LTR fields. Arabic/Persian OTP digits are accepted. The login dialog offers Google OAuth with PKCE, email OTP signup/login, and Iraqi phone SMS OTP signup/login, with resend cooldowns and server-side Supabase rate limits.

Required **Supabase dashboard** configuration (not activated merely by committing code):

1. Authentication → Providers → Google: enable Google and supply its OAuth client ID/secret. Set the callback URL shown by Supabase in Google Cloud. The app adds no OTP step to Google login; Google's own account protections still apply.
2. Authentication → URL Configuration: set the production site URL and allow the local/production redirect origins. Local development uses `http://localhost:5176` in the validation commands; allow your actual dev port.
3. Authentication → Providers → Email: allow signup, require email confirmation, and use `supabase/templates/email-otp.html` for both the signup confirmation and Magic Link email templates. It contains `{{ .Token }}` so users receive the code expected by the app, instead of only a link. Configure production SMTP, OTP expiry and rate limits in Supabase.
4. Authentication → Providers → Phone: enable phone signup/login and configure a supported SMS provider with delivery to Iraq. Keep phone verification required. Provider credentials belong in Supabase, never browser code.

Publishing uses `POST /api/publish-job`. The server calls `auth.getUser(access_token)` and requires confirmed email or phone **and** `app_metadata.medical_professional_verified === true`, assigned by a trusted administrator after real professional verification. A user-supplied `user_metadata` claim does not qualify. Administrators must preserve other app metadata when assigning/revoking this claim with the Supabase Admin API. This app does not claim to verify medical qualifications automatically.

The server validates all fields, selects accepted columns, assigns ownership from the authenticated user, rejects foreign origins, and ignores user-provided owner/source/status values. Anonymous or invalid-token requests fail with 401; unapproved/unconfirmed professionals fail with 403. `/post-job` opens the same guarded form. Browser-created candidate profiles remain private device-local data, clearly labeled; public job ads are saved server-side.

Apply `supabase/migrations/202610300005_secure_job_publishing.sql` to also revoke direct table mutations from `anon` and `authenticated`, preventing REST clients from bypassing the publishing endpoint while preserving SELECT policies. The service-role key stays server-only. This migration cannot be applied using a service-role REST key alone; use the SQL editor or a configured PostgreSQL connection. The API guard works independently, but direct-table write restrictions are not claimed until this SQL is applied.

At implementation-time the public auth settings showed email signup/confirmation enabled, Google/phone disabled. No management API credential was available, so provider activation, SMTP/SMS configuration, email template changes and SQL application require a project administrator. Browser auth-flow tests mock message delivery and never send real email/SMS.

## Nationwide governorates, professional roles, and two-week history

`config/iraq.json` is the shared catalog of the requested 18-governorate baseline and five roles. Capital/city aliases are grouped under their governorate: Hillah → Babylon, Mosul → Nineveh, Kut → Wasit, Nasiriyah → Dhi Qar, Amarah → Maysan, Diwaniyah → Al-Qadisiyyah, Samawah → Al-Muthanna. Unknown locations stay unknown. Explicit location labels take priority; multi-location and multi-role posts retain arrays in `contact_info`. The UI can match every associated role/governorate, not just the primary one. Assistant phrases are consumed before dentist matching, and pharmacy receptionists/scientific-rep qualifications are distinguished from pharmacist vacancies.

Canonical roles: `Dentists`, `Pharmacists`, `Assistants & Techs`, `Medical Reps`, `Receptionists / Admin`. Older assistant/lab/receptionist values map to these groups. The five roles are also used by Gemini's schema/prompt and the publishing form/server. Apply migration 006 to allow all canonical values in an older database CHECK constraint. Until then, a CHECK-specific compatibility retry keeps the exact inferred role in contact JSON and writes an empty physical role value rather than a false medical category. The frontend reads that canonical metadata. The live table's governorate is stored in `location_city`; the ingestion-specific table uses `city`.

The current seven user-provided sources are documented in `config/telegram_channels.json`. Empty per-channel governorate lists explicitly mean unverified regional coverage. Runtime `TELEGRAM_CHANNELS` remains authoritative. Per user instruction these current channels are used temporarily; no invented regional usernames are added and nationwide channel coverage is not asserted solely because all 18 filters exist.

```sh
# Complete accessible public text history in the last 14 days, without a count cap:
.venv/bin/python telegram_scraper.py --days 14 --parser regex
```

History mode follows Telegram's public HTTPS `before` cursor until the date cutoff, while authenticated Telethon can iterate to that same cutoff. It rejects simultaneous `--days`/`--limit` arguments. A stalled cursor or exhausted `--max-pages` budget is an explicit failure, not a successful partial archive. Public previews cannot expose private/deleted/protected posts or media text; they are not a substitute for an authenticated full Telegram archive.

`--parser regex` avoids Gemini charges/timeouts for large backfills, writes batches of 100 using deterministic source IDs, and leaves uncertain details unclassified. `--parser hybrid` uses local classification when sufficient and Gemini for ambiguity; `--parser gemini` always attempts Gemini. Reports in ignored `.telegram_history/last-run.json` record the time window, per-channel outcomes, failures and observed governorate counts. Counts describe actual detected locations, not promised geographic coverage.

Source post timestamps are retained for ordering. The public feed uses offset pagination in pages of 200, so older governorates/categories are not hidden behind the previous fixed 200-row feed limit. Empty combinations display an Arabic empty state rather than sample job offers.
