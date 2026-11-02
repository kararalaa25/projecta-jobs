# Telegram bot integration — local implementation

This repository uses Vite/React and Vercel Node API handlers, not Next.js. The runnable endpoints are `/api/telegram/link` and `/api/telegram/webhook` (`api/telegram/*.js`), and helpers are in `lib/telegram.js`. No framework migration is needed.

## Linking

`TelegramNotifyButton` appears in account profiles (applicant/clinic wording) and the publisher posting form. An authenticated, confirmed, non-suspended account requests a link via POST `/api/telegram/link`. The browser never receives a bot token or service-role key. It then presents a normal Telegram anchor, avoiding iOS popup blocking after asynchronous work.

Using `/start {userId}` directly would let anyone link someone else's account by guessing/copying their UUID. Instead, `start` carries a signed, 10-minute payload under Telegram's 64-character limit. A SHA-256 digest and expiry are stored on the private profile. The webhook validates Telegram's secret header, the payload signature/expiry, and matching sender/private-chat IDs before invoking the atomic link RPC. Raw UUID payloads and group messages are deliberately ignored. Generating a new link supersedes the old one. Do not share generated links.

The pending RPC consumes the one-time token, enforces one profile per chat, and records the Telegram update ID. A retry of that same update can retry Arabic confirmation delivery without rebinding the account. Confirmation is sent as plain text (without Markdown delimiters) so it renders cleanly and cannot interpret injected markup. `/stop` disconnects the chat and invalidates pending links.

## Pending database change — NOT executed

Review `supabase/migrations/20261102204528_telegram_bot_notifications.sql` when migration execution is authorized. It adds nullable private `telegram_chat_id` (text), token digest/expiry, and a last-update ID, plus a unique chat index and a service-role-only `SECURITY INVOKER` RPC. Existing profile RLS is retained and public/authenticated table access remains revoked. Public directory serializers do not expose these fields.

The CLI could not generate a migration in this workspace, so the reviewed SQL is supplied as a pending script rather than an invented migration-history entry. No SQL, schema migration, grants, webhook registration, environment provisioning or production deployment was executed in this task. Until the pending SQL and secrets are configured, linkage is intentionally unavailable with a clear error.

## Server configuration for a future release

- `TELEGRAM_BOT_TOKEN`: BotFather token for ProjectaJobsBot.
- `TELEGRAM_WEBHOOK_SECRET`: random secret passed as Telegram `setWebhook.secret_token` (use at least 32 URL-safe characters).
- `TELEGRAM_LINK_SECRET`: independent random signing secret of at least 32 characters.

All are server-only. Never use a `VITE_` prefix or put them in committed files. `.env.example` has empty placeholders. Future webhook registration must point Telegram to `https://projecta-jobs.vercel.app/api/telegram/webhook` with `secret_token` and `allowed_updates: ["message"]`; registration is not performed automatically by a build.

## Notifications and limits

`notifyPublisherNewApplication(publisherChatId, doctorName, jobTitle)` is wired after a successful new application insert. Existing/duplicate application conflicts do not trigger it. Recipient chat IDs are read on the server via the job's publisher ownership. Telegram delivery errors do not roll back a saved application.

`notifyApplicantInterviewScheduled(applicantChatId, clinicName, interviewDate, interviewTime)` is provided for trusted scheduling code. There is currently no interview scheduling writer in this application; it is not triggered merely by accepting or reviewing an application. Supply explicit Baghdad date/time values only after the scheduling transaction commits.

Messages use plain Arabic text, bounded names/titles, an 8-second network timeout and at most three attempts for network failures, 429 and server errors. Forbidden/blocked-bot responses are not repeatedly retried. Error messages never contain bot API URLs/tokens. Publisher alerts are currently bounded best-effort delivery, not a durable outbox; persistent failures need operational follow-up. Retried ambiguous network deliveries can duplicate messages. No guarantee of notifications for events that have no backend trigger is implied.

Local tests mock Telegram HTTP and database access; no live bot messages are sent. They cover token tampering/expiry, raw-UUID rejection, secret-header authentication, group/sender rejection, atomic RPC invocation, anonymous link denial, confirmation and plain-text helper payloads. The SQL draft is reviewed but not executed, so database constraint behavior still needs verification when migrations are authorized.

## Production release update

On 2 November 2026, the notification SQL was applied to Supabase project `aqptjxmcclstxzpazbur` through the authenticated connector, with matching migration-history versions committed locally. Earlier local-only/pending statements above describe the preparation stage and are superseded by this release update. Profile data and the linking RPC remain service-role-only. Deployment does not register the Telegram webhook, approve Meta templates, create an interview scheduler, or prove live message delivery.
