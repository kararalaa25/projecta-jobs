# Rollback readiness — Telegram classification release (Gate 7C)

Status: **PREPARED — not executed. Vercel dashboard confirmation of the live production deployment is still required.**

Application rollback is designed to require **no database migration rollback and no
Telegram replay**. This document records the evidence, the exact procedure, and the
remaining verification the owner must perform with Vercel access.

## 1. Deployment identifiers (read-only evidence, 2026-11-18)

| Item | Value / evidence |
| --- | --- |
| Production site | `https://projecta-jobs.vercel.app` |
| Hosting | Vercel; GitHub default branch `main` |
| Current `origin/main` | `709fd9ad9e9c923c817ad2147f436ee017fa896c` |
| GitHub status for `origin/main` | `Vercel` = success, target deployment `8biP7jM5EpBQ68Q8jg8d6reryMBQ` |
| Feature HEAD at Gate 4 | `e36269d5577200a709e36339c1eceddec17cec88` |
| Feature preview check | `Vercel Preview Comments` success; preview `https://projecta-jobs-git-fe-a0ea6f-kararalkhafaji20-gmailcoms-projects.vercel.app`, deployment `EsKHyVqF6DZWiVw4GBB8bVJjsjKQ` |
| GitHub Deployments API | returned 0 records (Vercel does not populate it for this repo) |
| Vercel CLI auth | **logged out** — no `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` available |

**Limitation:** the GitHub status URL identifies the Vercel deployment associated with
`origin/main`, but the exact *live* production deployment cannot be confirmed without
authenticated Vercel access. Owner must confirm in the Vercel dashboard that
deployment `8biP7jM5EpBQ68Q8jg8d6reryMBQ` (commit `709fd9ad…`) is the current
production deployment, that it is retained, and that it can be promoted again. Do not
infer this from the missing API data.

## 2. Why a normal app rollback is database-safe

Evidence gathered from the repository and read-only production checks:

- **Migration `20261117000000` is purely additive** — it creates the 8-argument
  `commit_telegram_jobs_initial_status` function only. Verified locally against a
  production-shaped schema (`docs/option-b-production-verification.md`, §5).
- **The legacy 7-argument `commit_telegram_jobs` is byte-identical** to the previous
  version (`ORIGINAL_RPC_BYTE_IDENTICAL` in local rehearsal) and still exists in
  production with fingerprint `baa97bc9a27415d56cd74d72e5b71522`, `SECURITY INVOKER`,
  `search_path=""`, `service_role` only.
- **Old application code uses only the 7-argument RPC.** `git show origin/main:telegram_pipeline.py`
  calls `commit_telegram_jobs` and has no `initial_status` argument, so rolled-back
  ingestion continues publishing active jobs normally.
- **Old public API already filters to active jobs.** `git show origin/main:api/jobs.js`
  contains `.eq('status','active')`. Pending jobs created after deployment therefore
  remain invisible to older code; no accidental exposure on rollback.
- **No table rewrite, no data backfill, no grant/RLS change, and no cron change** was
  part of this feature. The public feed, authorization, and cron schedules are
  unchanged from `main`.
- **No migration rollback is required.** The 8-argument function may be left installed
  harmlessly; removing it is an optional, separately authorized cleanup.

## 3. Exact rollback procedure (owner-authorized only)

1. In Vercel Dashboard → Project `projecta-jobs` → **Deployments**, confirm the last
   successful production deployment before this release (expected:
   `8biP7jM5EpBQ68Q8jg8d6reryMBQ` / commit `709fd9ad…`) is retained and accessible.
2. Open that deployment → **⋯** → **Promote to Production** (Vercel's supported
   rollback/promote workflow). Do not re-run a build from a different commit.
3. Wait for Vercel to report the promotion as successful and note the new deployment ID.
4. Verify `https://projecta-jobs.vercel.app` loads and `/api/jobs` returns HTTP 200.
5. Confirm cron jobs are unchanged and still active:
   `projecta-telegram-sync` `*/5 * * * *`, `projecta-expire-jobs` `0 * * * *`.
6. Confirm the public feed is active-only and pending jobs are not visible.
7. Confirm ingestion resumed through the legacy 7-argument RPC without replaying
   messages or resetting checkpoints.
8. Record the rollback time, deployment ID, and observed metrics in the incident log.

**Do not:** run `supabase db push`, `db reset`, migration repair, drop
`commit_telegram_jobs`, drop `job_offers.status`, change RLS/grants, modify cron,
trigger ingestion, replay historical messages, or reset checkpoints as part of an
application rollback.

Optional database cleanup (only with separate explicit authorization, after a
successful app rollback and a retention period):

```sql
drop function if exists
  public.commit_telegram_jobs_initial_status(text,text,jsonb,integer,boolean,text,uuid,text);
```

Never drop the 7-argument `commit_telegram_jobs`.

## 4. Rollback triggers (summary — full criteria in `docs/post-deployment-verification.md`)

Roll back immediately if any of the following is confirmed after deployment:

- pending, rejected, archived, or expired jobs appear in the public feed or search;
- unauthorized users can access the admin pending queue or `job.status` action;
- `/api/jobs` returns sustained 5xx/503 or materially elevated errors/latency;
- active job counts collapse or ingestion stops producing active jobs;
- cron schedules change, checkpoints reset, or unexpected message replay occurs;
- any production data/auth/RLS change is detected that was not part of the approved release.

## 5. Remaining owner actions

- Confirm Vercel production deployment identity and retention (blocker).
- Confirm Vercel access/permissions to promote a previous deployment (blocker).
- Confirm the retained deployment is reachable and healthy before release.
- Do not perform a rollback unless separately authorized.
