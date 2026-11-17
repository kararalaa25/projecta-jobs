// Disposable in-memory PostgreSQL test for the additive pending-status RPC.
// Nothing here connects to a remote database, and all fixtures are synthetic.
import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create table public.job_offers(
    id uuid primary key default gen_random_uuid(),
    title text not null, description text, role_category text, location_city text,
    salary_range text, employment_type text check(employment_type in ('Full-time','Part-time','Contract','Internship')), source text default 'manual',
    created_at timestamptz default now(), contact_info text,
    contact_phone text, contact_telegram text, contact_whatsapp text,
    status text not null default 'active' check(status in ('active','pending','rejected','archived')),
    expires_at timestamptz default now()+interval '30 days'
  );
  grant all on public.job_offers to service_role;
`)
await db.exec(readFileSync('supabase/migrations/20261101003445_telegram_multi_job_pipeline.sql', 'utf8'))
await db.exec(readFileSync('supabase/migrations/20261117000000_commit_telegram_jobs_initial_status.sql', 'utf8'))
// Existing transaction suite must still pass unchanged against the original RPC.
const originalSuite = await db.exec(readFileSync('tests/sql/telegram_multi_job_pipeline.sql', 'utf8'))
assert.ok(JSON.stringify(originalSuite).includes('PASS: atomic split'), 'original SQL transaction suite failed')

const q = async (sql, args = []) => (await db.query(sql, args)).rows
const signature = async (name, count) => (await q(
  `select count(*)::integer as n from pg_proc p join pg_namespace s on p.pronamespace=s.oid
   where s.nspname='public' and p.proname=$1 and p.pronargs=$2`, [name, count]))[0].n
assert.equal(await signature('commit_telegram_jobs', 7), 1, 'original RPC missing/changed')
assert.equal(await signature('commit_telegram_jobs_initial_status', 8), 1, 'additive RPC missing')

const key = 'optionb-test:17'
const msg = {message_key: key, chat_id: 123, channel: 'optionb-test', message_id: 17,
  raw_text: 'synthetic vacancy', posted_at: new Date().toISOString(),
  observed_at: new Date().toISOString(), source_hash: 'hash-v1'}
await q('set role service_role')
await q('select public.enqueue_telegram_message($1,$2)', [JSON.stringify(msg), 3])
const ids = ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002']
const item = id => JSON.stringify({id, title: 'Synthetic dentist', description: 'synthetic section',
  role_category: 'Dentists', location_city: 'Baghdad', source: 'telegram',
  created_at: new Date().toISOString(), contact_info: JSON.stringify({telegram_message_id: key})})
const records = JSON.stringify([JSON.parse(item(ids[0])), JSON.parse(item(ids[1]))])

// Original RPC keeps its default (active) publication behavior.
assert.equal((await q(`select public.commit_telegram_jobs($1,$2,$3,$4,$5,$6,$7) as result`,
  [key, 'hash-v1', records, 3, false, null, ids[0]]))[0].result, 'complete')
assert.deepEqual((await q('select status from job_offers order by id')).map(r => r.status), ['active', 'active'])

// Duplicate processing with the same deterministic IDs cannot create a second listing.
const beforeCount = (await q('select count(*)::integer as n from job_offers where id=any($1)', [ids]))[0].n
await q(`update telegram_ingestion_messages set state='pending' where message_key=$1`, [key])
assert.equal((await q(`select public.commit_telegram_jobs($1,$2,$3,$4,$5,$6,$7) as result`,
  [key, 'hash-v1', records, 3, false, null, ids[0]]))[0].result, 'complete')
assert.equal((await q('select count(*)::integer as n from job_offers where id=any($1)', [ids]))[0].n, beforeCount,
  'duplicate processing created a second public listing')

// A new receipt uses the additive RPC: both children are pending atomically.
const key2 = 'optionb-test:18'
await q('select public.enqueue_telegram_message($1,$2)', [JSON.stringify({...msg, message_key: key2,
  message_id: 18, source_hash: 'hash-v2'}), 3])
const pendingIds = ['bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002']
const pendingRecords = JSON.stringify(pendingIds.map(id => ({...JSON.parse(item(id)),
  contact_info: JSON.stringify({telegram_message_id: key2})})))
assert.equal((await q(`select public.commit_telegram_jobs_initial_status($1,$2,$3,$4,$5,$6,$7,$8) as result`,
  [key2, 'hash-v2', pendingRecords, 3, false, null, pendingIds[0], 'pending']))[0].result, 'complete')
assert.deepEqual((await q('select status from job_offers where id=any($1) order by id', [pendingIds]))
  .map(r => r.status), ['pending', 'pending'])
assert.equal((await q(`select count(*)::integer as n from job_offers where status='active' and id=any($1)`,
  [pendingIds]))[0].n, 0, 'pending rows leaked into the public feed query')

// A moderator decision survives a re-parse: status is never written on conflict.
await q(`update job_offers set status='active' where id=$1`, [pendingIds[0]])
await q(`select public.enqueue_telegram_message($1,$2)`, [JSON.stringify({...msg, message_key: key2,
  message_id: 18, observed_at: new Date(Date.now() + 1000).toISOString(), source_hash: 'hash-v3'}), 3])
await q(`select public.commit_telegram_jobs_initial_status($1,$2,$3,$4,$5,$6,$7,$8)`,
  [key2, 'hash-v3', pendingRecords, 3, false, null, pendingIds[0], 'pending'])
assert.deepEqual((await q('select status from job_offers where id=any($1) order by id', [pendingIds]))
  .map(r => r.status), ['active', 'pending'], 'moderator decision overwritten')

// A rejected or archived job can never be reactivated by reprocessing, even
// when the caller requests initial_status='active' (status is INSERT-only).
for (const decision of ['rejected', 'archived']) {
  const hash = 'hash-reprocess-' + decision
  await q(`update job_offers set status=$1 where id=$2`, [decision, pendingIds[0]])
  await q(`update telegram_ingestion_messages set state='pending', source_hash=$1 where message_key=$2`, [hash, key2])
  await q(`select public.commit_telegram_jobs_initial_status($1,$2,$3,$4,$5,$6,$7,$8)`,
    [key2, hash, pendingRecords, 3, false, null, pendingIds[0], 'active'])
  assert.equal((await q('select status from job_offers where id=$1', [pendingIds[0]]))[0].status, decision,
    `${decision} decision must survive reprocessing`)
}

// Retry preserves already published children; malformed children roll back all.
await q(`update telegram_ingestion_messages set state='retry', source_hash='hash-v3' where message_key=$1`, [key2])
assert.equal((await q(`select public.commit_telegram_jobs_initial_status($1,$2,$3,$4,$5,$6,$7,$8) as result`,
  [key2, 'hash-v3', '[]', 3, true, 'review:test', pendingIds[0], 'pending']))[0].result, 'retry')
assert.equal((await q('select count(*)::integer as n from job_offers where id=any($1)', [pendingIds]))[0].n, 2)
await assert.rejects(() => q(`select public.commit_telegram_jobs_initial_status($1,$2,$3,$4,$5,$6,$7,$8)`,
  [key2, 'hash-v3', '{}', 3, false, null, pendingIds[0], 'pending']), /Invalid extracted jobs/)
await assert.rejects(() => q(`select public.commit_telegram_jobs_initial_status($1,$2,$3,$4,$5,$6,$7,$8)`,
  [key2, 'hash-v3', records, 3, false, null, pendingIds[0], 'unknown-status']), /Invalid initial status/)

// Browser roles have no execution privilege on either RPC.
await db.exec('reset role; set role anon;')
await assert.rejects(() => q(`select public.commit_telegram_jobs_initial_status($1,$2,$3,$4,$5,$6,$7,$8)`,
  [key2, 'hash-v3', '[]', 3, false, null, pendingIds[0], 'pending']), /permission denied/)
await assert.rejects(() => q(`select public.commit_telegram_jobs($1,$2,$3,$4,$5,$6,$7)`,
  [key2, 'hash-v3', '[]', 3, false, null, pendingIds[0]]), /permission denied/)
await db.exec('reset role')
await db.close()
console.log('PASS: additive pending RPC, atomic insert, moderator preservation, retry, rollback and grants')
