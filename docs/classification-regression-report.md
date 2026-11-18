# Telegram classification & moderation — regression report (Gate 6)

Date: 2026-11-18
Branch: `feat/option-b-telegram-classification`
Base commit verified: `e36269d5577200a709e36339c1eceddec17cec88`
Status: **PASS (all 18 scenarios covered by passing local/synthetic tests)**

## Scope and data sources

Every test below uses only synthetic data: mocked Gemini/Telegram clients, fake
Supabase clients, in-memory PGlite databases loaded from local migration files, or a
local Vite server with intercepted routes. **No production job, applicant, profile,
or Auth record was read or written by these tests.** No Telegram message was fetched,
no ingestion endpoint was invoked, and no cron job was triggered.

## Verification commands and results (2026-11-18)

| Command | Result |
| --- | --- |
| `npm ci` | PASS — 105 packages installed from lockfile |
| `npm test` | PASS — **207 passed, 0 failed** (was 204 before Gate 6 gaps were closed) |
| `npm run test:db:pipeline` | PASS — migration, trusted enqueue, ownership, expiry/renewal, lease retries, anonymous access |
| `node tests/integration/option-b-pending-sql.mjs` | PASS — additive pending RPC, atomic insert, moderator preservation, retry, rollback, grants |
| `.venv/bin/python -m unittest discover -s tests` | PASS — **92 passed, 0 failed** (was 90) |
| `npm run build` (includes `npm run typecheck`) | PASS — build completed in 2.63 s; only the pre-existing >500 kB chunk-size advisory warning |
| `npm run test:ui:feeds` (local Vite server, `BROWSER_EXECUTABLE` set to local Chrome) | PASS — mobile quick apply/application, tooltips, filters, timestamps, RTL, 375/767/768/1280 px layouts, filter sheet, skeletons, reduced motion, employer stages, realtime updates |
| `npm audit --audit-level=high` | **FAIL — 4 high advisories (upstream, unpatched); see §D of the final report** |

Three new tests were added to close the coverage gaps found during Gate 6:
- `tests/test_telegram_pipeline.py::OptionBPipelineTests::test_clean_single_job_uses_active_commit_without_pending_status`
- `tests/test_telegram_pipeline.py::OptionBPipelineTests::test_ambiguous_non_mixed_announcement_routes_to_pending`
- `tests/moderation.test.js` — 3 tests covering moderator-only queue access, public-feed exclusion, and the real `job.status` approval/rejection path.

## Scenario coverage matrix

| # | Required scenario | Status | Covering test / assertion |
| --- | --- | --- | --- |
| 1 | Clearly valid single job → `active` | COMPLETE | `OptionBPipelineTests::test_clean_single_job_uses_active_commit_without_pending_status` (asserts no `initial_status`, so legacy active default is used); `option-b-pending-sql.mjs` 7-arg default-active assertion |
| 2 | Multiple clearly valid jobs → separated | COMPLETE | `ExtractionTests::test_five_and_twelve_offers_become_separate_records_and_source_links`, `::test_source_order_keeps_job_ids_stable_when_ai_reorders_jobs`, `::test_same_role_different_offers_and_headcount_are_preserved_correctly`; `option-b-pending-sql.mjs` multi-row insert |
| 3 | Mixed job/non-job → `pending` | COMPLETE | `OptionBPipelineTests::test_mixed_post_publishes_only_vacancy_as_pending`; `ClassificationTests::test_mixed_post_keeps_vacancy_and_flags_review`; `option-b-pending-sql.mjs` pending insert |
| 4 | Ambiguous hiring announcement → `pending` | COMPLETE | `OptionBPipelineTests::test_ambiguous_non_mixed_announcement_routes_to_pending` (new); `ClassificationTests::test_unknown_specialty_is_flagged_not_invented` |
| 5 | Non-job advertisement → not publicly published | COMPLETE | `PipelineTests::test_non_job_skipped_and_edited_offer_removed`, `ClassificationTests::test_pure_marketplace_post_has_no_vacancy`, `PipelineTests::test_promotions_and_short_posts_never_reach_parser`, `::test_raw_fallback_requires_job_keywords`; `jobs.test.js` promo filtering |
| 6 | Missing/malformed classification → fail closed | COMPLETE | `PipelineTests::test_invalid_json_is_rejected`; `ClassificationTests::test_contradictory_dispositions_and_post_class_are_rejected`; `ReliabilityTests::test_partial_invalid_extraction_is_retried_instead_of_silently_dropped`; `option-b-pending-sql.mjs` invalid-status rejection |
| 7 | AI timeout/provider failure → safe retry/review | COMPLETE | `ReliabilityTests::test_ai_failure_commits_fallback_with_retry_not_completion`, `::test_transient_database_errors_retry_permanent_errors_do_not`, `::test_cancellation_never_commits_fallback_or_swallows_shutdown`; `PipelineTests::test_parse_failure_keeps_offer_and_durable_retry` |
| 8 | Duplicate Telegram message → idempotent | COMPLETE | `PipelineTests::test_duplicate_skips_gemini_and_write`; `ReliabilityTests::test_unchanged_complete_receipt_skips_ai_and_writes`; `option-b-pending-sql.mjs` count-unchanged assertion; `tests/sql/telegram_multi_job_pipeline.sql` `outcome='unchanged'` |
| 9 | Existing approved job → decision preserved | COMPLETE | `option-b-pending-sql.mjs`: reprocess with `initial_status='pending'`, status remains `active` |
| 10 | Existing rejected job → no reactivation | COMPLETE | `option-b-pending-sql.mjs`: reprocess with `initial_status='active'`, status remains `rejected` |
| 11 | Existing archived job → no reactivation | COMPLETE | `option-b-pending-sql.mjs`: same loop for `archived` |
| 12 | Pending job visible only to authorized moderators | COMPLETE | `tests/moderation.test.js::only a super-admin can read or change the pending moderation queue` (new); `admin.test.js::every admin request requires a remotely validated bearer and super-admin identity`, `::admin jobs review can filter pending rows while the public feed cannot` |
| 13 | Pending job excluded from public API and search | COMPLETE | `jobs.test.js::pending Telegram rows cannot reach the public feed (active-only query)`, `::targeted realtime refetch reads cannot return pending rows`, `::feed endpoint selects active public listing fields only`; `moderation.test.js::pending and rejected rows never reach the public feed` (new) |
| 14 | Approved pending job → public only after authorized moderation | COMPLETE | `tests/moderation.test.js::approved pending job becomes public only after authorized moderation; rejection stays excluded` (new — invokes the real `action:'job.status'` handler, asserts the DB update, then asserts the row appears in `/api/jobs`); `option-b-pending-sql.mjs` decision preservation |
| 15 | Rejected pending job → remains excluded | COMPLETE | Same new moderation test (rejection then empty public feed); `option-b-pending-sql.mjs` rejected-status persistence |
| 16 | Expired job → remains excluded | COMPLETE | `feed-enhancements.test.js::public feed applies a database expiry predicate before pagination, including legacy fallback`; `tests/integration/job-pipeline.mjs` expiry/archive assertions; `feed-ui.mjs` expired fixture |
| 17 | Legacy 7-arg RPC → backward compatibility | COMPLETE | `option-b-pending-sql.mjs` signature count, active default, dedup and grants; `OptionBPipelineTests::test_commit_jobs_routes_pending_without_downgrading_to_old_rpc`; production read-only fingerprint `baa97bc9a27415d56cd74d72e5b71522` |
| 18 | 8-arg RPC → expected initial status preserved | COMPLETE | `option-b-pending-sql.mjs` pending insert, status-INSERT-only, retry, invalid status and anon denial; `OptionBPipelineTests` pending-routing tests; production read-only fingerprint `0761e99ffa2991fb0fbd00cd20f34dde` |

## Limitations (not claimed as verified)

- No live Gemini model call, live Telegram channel fetch, or live Supabase write was
  performed. Behavior is verified against mocked providers and local databases.
- `npm run test:ui:feeds` is not part of the repository CI workflow. It was run
  locally against a Vite dev server with all API routes intercepted and a local
  Chrome binary; no external service was contacted.
- No synthetic or production job was inserted into Supabase as part of Gate 6.
