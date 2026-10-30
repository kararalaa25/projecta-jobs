-- Assertions for a DISPOSABLE PostgreSQL fixture, after migration 007 is applied twice.
-- Never run the fixture setup or these test writes against a live project.
do $$ begin
 if has_table_privilege('anon','public.platform_settings','SELECT') or has_table_privilege('authenticated','public.job_applications','INSERT') then raise exception 'browser grants exposed';end if;
 if has_function_privilege('authenticated','public.projecta_admin_mutation(uuid,text,jsonb)','EXECUTE') then raise exception 'browser RPC exposed';end if;
 if (select count(*) from public.admin_catalog where kind='location')<>18 then raise exception 'governorate seed mismatch';end if;
 if (select count(*) from public.admin_catalog where kind='role')<>5 then raise exception 'role seed mismatch';end if;
end $$;
set role service_role;
select public.projecta_admin_mutation('11111111-1111-4111-8111-111111111111','settings.save','{"maintenance":true,"banner_enabled":true,"banner_text":"اختبار"}');
select public.projecta_admin_mutation('11111111-1111-4111-8111-111111111111','catalog.save','{"id":"Surgery","kind":"role","label":"جراحة","position":8,"active":true}');
reset role;
do $$ begin
 if not (select (value->>'maintenance')::boolean from public.platform_settings where id='global') then raise exception 'settings RPC failed';end if;
 if (select count(*) from public.admin_audit_log)<>2 then raise exception 'audit not recorded';end if;
 begin
  perform public.projecta_admin_mutation(null,'settings.save','{"maintenance":false}');
  raise exception 'invalid audit should reject change';
 exception when not_null_violation then null;
 end;
 if not (select (value->>'maintenance')::boolean from public.platform_settings where id='global') then raise exception 'non-atomic settings change';end if;
end $$;
insert into public.job_applications(job_id,applicant_id,cover_letter) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','نبذة مهنية لاختبار الطلب');
select public.projecta_admin_mutation('11111111-1111-4111-8111-111111111111','application.status',jsonb_build_object('id',(select id from public.job_applications limit 1),'status','accepted'));
do $$ begin
 if (select status from public.job_applications limit 1)<>'accepted' then raise exception 'application transition failed';end if;
 begin
  insert into public.job_applications(job_id,applicant_id,cover_letter) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','طلب مكرر يجب أن يفشل');
  raise exception 'duplicate accepted';
 exception when unique_violation then null;
 end;
end $$;
delete from public.job_offers where id='33333333-3333-4333-8333-333333333333';
do $$ begin
 if exists(select from public.job_applications) then raise exception 'application cascade failed';end if;
end $$;
select 'PASS: migration idempotency, 18/5 seeds, service-only permissions, atomic RPC/audit, applications lifecycle and cascade' as result;
