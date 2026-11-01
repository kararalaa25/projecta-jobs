-- Run against a migrated database. Everything, including fixture jobs, rolls back.
begin;
set local role service_role;
do $$
declare
  key text := '__pipeline_transaction_test__:17';
  msg jsonb;
  rows jsonb := '[]';
  edited jsonb;
  receipt jsonb;
  outcome text;
  ids uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  item jsonb;
  total integer;
begin
  msg := jsonb_build_object('message_key',key,'chat_id',123,'channel','__pipeline_transaction_test__','message_id',17,
    'raw_text','fixture source v1','posted_at',now(),'observed_at',now(),'source_hash','test-hash-v1');
  receipt := public.enqueue_telegram_message(msg,2);
  assert receipt->>'state'='pending','new message not pending';
  for n in 1..5 loop
    item := jsonb_build_object('id',ids[n],'title','Fixture offer '||n,'description','Fixture section '||n,
      'role_category','Dentists','location_city','Baghdad','salary_range',null,'employment_type',null,
      'source','telegram','created_at',now(),'contact_info',jsonb_build_object('telegram_message_id',key,'source_url','https://t.me/fixture/17')::text);
    rows := rows || jsonb_build_array(item);
  end loop;
  outcome := public.commit_telegram_jobs(key,'test-hash-v1',rows,2,false,null,ids[1]);
  assert outcome='complete','initial commit failed';
  select count(*) into total from public.job_offers where id=any(ids);
  assert total=5,'five jobs not committed together';
  outcome := public.commit_telegram_jobs(key,'test-hash-v1',rows,2,false,null,ids[1]);
  assert outcome='unchanged','duplicate receipt was rewritten';
  outcome := public.commit_telegram_jobs(key,'stale-hash','[]',2,false,null,ids[1]);
  assert outcome='superseded','stale parse overwrote newer message';
  edited := msg || jsonb_build_object('raw_text','fixture source v2','source_hash','test-hash-v2','observed_at',now()+interval '1 second');
  receipt := public.enqueue_telegram_message(edited,2);
  assert receipt->>'state'='pending','edit not pending';
  outcome := public.commit_telegram_jobs(key,'test-hash-v2',jsonb_build_array(rows->0,rows->1),2,false,null,ids[1]);
  select count(*) into total from public.job_offers where id=any(ids);
  assert total=2,'removed sections left orphan jobs';
  -- Older preview fetches cannot undo a newer edit.
  receipt := public.enqueue_telegram_message(msg,2);
  assert receipt->>'source_hash'='test-hash-v2','older observation replaced edit';
  receipt := public.enqueue_telegram_message(edited || jsonb_build_object('source_hash','test-hash-v3','observed_at',now()+interval '2 seconds'),2);
  -- One malformed child must roll back its entire group, leaving the old pair.
  begin
    outcome := public.commit_telegram_jobs(key,'test-hash-v3',jsonb_build_array(rows->0,
      (rows->2)||jsonb_build_object('employment_type','invalid-shift')),2,false,null,ids[1]);
    raise exception 'Expected constraint failure';
  exception when check_violation then null;
  end;
  select count(*) into total from public.job_offers where id=any(ids);
  assert total=2,'partial child writes escaped rollback';
  assert (select state='pending' from public.telegram_ingestion_messages where message_key=key),'failed group marked complete';
  -- AI outage keeps previously published jobs and schedules durable retry.
  outcome := public.commit_telegram_jobs(key,'test-hash-v3','[]',2,true,'TimeoutError',ids[1]);
  select count(*) into total from public.job_offers where id=any(ids);
  assert total=2,'failed AI replaced previously published jobs';
  assert (select state='retry' and next_attempt_at>now() from public.telegram_ingestion_messages where message_key=key),'retry not durable';
  -- Retry succeeds atomically; an edit to a non-offer removes all old jobs.
  outcome := public.commit_telegram_jobs(key,'test-hash-v3',jsonb_build_array(rows->0,rows->1),2,false,null,ids[1]);
  assert outcome='complete','retry failed to recover';
  receipt := public.enqueue_telegram_message(edited || jsonb_build_object('source_hash','closed','observed_at',now()+interval '3 seconds'),2);
  outcome := public.commit_telegram_jobs(key,'closed','[]',2,false,null,ids[1]);
  select count(*) into total from public.job_offers where id=any(ids);
  assert total=0,'non-offer edit left stale jobs';
  -- Both browser roles are denied raw inbox reads and privileged RPC execution.
  assert not has_table_privilege('anon','public.telegram_ingestion_messages','SELECT'),'anonymous inbox access';
  assert not has_table_privilege('authenticated','public.telegram_ingestion_messages','SELECT'),'authenticated inbox access';
  assert not has_function_privilege('anon','public.commit_telegram_jobs(text,text,jsonb,integer,boolean,text,uuid)','EXECUTE'),'anonymous commit access';
end $$;
rollback;
select 'PASS: atomic split, deduplication, edit cleanup, rollback, stale-write protection, durable retry, non-offer removal and permissions' as verification;
