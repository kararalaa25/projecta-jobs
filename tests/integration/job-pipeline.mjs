import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,phone_confirmed_at timestamptz,banned_until timestamptz,raw_app_meta_data jsonb default '{}');
create table public.job_offers(id uuid primary key default gen_random_uuid(),publisher_id uuid,title text,description text,source text default 'manual',status text default 'active',created_at timestamptz default now());
create table public.job_applications(id uuid primary key default gen_random_uuid(),job_id uuid references public.job_offers(id),applicant_id uuid,status text default 'submitted' check(status in('submitted','reviewing','accepted','rejected')));
grant all on public.job_offers,public.job_applications to service_role;`)
await db.exec(readFileSync('supabase/migrations/20261110170414_job_trust_pipeline_distribution.sql','utf8'))
assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.job_broadcast_outbox'::regclass")).rows[0].relrowsecurity,true)
assert.equal((await db.query("select count(*)::integer as count from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.prosecdef")).rows[0].count,0)
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
await db.query(`insert into auth.users(id,email_confirmed_at,raw_app_meta_data) values($1,now(),$2),($3,now(),'{}')`,[owner,JSON.stringify({profile_kind:'clinic',organization_verified:true,verified_credentials:{facility_license:true}}),other])
const query=async(sql,args=[])=> (await db.query(sql,args)).rows
await db.exec('set role service_role')
const [job]=await query(`insert into job_offers(publisher_id,title) values($1,'Verified clinic') returning *`,[owner])
assert.equal((await query('select * from job_broadcast_outbox')).length,2)
const [unverified]=await query(`insert into job_offers(publisher_id,title) values($1,'Unverified') returning *`,[other])
assert.equal((await query('select * from job_broadcast_outbox')).length,2)
const [application]=await query('insert into job_applications(job_id,applicant_id) values($1,$2) returning *',[job.id,other])
assert.equal((await query('select projecta_application_status($1,$2,$3,$4) as result',[other,job.id,application.id,'shortlisted']))[0].result,null)
assert.equal((await query('select projecta_application_status($1,$2,$3,$4) as result',[owner,job.id,application.id,'shortlisted']))[0].result.status,'shortlisted')
await query('update job_offers set expires_at=now()-interval \'1 second\' where id=$1',[job.id])
await assert.rejects(()=>query('insert into job_applications(job_id,applicant_id) values($1,$2)',[job.id,other]),/job_not_available/)
assert.equal((await query('select projecta_archive_expired_jobs() as count'))[0].count,1)
assert.equal((await query('select status,archive_reason from job_offers where id=$1',[job.id]))[0].archive_reason,'expired')
assert.equal((await query('select projecta_renew_job($1,$2) as result',[other,job.id]))[0].result,null)
assert.ok((await query('select projecta_renew_job($1,$2) as result',[owner,job.id]))[0].result.expires_at)
assert.equal((await query('select * from job_broadcast_outbox')).length,2,'renewal does not duplicate first-publication broadcasts')
await query("update job_offers set status='archived',archive_reason='moderated' where id=$1",[job.id])
assert.equal((await query('select projecta_renew_job($1,$2) as result',[owner,job.id]))[0].result,null)
const leases=await query("select * from projecta_claim_job_broadcasts(array['telegram','whatsapp'])")
assert.equal(leases.length,2)
assert.equal((await query("select * from projecta_claim_job_broadcasts(array['telegram','whatsapp'])")).length,0,'live leases are not double-claimed')
await query("select projecta_finish_job_broadcast($1,$2,'delivered')",[leases[0].id,other])
assert.equal((await query('select state from job_broadcast_outbox where id=$1',[leases[0].id]))[0].state,'sending','stale acknowledgements cannot finish another lease')
await query("select projecta_finish_job_broadcast($1,$2,'failed')",[leases[0].id,leases[0].lease_token])
assert.equal((await query('select state from job_broadcast_outbox where id=$1',[leases[0].id]))[0].state,'pending')
await query("select projecta_finish_job_broadcast($1,$2,'delivered')",[leases[1].id,leases[1].lease_token])
assert.equal((await query('select state from job_broadcast_outbox where id=$1',[leases[1].id]))[0].state,'delivered')
await db.exec('reset role;set role anon;')
for(const sql of ['select * from public.job_broadcast_outbox',`select private.projecta_verified_publisher('${owner}')`,`select public.projecta_application_status('${owner}','${job.id}','${application.id}','archived')`])await assert.rejects(()=>query(sql),/permission denied/)
await db.close()
console.log('PASS: migration, trusted enqueue, ownership, expiry/renewal, lease retries, and anonymous access restrictions')
