-- Disposable PostgreSQL 008/009 fixture assertions only. Never run test writes on production.
do $$ begin
 if has_table_privilege('anon','public.resume_assets','SELECT') then raise exception 'private resume metadata exposed';end if;
 if has_function_privilege('authenticated','public.projecta_reserve_resume(uuid,uuid,text,text,text,integer)','EXECUTE') then raise exception 'upload quota RPC exposed';end if;
 if not exists(select from public.admin_catalog where id='General Physicians' and kind='role') then raise exception 'physician seed missing';end if;
end $$;
insert into storage.objects(id,bucket_id) values(gen_random_uuid(),'projecta-resumes'),(gen_random_uuid(),'other-bucket');
set role anon;
do $$ begin
 if exists(select from storage.objects where bucket_id='projecta-resumes') then raise exception 'permissive policy exposed private files';end if;
 if (select count(*) from storage.objects where bucket_id='other-bucket')<>1 then raise exception 'unrelated bucket policy broken';end if;
end $$;
reset role;
set role service_role;
do $$ declare id uuid; begin
 for i in 1..20 loop
  id=gen_random_uuid();perform public.projecta_reserve_resume(id,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/'||id::text||'.pdf','cv.pdf','application/pdf',100);
 end loop;
 begin
  id=gen_random_uuid();perform public.projecta_reserve_resume(id,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/'||id::text||'.pdf','cv.pdf','application/pdf',100);
  raise check_violation using message='quota did not reject';
 exception when raise_exception then null;
 end;
end $$;
reset role;
do $$ declare asset uuid; begin
 select id into asset from public.resume_assets limit 1;
 update public.resume_assets set state='ready' where id=asset;
 begin
  insert into public.job_applications(job_id,applicant_id,cover_letter,resume_asset_id) values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','طلب مستخدم آخر لاختبار الملكية',asset);
  raise exception 'cross-user attachment accepted';
 exception when foreign_key_violation then null;
 end;
 insert into public.job_applications(job_id,applicant_id,cover_letter,resume_asset_id) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','طلب صاحب الملف لاختبار الملكية',asset);
end $$;
select 'PASS: private metadata, restrictive bucket RLS, server-only quota, same-owner attachment FK and sixth category' as result;
