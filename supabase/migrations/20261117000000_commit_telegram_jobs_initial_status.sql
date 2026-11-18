begin;
-- Additive and fail-closed: public.commit_telegram_jobs is intentionally left
-- unchanged. Uncertain Telegram extractions use this separate RPC so they can
-- be inserted as pending inside the original transaction, with no INSERT-then-
-- UPDATE exposure window. Original function body is copied line for line;
-- status is written only on INSERT and never on conflict update.
create function public.commit_telegram_jobs_initial_status(
  p_message_key text,p_source_hash text,p_records jsonb,
  p_parser_version integer,p_retry boolean,p_error_type text,
  p_legacy_id uuid,p_initial_status text default 'pending')
returns text language plpgsql security invoker set search_path='' as $$
declare r public.telegram_ingestion_messages; item jsonb; ids uuid[] := '{}'; previous_ids uuid[];
  allowed_status text;
begin
  allowed_status := coalesce(nullif(btrim(p_initial_status),''),'pending');
  if allowed_status not in ('active','pending','rejected','archived') then
    raise exception 'Invalid initial status';
  end if;
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
        employment_type,source,created_at,contact_info,contact_phone,contact_telegram,contact_whatsapp,status)
      values((item->>'id')::uuid,item->>'title',item->>'description',item->>'role_category',
        coalesce(item->>'location_city',''),item->>'salary_range',item->>'employment_type','telegram',
        (item->>'created_at')::timestamptz,item->>'contact_info',item->>'contact_phone',item->>'contact_telegram',item->>'contact_whatsapp',allowed_status)
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
revoke all on function public.commit_telegram_jobs_initial_status(text,text,jsonb,integer,boolean,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.commit_telegram_jobs_initial_status(text,text,jsonb,integer,boolean,text,uuid,text)
  to service_role;
notify pgrst,'reload schema';
commit;
