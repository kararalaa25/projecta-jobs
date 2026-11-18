# Pending-job moderation operations guide (Gate 7B)

Status: **DRAFT — owner confirmation of moderator assignment and SLA required before release.**

This guide describes the procedures available in the current feature branch. It does
not assert that any person is currently assigned, trained, or on call. **No moderator
has been invented and no coverage is claimed.**

## 1. Where pending jobs appear

- Super-admin UI: `/admin` → **Jobs**, filter **Status = pending**. Direct URL:
  `/admin/jobs` with the pending status filter applied.
- Admin API (super-admin bearer required): `GET /api/admin?section=jobs&status=pending`.
  Response contains `rows`, `total`, and `hasMore`; the list is paginated in pages of 30.
- Pending jobs never appear in `/api/jobs`, `/api/jobs?ids=...`, realtime refetches,
  search, or the public site. Verified by `tests/moderation.test.js` and
  `tests/jobs.test.js` (see `docs/classification-regression-report.md`, scenarios 12–15).

## 2. How moderators approve or reject a job

1. Open the pending queue and read the original Telegram source text/link before
   deciding; do not approve from the generated title alone.
2. Approve: set the job status to **active**. Reject: set the status to **rejected**.
   The UI uses the same privileged action as the API:
   `POST /api/admin` with `{ "action": "job.status", "id": "<job-uuid>", "status": "active" | "pending" | "rejected" | "archived" }`.
3. Any other status value is rejected with HTTP 400. Only a remotely validated
   super-admin bearer token can perform this action; anonymous and ordinary member
   requests are rejected before any database access.
4. Re-processing the same Telegram message after a decision does **not** overwrite it.
   The initial-status RPC writes status only on INSERT, so approved, rejected, and
   archived decisions are preserved.
5. Approving a Telegram-origin job does not enqueue a community broadcast: the
   broadcast trigger only acts on `active` + `source='manual'` rows.

## 3. Identifying uncertain or mixed posts

A job reaches the pending queue when classification is uncertain. Signals available
to the moderator:

- `classification = 'mixed'` — the message contained both a vacancy and non-job
  content (for example a vacancy alongside an item for sale). Only the vacancy is
  extracted; the other content is discarded.
- `needs_review = true` with `review_reasons` such as `mixed_content` or
  `unknown_specialty` — the model flagged ambiguity, an unrecognized specialty, or
  ungrounded details rather than inventing them.
- Receipt-level `review:*` holds — the pipeline deliberately did not publish the
  message and left it for review instead of calling the legacy active-publishing RPC.
- Empty or contradictory classification JSON, provider timeouts, and partial invalid
  extractions fail closed: they are retried or held, never silently published.

**Moderation rule:** if the vacancy, employer, contact method, location, or salary
cannot be confirmed from the original post, reject or hold rather than approve.

## 4. Investigating duplicate jobs

- Look for the same `telegram_message_key` or the same
  (`source_chat_id`, `source_message_id`) pair. The pipeline treats a repeated receipt
  as `unchanged` and skips both AI extraction and database writes.
- A legitimately edited Telegram message updates the same identity instead of
  creating a second job.
- Multi-job posts use `split_index` to keep extracted records distinct and stable
  when the model reorders them. Do not treat different `split_index` values as
  duplicates.
- If a duplicate is already public, use the existing job-edit/delete moderation
  flow; re-running ingestion will not remove it.

## 5. Retry and review holds

- Receipts in `retry` are transient failures and are re-attempted by the existing
  scheduler with bounded retries. Ordinary ingestion retries were historically ~172;
  a growing count warrants investigation, not a reset.
- Receipts in `review` are intentional holds (`review:pending_rpc_unavailable`,
  `review:*` classification holds). They are **not** retried automatically. A moderator
  must inspect the source message and decide.
- Do **not** reset ingestion checkpoints, replay historical messages, or manually
  invoke ingestion endpoints to clear a hold. Those are separate, explicitly
  authorized production operations.
- If the 8-argument RPC is unavailable, the pipeline fails closed: it holds the
  receipt and never downgrades an uncertain job to the legacy active-publishing path.

## 6. Monitoring pending-queue age

Run this read-only query in the Supabase SQL Editor (or use an equivalent read-only
dashboard view). It does not modify data:

```sql
select status,
       count(*) as jobs,
       min(created_at) as oldest,
       max(created_at) as newest
from public.job_offers
where status = 'pending'
group by status;
```

Track the age of `oldest` against the SLA below. Also review the count of `review:*`
holds and retry receipts through the existing pipeline monitoring, and confirm
pending rows remain absent from `/api/jobs`.

## 7. Escalating ingestion failures

Escalate to the platform owner / on-call engineer (name to be confirmed by owner)
with: the affected `source_chat_id` + `source_message_id`, the receipt state
(`retry` / `review:*`), the timestamp, the relevant API/error code, and whether the
8-argument RPC is present. Escalate immediately if:

- pending or review holds grow faster than they are reviewed;
- uncertain jobs appear as `active` in the public feed;
- `/api/jobs` returns errors, or active/public job counts drop unexpectedly;
- the Telegram sync cron (`projecta-telegram-sync`, `*/5 * * * *`) stops or changes.

## 8. Proposed pending-queue SLA (PROPOSAL — not yet approved)

| Queue state | Proposed target |
| --- | --- |
| New pending job acknowledged | within 4 business hours |
| Pending job approved or rejected | within 24 business hours |
| Mixed / clearly job-related, low-risk pending | within 8 business hours where staffing allows |
| Suspected wrongful public publication or auth/RLS regression | immediate escalation, target 1 hour |
| Retry/review-hold backlog | reviewed daily; escalate if unresolved > 48 hours |

**Access requirement (important):** there is no plain `moderator` RBAC role that grants
queue access. `isSuperAdmin` in `config/access.js` accepts only a confirmed owner email
or a confirmed identity with `app_metadata.role === 'super_admin'`. A user assigned only
`role: 'moderator'` will be denied. The owner must therefore explicitly grant
`app_metadata.role = 'super_admin'` to each person who will moderate the queue, and
confirm their identity is verified and not suspended.

**Owner decision required before release:**
1. Name the responsible moderator(s) and backup, confirm their access to `/admin`, and
   confirm each has the required `super_admin` app-metadata role (see above).
2. Accept, amend, or reject the proposed SLA above.
3. Confirm the escalation contact and channel for ingestion failures.

Until these are confirmed, Gate 7B is **BLOCKED** — moderator coverage must not be
assumed.
