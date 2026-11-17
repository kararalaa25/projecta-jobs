# Option B — Production verification, schema drift, and manual SQL

Target Supabase project (documented, non-secret): `aqptjxmcclstxzpazbur`
Feature branch: `feat/option-b-telegram-classification`
Implementation commit under verification: `3024e5f99f4d496a82b3d134c45c16a35117ac52`

No Supabase MCP tool, CLI, credentials, or read-only connection is available in the
development environment. Production metadata verification is therefore **manual**:
run the read-only script below in the Supabase SQL Editor and return the results.
Nothing in this document queries job rows, contacts, applicant data, profile data,
or Auth tables — only `pg_catalog` / `information_schema` structural metadata.

---

## 1. Read-only metadata script (run manually in Supabase SQL Editor)

```sql
-- OPTION B — READ-ONLY PRODUCTION METADATA VERIFICATION
-- Project: aqptjxmcclstxzpazbur
-- SELECT-only. Returns structural metadata only. Do not add data queries.

-- 0. PostgreSQL major version
select current_setting('server_version') as server_version,
       current_setting('server_version_num') as server_version_num;

-- 1. job_offers columns required by Option B and by the historical baseline
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'job_offers'
  and column_name in (
    'id','status','source','source_chat_id','source_message_id','source_channel',
    'source_url','source_posted_at','source_text_hash','raw_text','title',
    'description','role_category','location_city','salary_range','employment_type',
    'company_name','city','contact_phone','contact_telegram','contact_whatsapp',
    'contact_info','publisher_id','created_at','ingested_at','expires_at',
    'renewed_at','archive_reason','telegram_message_key','source_post_url',
    'split_index','specialty_tags','publisher_verified'
  )
order by column_name;

-- 2. status column: existence + exact definition
select exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='job_offers' and column_name='status'
) as status_column_exists;

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='job_offers' and column_name='status';

-- 3. CHECK constraints mentioning status (accepted moderation values)
select con.conname as constraint_name,
       pg_get_constraintdef(con.oid) as definition,
       con.convalidated as is_validated
from pg_constraint con
where con.conrelid = 'public.job_offers'::regclass
  and con.contype = 'c'
  and pg_get_constraintdef(con.oid) ilike '%status%'
order by con.conname;

-- 4. Triggers on job_offers (confirm none rewrites status on INSERT)
select t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as definition,
       t.tgenabled as enabled
from pg_trigger t
where t.tgrelid = 'public.job_offers'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 5. RPC signatures and security properties
select p.proname as function_name,
       p.pronargs as argument_count,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as return_type,
       p.prosecdef as security_definer,
       p.proconfig as set_clauses
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('commit_telegram_jobs','commit_telegram_jobs_initial_status')
order by p.proname, p.pronargs;

-- 5b. Compact definition fingerprints (compare original 7-arg RPC before/after)
select p.proname as function_name,
       p.pronargs as argument_count,
       md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('commit_telegram_jobs','commit_telegram_jobs_initial_status')
order by p.proname, p.pronargs;

-- 6. RPC execution privileges
select proname as function_name,
       oid::regprocedure as signature,
       has_function_privilege('anon', oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', oid, 'EXECUTE') as service_role_execute,
       has_function_privilege('public', oid, 'EXECUTE') as public_execute
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('commit_telegram_jobs','commit_telegram_jobs_initial_status')
order by proname;

-- 7. Migration history
select to_regclass('supabase_migrations.schema_migrations') as migrations_table;

select version from supabase_migrations.schema_migrations
where version in ('202610300007','20261101003445','20261117000000')
order by version desc;

select version from supabase_migrations.schema_migrations
order by version desc limit 10;
```

### Interpretation / go criteria

| Check | Expected |
| --- | --- |
| `server_version` | PostgreSQL major version compatible with the local 17.12 rehearsal |
| `status_column_exists` | `true` |
| `status` definition | `text`, `NOT NULL`, default `'active'` |
| status CHECK | accepts `active`, `pending`, `rejected`, `archived` (`not valid` is the known historical state; see §2) |
| triggers | `projecta_job_metadata`, `projecta_job_initial_expiry`, `projecta_enqueue_job_broadcast`; none assigns `new.status` |
| original RPC | exactly one 7-arg `commit_telegram_jobs`; record `definition_md5` |
| new RPC | zero `commit_telegram_jobs_initial_status` rows (migration not yet applied) |
| privileges | `service_role_execute = true` for both; all others `false` |
| migrations | `20261101003445` present; `20261117000000` **absent** |

---

## 2. Schema drift findings

The repository migration history does **not** fully reproduce the production
`job_offers` structure. This was confirmed by replaying all migrations against a
disposable PostgreSQL 17.12 instance.

### Columns required by migrations/RPCs but never created by any migration

| Column | Referenced by | Created by migration? |
| --- | --- | --- |
| `status` | `202610300007` (CHECK), `20261110170414` (index/trigger/functions), both commit RPCs, `api/jobs.js`, `api/admin.js` | **No** |
| `description` | both commit RPCs, `api/admin.js`, `api/jobs.js` | **No** |
| `location_city` | both commit RPCs, `api/admin.js`, `api/jobs.js` | **No** |
| `salary_range` | both commit RPCs, `api/admin.js`, `api/jobs.js` | **No** |
| `source` | `20261101025209` trigger, `20261110170414` functions, both commit RPCs | **No** |
| `contact_info` | `20261101025209` trigger, both commit RPCs, `api/admin.js` | **No** |
| `publisher_id` | `20261110170414` functions, `api/admin.js` | **No** |

Additionally, `202610300001_job_offers.sql` creates strict `NOT NULL` source columns
(`source_chat_id`, `source_message_id`, `source_channel`, `source_posted_at`,
`source_text_hash`, `raw_text`) that no commit RPC populates. Migration
`202610300002_reconcile_job_offers.sql` explicitly documents the alternative
"existing table" path where those columns are nullable; production evidently
followed that path.

`202610300007_super_admin.sql` adds `job_offers_status_admin_check` with
`not valid`, i.e. the constraint is present but was never validated by a full-table
scan. This is the known historical state; do not "fix" it as part of Option B.

### Triggers on `job_offers` (from local replay)

- `projecta_job_metadata` (before INSERT or UPDATE of `contact_info`, `source`, `role_category`) — derives `telegram_message_key`, `source_post_url`, `specialty_tags`, `split_index`. Does **not** assign `status`.
- `projecta_job_initial_expiry` (before INSERT) — assigns `renewed_at` and `expires_at`. Does **not** assign `status`.
- `projecta_enqueue_job_broadcast` (AFTER INSERT or UPDATE of `status`) — returns early unless `new.status='active'` **and** `new.source='manual'`; therefore approving a Telegram pending job does not enqueue a broadcast. Does **not** assign `status`.

### Impact and decision

- **No production SQL is required for Option B.** The original 7-arg RPC, the
  historical migrations, and the existing API handlers already insert/read every
  one of the columns above on production; if any were missing, the existing
  application would already be failing. Production has them out-of-band.
- The new 8-arg migration is purely additive (`create function` only) and leaves
  the original RPC byte-for-byte unchanged (verified locally with `pg_get_functiondef`).
- The drift is a **repository reproducibility gap**: a clean-slate replay of this
  repo fails at migration `202610300007` because `status` does not yet exist. The
  local verification used a clearly labeled baseline shim after migration `002`.
- **No new migration file was added.** Adding an out-of-order or no-op migration
  would not fix the historical replay sequence and would pollute an already-applied
  history. The correction below is supplied as conditional manual SQL only.

---

## 3. Conditional additive baseline SQL (manual only — run ONLY if §1 shows a missing column)

**Target project:** `aqptjxmcclstxzpazbur`
**Purpose:** restore a missing baseline column on `public.job_offers` if, and only
if, the read-only verification proves it absent. On the current production schema
every statement is a no-op.
**Preconditions:**
- §1 read-only script has been run and its column list saved as the rollback reference.
- Executed by an authorized administrator in the Supabase SQL Editor.
- Low-traffic window; `lock_timeout` and `statement_timeout` are set locally.
- A verified backup / PITR point exists before execution.

**Exact SQL:**

```sql
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- All operations are conditional. Existing columns/constraints are untouched.
alter table public.job_offers
  add column if not exists status text not null default 'active',
  add column if not exists source text,
  add column if not exists description text,
  add column if not exists location_city text,
  add column if not exists salary_range text,
  add column if not exists contact_info text,
  add column if not exists publisher_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.job_offers'::regclass
      and conname = 'job_offers_status_admin_check'
  ) then
    alter table public.job_offers
      add constraint job_offers_status_admin_check
      check (status in ('active','pending','rejected','archived')) not valid;
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
```

**Expected results:** all listed columns exist; no row values change; no existing
constraint, trigger, grant, index, or publication setting changes;
`job_offers_status_admin_check` exists (matching the historical `not valid` state).

**Risks:** `ALTER TABLE` takes a brief `ACCESS EXCLUSIVE` lock. `ADD COLUMN ... DEFAULT`
on PostgreSQL 11+ is metadata-only for existing rows (no table rewrite), but the
`NOT NULL` default on `status` must match the historical `'active'` default or
existing API behavior changes. The `IF NOT EXISTS` guards make re-running safe;
they do **not** make it self-rollbacking.

**Verification queries:** re-run §1 queries 1–3 and 7; confirm every column is
present and that no new rows or privilege changes appeared.

**Rollback guidance:** there is no automatic rollback. Compare the post-run column
list to the pre-run snapshot from §1 and drop **only** columns that were absent
before, e.g. `alter table public.job_offers drop column if exists <column>;`.
Never drop a column that already existed, and never drop `status` from a live
system. Restore from PITR if any unexpected change is detected.

---

## 4. Deployment readiness summary

1. Run §1 read-only script; apply all go criteria. If any fails, stop.
2. Apply `supabase/migrations/20261117000000_commit_telegram_jobs_initial_status.sql`
   through the normal migration mechanism only after `20261101003445` is confirmed.
3. Re-run §1 queries 5, 5b, 6: the 8-arg RPC exists, `service_role` only, and the
   original 7-arg RPC `definition_md5` is unchanged.
4. Deploy the Python application code **after** the SQL migration. It is fail-closed,
   so a missing new RPC holds receipts with `review:pending_rpc_unavailable` and
   never publishes uncertain jobs through the old RPC.
5. Confirm active publication still works and pending jobs are absent from
   `/api/jobs`, `/api/jobs?ids=`, and realtime refetch.
6. Super-admin queue: `/admin/jobs` with status filter `pending`; `job.status`
   action accepts `active|pending|rejected|archived` and reprocessing preserves the
   decision because `status` is written only on INSERT.
7. Monitor `review:*` holds, retry backlog, pending queue age, and stale/superseded
   RPC outcomes. Do not reset ingestion checkpoints or trigger historical backfills.
8. Rollback: redeploy prior app artifact; `drop function if exists
   public.commit_telegram_jobs_initial_status(text,text,jsonb,integer,boolean,text,uuid,text);`
   never drop `commit_telegram_jobs` or `job_offers.status`.
