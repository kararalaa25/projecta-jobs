begin;
do $$
declare r public.job_offers;
begin
 if has_table_privilege('anon','public.profiles','SELECT') or has_table_privilege('authenticated','public.talent','INSERT') or has_table_privilege('anon','public.courses','SELECT') then raise exception 'Private directory grants exposed'; end if;
 if has_table_privilege('anon','public.job_offers','INSERT') then raise exception 'Job direct writes exposed'; end if;
 if not has_column_privilege('anon','public.job_offers','id','SELECT') then raise exception 'Realtime identity unreadable'; end if;
 if not exists(select from pg_publication_tables where pubname='supabase_realtime' and tablename='job_offers' and attnames::text[]=array['id','source','status']::text[]) then raise exception 'Realtime publication invalid'; end if;
 insert into public.job_offers(id,title,role_category,location_city,description,contact_info,source)
 values('01010101-0101-4101-8101-010101010101','Transaction-only test','Dentists','Baghdad','Rollback fixture','{"telegram_message_id":"test:1","source_url":"https://t.me/test/1","job_index":2,"role_categories":["Dentists","Pharmacists"]}','telegram') returning * into r;
 if r.telegram_message_key<>'test:1' or r.split_index<>2 or r.source_post_url<>'https://t.me/test/1' or cardinality(r.specialty_tags)<>2 or r.publisher_verified then raise exception 'Derived job metadata invalid'; end if;
 update public.job_offers set contact_info='A plain text legacy contact' where id=r.id returning * into r;
 if r.telegram_message_key is not null or r.split_index<>1 or r.specialty_tags<>array['Dentists'] then raise exception 'Legacy contact compatibility invalid'; end if;
 begin
  insert into public.courses(title,specialty,governorate,kind,starts_at,ends_at,instructor_name,instructor_credentials,accreditation_verified)
  values('Rollback test','Dentists','Baghdad','course',now(),now()+interval '1 hour','Test instructor','Declared credentials',true);
  raise exception 'Accreditation accepted without evidence';
 exception when check_violation then null;end;
end $$;
rollback;
