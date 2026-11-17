# Post-deployment verification plan — Telegram classification release (Gate 9)

Status: **PLAN ONLY — prepared before release; not executed. No production-changing action is authorized by this document.**

Execute only after a separately approved deployment of the release commit to
`main`/Vercel production. Every step is read-only. Do **not** manually invoke
ingestion endpoints, trigger cron jobs, reset checkpoints, replay historical
messages, or insert production test jobs.

## 0. Preconditions and baseline

- Record a fresh pre-deployment baseline immediately before the approved deploy:
  active jobs, archived jobs, pending jobs, review holds, ordinary retries, broadcast
  backlog, `/api/jobs` HTTP status and `total`, cron schedules, and API error/latency.
  Historical values (active 3,089 / archived 202 / pending 0 / retries 172 / holds 0 /
  backlog 0; `/api/jobs` 200 with `total=3089`) are **not** a substitute for a fresh
  baseline.
- Capture the exact release commit SHA and the expected Vercel deployment ID.
- Have the rollback procedure in `docs/rollback-readiness.md` open and the owner's
  rollback authorization path agreed (rollback still requires a separate decision).

## 1–5. Deployment and public-surface checks

1. **Vercel deployment:** confirm Vercel reports a successful **production**
   deployment; record deployment ID, branch (`main`), and timestamp.
2. **Deployed commit:** confirm the deployed commit SHA equals the approved release
   SHA (check Vercel deployment metadata / GitHub `Vercel` status target).
3. **Website loads:** open `https://projecta-jobs.vercel.app`; confirm the home page,
   job feed, Arabic/RTL layout, and a job detail page render without client errors.
4. **`/api/jobs` responds:** `GET /api/jobs` returns HTTP 200 with a JSON body containing
   `jobs` and `total`; compare `total` to the fresh baseline (small drift from normal
   ingestion/expiry is expected).
5. **Active-only public feed:** confirm every returned row is `status='active'` and
   not expired. Spot-check `GET /api/jobs?ids=<known-pending-id>` using an authorized
   read-only query result — it must return no pending row. Confirm no pending,
   rejected, archived, or expired job is visible in search or card views.

## 6. Admin and moderation checks (authorized account only)

6. Using an authorized super-admin account, confirm `/admin` loads, session section
   returns the expected user, and `GET /api/admin?section=jobs&status=pending` shows
   the pending queue. Verify a non-super-admin cannot access it. Do not approve or
   reject production jobs as a test unless separately authorized; if a real pending
   job needs a decision, follow `docs/moderator-operations-guide.md`.

## 7–9. Ingestion and queue monitoring (read-only)

7. **Cron unchanged:** read-only query confirms `projecta-telegram-sync` is active at
   `*/5 * * * *` and `projecta-expire-jobs` is active at `0 * * * *`. No dispatch.
8. **Telegram synchronization:** observe the next scheduled runs passively; confirm
   receipts complete rather than accumulating in `retry` or `review:*`. Do not trigger.
9. **Pending jobs / review holds:** track pending count and age of the oldest pending
   row against the agreed SLA; confirm review holds are bounded and being worked by
   the confirmed moderator.

## 10–13. Reliability, compatibility, and housekeeping

10. **Retries and failures:** compare ordinary retry counts and unexpected ingestion
    failure codes to the fresh baseline; investigate sustained growth.
11. **API errors and latency:** monitor `/api/jobs` and admin endpoint error rate and
    latency; investigate 5xx spikes or material degradation.
12. **Existing data accessible:** confirm pre-existing jobs and applications remain
    readable and apply-able; no regression in job detail, application submission, or
    profile/admin views.
13. **Broadcast backlog and expiry:** confirm broadcast backlog is not growing and
    the hourly expiry job continues to archive expired rows normally. No manual run.

## 14. Baseline comparison and reporting

14. Compare all metrics in steps 7–13 against the fresh pre-deployment baseline and
    against the Go criteria below. Record observations with timestamps. Distinguish
    expected organic drift from regressions.

## 15. Rollback triggers and escalation criteria

**Roll back immediately (after owner authorization) if any of these is confirmed:**

- any non-active job is publicly visible in `/api/jobs`, search, or realtime refetch;
- non-super-admin access to the pending queue or `job.status` succeeds;
- `/api/jobs` returns sustained 5xx/503, or error rate/latency materially degrades;
- active job count collapses, ingestion stops producing active jobs, or retry/review
  holds grow without recovery;
- cron schedules differ, checkpoints reset, or messages are replayed;
- any unauthorized production data, auth, RLS, or schema change is detected.

**Escalate without immediate rollback if:** pending queue age exceeds the agreed SLA,
retry counts rise slowly but bounded, or a single non-critical UI issue appears —
include evidence and propose a decision to the owner.

**If a critical regression is detected, report the rollback recommendation
immediately.** Do not attempt an ad-hoc production fix, migration, replay, or
checkpoint reset.

## Authorized-action reminder

This plan authorizes only read-only observation and reporting. Deployment, promotion,
rollback, database changes, environment-variable changes, cron changes, ingestion
triggers, replays, checkpoint resets, and production test records all require
separate explicit owner authorization.
