# Projecta Jobs — Gates 4–9 consolidated release report

Date: 2026-11-18
Branch: `feat/option-b-telegram-classification`
Base commit verified: `e36269d5577200a709e36339c1eceddec17cec88`
Production project: `aqptjxmcclstxzpazbur` (reference only — no credentials handled)

---

## A. Gate results

| Gate | Status | Summary |
| --- | --- | --- |
| 4 — Revalidate production readiness | **BLOCKED (partial)** | Git, branch relationship, implementation presence, both RPC fingerprints/permissions, migration history, cron, preview deployments and GitHub checks all verified read-only. Two items could not be completed without authenticated Vercel access: exact *live* production deployment identity/branch and environment-variable names/presence. |
| 5 — CI and security blockers | **FAIL** | 5A PASS (migration test path corrected). 5B FAIL — 4 high npm advisories with no published compatible fix. 5C all functional checks PASS; `npm audit --audit-level=high` FAIL (same advisory). |
| 6 — Classification/moderation regression | **PASS** | All 18 required scenarios mapped to passing synthetic tests; 3 new tests closed the remaining gaps. Full details: `docs/classification-regression-report.md`. |
| 7 — Release preparation | **BLOCKED** | 7A diff reviewed, no secrets/migrations found; push held pending owner security-exception decision. 7B moderator assignment/SLA unconfirmed. 7C rollback procedure prepared; Vercel retention/promotion confirmation outstanding. |
| 8 — Production release approval | **STOPPED AS INSTRUCTED** | Owner approval requested. Recommendation below is **NO-GO** until blockers are resolved. |
| 9 — Post-deployment verification plan | **PASS (plan only)** | Complete read-only procedure prepared in `docs/post-deployment-verification.md`; not executed. |

---

## B. Code changes

| File | Reason |
| --- | --- |
| `tests/integration/job-pipeline.mjs` | Corrected stale migration filename `20261110170414_…` → `20261110223752_job_trust_pipeline_distribution.sql` (Gate 5A). No shim; test now reads the real migration. |
| `tests/test_telegram_pipeline.py` | Added 2 synthetic tests: clean single job uses the legacy active-commit path (no `initial_status`), and a non-mixed ambiguous announcement routes to `pending`. |
| `tests/moderation.test.js` (new) | 3 tests: non-super-admin cannot access the pending queue with zero DB calls; pending/rejected rows never reach `/api/jobs`; the real `action:'job.status'` handler approves a pending job into the public feed, rejects it back out, and rejects invalid statuses with 400. |
| `docs/classification-regression-report.md` (new) | Gate 6 18-scenario matrix and exact test evidence. |
| `docs/moderator-operations-guide.md` (new) | Gate 7B procedures, escalation rules, and proposed SLA. Explicitly states no moderator is assigned/covered. |
| `docs/rollback-readiness.md` (new) | Gate 7C evidence, exact Vercel promote procedure, DB-compatibility rationale, and triggers. |
| `docs/post-deployment-verification.md` (new) | Gate 9 read-only 15-step verification plan and rollback/escalation criteria. |
| `docs/security-release-review.md` (new) | Gate 7A security review: advisory IDs, dependency paths, dev/build vs runtime exposure, investigated fixes, remaining risks, and required owner decision. Status: **PENDING — PRODUCTION RELEASE BLOCKED**. |

No application runtime code, migration SQL, dependency manifest, lockfile, environment
configuration, or CI workflow was changed. No secret or credential value was added.

---

## C. Test results

All commands run locally on Node `v24.12.0` / npm `11.6.2`, Python `3.12.16` (`.venv`),
with synthetic data and local/in-memory databases only.

| Command | Result |
| --- | --- |
| `npm ci` | PASS — 105 packages from lockfile |
| `npm test` | **PASS — 207 passed, 0 failed** |
| `npm run test:db:pipeline` | PASS |
| `node tests/integration/option-b-pending-sql.mjs` | PASS |
| `.venv/bin/python -m unittest discover -s tests` | **PASS — 92 passed, 0 failed** |
| `npm run build` (includes `npm run typecheck`) | PASS; only pre-existing >500 kB chunk warning |
| `npm run test:ui:feeds` (local Vite server + local Chrome executable) | PASS |
| `npm audit --audit-level=high` | **FAIL — 4 high vulnerabilities** |

No lint script exists in `package.json`; typecheck is covered by `npm run build`.
Browser UI test is not part of the repository CI workflow but was run locally and passed.

---

## D. Security

- `npm audit` reports **4 high-severity advisories**: `picomatch` (`GHSA-fc5q-39xc-vjpf`,
  ReDoS, CVSS 7.5, range `<=4.0.7`), and transitive dependents `fdir@6.5.0`,
  `tinyglobby@0.2.17`, `vite@6.4.5`.
- Latest published `picomatch` is `4.0.7`, which is still inside the vulnerable range;
  **no patched version exists**. `npm audit fix --dry-run` changed 0 packages and left
  4 high vulnerabilities. `vite@8.3.8` still depends on `picomatch ^4.0.7`, so even a
  major Vite upgrade would not resolve it. No `--force`, suppression, or audit bypass
  was used.
- The vulnerability is in **build/dev tooling only** (`vite` and its transitive deps are
  devDependencies; no vulnerable package is shipped in the browser runtime bundle).
- **Pre-existing on `main`**: `origin/main` has identical `vite@6.4.5`, `picomatch@4.0.7`,
  `fdir@6.5.0`, `tinyglobby@0.2.17` and identical manifests. This release introduces
  no new dependency exposure.
- Full security review and required owner decision: `docs/security-release-review.md`
  (status **PENDING — PRODUCTION RELEASE BLOCKED**). No suppression or CI change.
- Database security verified read-only: both RPCs are `SECURITY INVOKER` with
  `search_path=""`, executable by `service_role` only (anon/authenticated/public = false).
  Fingerprints: 7-arg `baa97bc9a27415d56cd74d72e5b71522`, 8-arg
  `0761e99ffa2991fb0fbd00cd20f34dde`. No auth/RLS or grant changes were made.

---

## E. Git

- Branch: `feat/option-b-telegram-classification`
- Base HEAD verified: `e36269d5577200a709e36339c1eceddec17cec88`
- Upstream: `0 0` (synchronized at verification time)
- `origin/main`: `709fd9ad9e9c923c817ad2147f436ee017fa896c`; feature is `0 4` (4 commits ahead, 0 behind)
- Working tree at time of this report: prepared changes present but **not committed and not pushed**
  (see Gate 7A status and Section I). No merge, force-push, or history rewrite performed.
- GitHub: default branch `main`; no open pull requests; feature HEAD has
  `Vercel Preview Comments` = success; Vercel combined status = success for preview
  `EsKHyVqF6DZWiVw4GBB8bVJjsjKQ`; `origin/main` Vercel status points to deployment
  `8biP7jM5EpBQ68Q8jg8d6reryMBQ`.

---

## F. Production readiness

**Hosting / deployment configuration** (`vercel.json`): framework `vite`, build command
`npm run build`, output `dist`, SPA fallback rewrite, 4 API rewrites, function config for
`api/telegram-sync.py` (300 s, includes scraper/pipeline files), security headers including
CSP. Vercel project setting for the production branch could not be read without auth;
GitHub default and expected branch are both `main`.

**Environment variables:** names/presence could not be verified without authenticated
Vercel access. No values were requested, read, or printed. Owner dashboard checklist
required (names only, never values).

**Moderator coverage:** **not confirmed.** No moderator was assigned or invented.
Proposed SLA is in `docs/moderator-operations-guide.md` §8 and needs explicit owner acceptance.

**Rollback:** procedure and rationale in `docs/rollback-readiness.md`. Application rollback
needs no migration rollback, no checkpoint reset, no replay, and no DB repair. Old `main`
code already filters public jobs to `active` and uses only the legacy 7-arg RPC, so pending
jobs created after release stay hidden after rollback. Owner must confirm the previous
Vercel deployment is retained and promotable.

**Fresh read-only production baseline (2026-11-18):**
- `job_offers`: active **3,089**, archived **202**, pending **0**
- `telegram_ingestion_messages`: complete 2,554, retry **172**, no review holds
- `job_broadcast_outbox` backlog **0**; pending profile verifications **0**
- Cron: `projecta-telegram-sync` active `*/5 * * * *`, `projecta-expire-jobs` active `0 * * * *`
- 24 h cron history: 288 sync runs + 24 expiry runs, all `succeeded`
- `GET /api/jobs` → HTTP **200**, `total=3089`, 200 jobs on first page

**Migration history (read-only):** `20261110223752` and `20261117000000` present locally
and remotely. The ten historical `202610300001`–`202610300010` entries remain local-only
and were deliberately left untouched. No migration, repair, or `db push` was run.

---

## G. Remaining blockers

| # | Blocker | Severity | Owner | Required resolution |
| --- | --- | --- | --- | --- |
| 1 | 4 high npm advisories with no published fix (`picomatch` ≤4.0.7); CI `npm audit` gate fails identically on `main` | **High (process) / Low (runtime exposure)** | Owner / security decision | Explicitly accept a documented exception, or wait for an upstream patched release. Do not suppress or bypass. Until decided, push/PR/release is held. |
| 2 | Exact live Vercel production deployment commit and production branch cannot be confirmed (CLI logged out; no Vercel env vars) | Medium | Owner with Vercel access | Confirm in Vercel dashboard that deployment `8biP7jM5EpBQ68Q8jg8d6reryMBQ` / commit `709fd9ad…` is live on `main`, and that the project production branch is `main`. |
| 3 | Vercel env-var names/presence unverified | Medium | Owner with Vercel access | Dashboard checklist of required variable **names and presence only**; never values. |
| 4 | Moderator assignment, backup, and SLA unconfirmed | **High (operational)** | Owner | Name responsible moderator(s) and accept/amend the proposed SLA in the operations guide. |
| 5 | Previous Vercel deployment retention/promotability unconfirmed | Medium | Owner with Vercel access | Verify the previous successful production deployment is retained and can be promoted. |
| 6 | Ten historical local-only migrations | Low (accepted) | Owner (already accepted historically) | No action for this release; explicitly do not reconcile. |

---

## H. Release recommendation

**NO-GO** for merge/deploy at this time.

Supporting evidence: all functional verification is green (207 JS tests, 92 Python tests,
DB integration suites, typecheck/build, browser regression) and all 18 classification
scenarios are covered. However, the repository's required `npm audit --audit-level=high`
gate is red with no available fix, moderator coverage is unconfirmed, and Vercel production
configuration/rollback evidence requires authenticated owner verification. These are
process and operational blockers, not code regressions, but they are explicit release
conditions. No production write, merge, deploy, migration, cron change, replay, or
credential exposure was performed.

---

## I. Exact next action (owner approval required)

1. **Decide on the security exception** for the pre-existing `picomatch` advisory
   (accept with documented rationale, or wait for an upstream patch). This is the
   decision that unblocks commit/push/PR.
2. **Confirm in Vercel** (names/IDs only, never secret values): live production deployment
   and branch, required env-variable presence, and retention of the previous deployment.
3. **Name the moderator(s)** and accept or amend the proposed pending-queue SLA.
4. Reply with that decision. On approval, the release action will be limited to: commit the
   prepared changes, push the feature branch, open/refresh the PR, and confirm CI and Vercel
   preview. **Merging to `main` and deploying remain separate, explicit authorizations.**
5. After an approved deployment, execute only the read-only plan in
   `docs/post-deployment-verification.md`; roll back only under a separate authorization
   using `docs/rollback-readiness.md`.
