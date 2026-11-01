begin;
-- A durable inbox also records successful non-offers, parser versions and retries.
-- No raw post or contact data is readable by browser roles.
create table public.telegram_ingestion_messages (
  message_key text primary key,
  chat_id bigint not null,
  channel text not null,
  message_id bigint not null,
  raw_text text not null,
  posted_at timestamptz not null,
  observed_at timestamptz not null,
  source_hash text not null,
  parser_version integer not null default 0,
  state text not null default 'pending' check (state in ('pending','retry','complete')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  job_ids uuid[] not null default '{}',
  error_type text,
  updated_at timestamptz not null default now()
);
alter table public.telegram_ingestion_messages enable row level security;
revoke all on public.telegram_ingestion_messages from public, anon, authenticated;
grant select,insert,update,delete on public.telegram_ingestion_messages to service_role;
create index telegram_ingestion_due on public.telegram_ingestion_messages (state,next_attempt_at,posted_at desc)
  where state <> 'complete';

create function public.enqueue_telegram_message(p_message jsonb,p_parser_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.telegram_ingestion_messages;
begin
  insert into public.telegram_ingestion_messages(message_key,chat_id,channel,message_id,raw_text,posted_at,observed_at,source_hash)
  values(p_message->>'message_key',(p_message->>'chat_id')::bigint,p_message->>'channel',
    (p_message->>'message_id')::bigint,p_message->>'raw_text',(p_message->>'posted_at')::timestamptz,
    (p_message->>'observed_at')::timestamptz,p_message->>'source_hash')
  on conflict(message_key) do nothing;
  select * into strict r from public.telegram_ingestion_messages
    where message_key=p_message->>'message_key' for update;
  if r.source_hash <> p_message->>'source_hash' and r.observed_at <= (p_message->>'observed_at')::timestamptz then
    update public.telegram_ingestion_messages set raw_text=p_message->>'raw_text',source_hash=p_message->>'source_hash',
      observed_at=(p_message->>'observed_at')::timestamptz,state='pending',attempts=0,next_attempt_at=now(),error_type=null,updated_at=now()
      where message_key=r.message_key returning * into r;
  elsif r.source_hash=p_message->>'source_hash' then
    update public.telegram_ingestion_messages set
      observed_at=greatest(observed_at,(p_message->>'observed_at')::timestamptz),
      state=case when parser_version<p_parser_version and state='complete' then 'pending' else state end,
      next_attempt_at=case when parser_version<p_parser_version and state='complete' then now() else next_attempt_at end
      where message_key=r.message_key returning * into r;
  end if;
  return to_jsonb(r);
end $$;

create function public.commit_telegram_jobs(p_message_key text,p_source_hash text,p_records jsonb,
  p_parser_version integer,p_retry boolean,p_error_type text,p_legacy_id uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare r public.telegram_ingestion_messages; item jsonb; ids uuid[] := '{}'; previous_ids uuid[];
begin
  select * into strict r from public.telegram_ingestion_messages where message_key=p_message_key for update;
  if r.source_hash<>p_source_hash or r.parser_version>p_parser_version then return 'superseded'; end if;
  if r.state='complete' and r.parser_version=p_parser_version then return 'unchanged'; end if;
  if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>100 then
    raise exception 'Invalid extracted jobs';
  end if;
  -- A failed enrichment must not replace already published, successfully split jobs.
  if not p_retry or cardinality(r.job_ids)=0 then
    for item in select value from jsonb_array_elements(p_records) loop
      if item->>'source'<>'telegram' or
         (item->>'contact_info')::jsonb->>'telegram_message_id' is distinct from p_message_key then
        raise exception 'Invalid extracted source';
      end if;
      ids := array_append(ids,(item->>'id')::uuid);
      insert into public.job_offers(id,title,description,role_category,location_city,salary_range,
        employment_type,source,created_at,contact_info,contact_phone,contact_telegram,contact_whatsapp)
      values((item->>'id')::uuid,item->>'title',item->>'description',item->>'role_category',
        coalesce(item->>'location_city',''),item->>'salary_range',item->>'employment_type','telegram',
        (item->>'created_at')::timestamptz,item->>'contact_info',item->>'contact_phone',item->>'contact_telegram',item->>'contact_whatsapp')
      on conflict(id) do update set title=excluded.title,description=excluded.description,
        role_category=excluded.role_category,location_city=excluded.location_city,salary_range=excluded.salary_range,
        employment_type=excluded.employment_type,contact_info=excluded.contact_info,
        contact_phone=excluded.contact_phone,contact_telegram=excluded.contact_telegram,contact_whatsapp=excluded.contact_whatsapp
      where public.job_offers.source='telegram';
    end loop;
    previous_ids := array_append(r.job_ids,p_legacy_id);
    delete from public.job_offers where id=any(previous_ids) and not(id=any(ids)) and source='telegram';
  else
    ids := r.job_ids;
  end if;
  update public.telegram_ingestion_messages set parser_version=p_parser_version,
    state=case when p_retry then 'retry' else 'complete' end,attempts=attempts+1,
    next_attempt_at=now()+make_interval(secs=>least(21600,300*power(2,least(attempts,6)))::integer),
    job_ids=ids,error_type=left(p_error_type,100),updated_at=now() where message_key=p_message_key;
  return case when p_retry then 'retry' else 'complete' end;
end $$;
revoke all on function public.enqueue_telegram_message(jsonb,integer) from public,anon,authenticated;
revoke all on function public.commit_telegram_jobs(text,text,jsonb,integer,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.enqueue_telegram_message(jsonb,integer) to service_role;
grant execute on function public.commit_telegram_jobs(text,text,jsonb,integer,boolean,text,uuid) to service_role;
commit;
