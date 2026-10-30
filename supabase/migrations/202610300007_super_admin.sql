-- Run once in Supabase SQL Editor. Server service-role only; no browser admin grants.
begin;
create table if not exists public.platform_settings (
 id text primary key check(id='global'), value jsonb not null default '{}', updated_at timestamptz not null default now()
);
insert into public.platform_settings(id,value) values ('global','{"banner_enabled":false,"banner_text":"","maintenance":false}') on conflict do nothing;
create table if not exists public.admin_catalog (
 id text not null, kind text not null check(kind in ('role','location','tag')), label text not null,
 position integer not null default 0 check(position>=0),active boolean not null default true,primary key(kind,id)
);
create table if not exists public.job_applications (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.job_offers(id) on delete cascade,
 applicant_id uuid not null references auth.users(id) on delete cascade,cover_letter text not null check(length(cover_letter) between 10 and 4000),
 cv_url text, status text not null default 'submitted' check(status in ('submitted','reviewing','accepted','rejected')),
 created_at timestamptz not null default now(),unique(job_id,applicant_id)
);
create table if not exists public.admin_audit_log (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,operation text not null,target_id text,
 created_at timestamptz not null default now()
);
create index if not exists job_applications_created_idx on public.job_applications(created_at desc);
create index if not exists admin_audit_created_idx on public.admin_audit_log(created_at desc);
alter table public.platform_settings enable row level security;
alter table public.admin_catalog enable row level security;
alter table public.job_applications enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.platform_settings,public.admin_catalog,public.job_applications,public.admin_audit_log from anon,authenticated;
grant all on public.platform_settings,public.admin_catalog,public.job_applications,public.admin_audit_log to service_role;
-- Native marketplace permits canonical category IDs, including administrator additions.
do $$ declare r record; begin
 for r in select conname from pg_constraint where conrelid='public.job_offers'::regclass and contype='c' and (pg_get_constraintdef(oid) like '%role_category%' or pg_get_constraintdef(oid) like '%status%') loop
 execute format('alter table public.job_offers drop constraint %I',r.conname);
 end loop;
end $$;
alter table public.job_offers add constraint job_offers_status_admin_check check(status in ('active','pending','rejected','archived')) not valid;
-- Close direct REST write paths; all public submissions go through verified server handlers.
revoke insert,update,delete on public.job_offers from anon,authenticated;
grant all on public.job_offers to service_role;
create or replace function public.projecta_admin_mutation(actor_id uuid,operation text,payload jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if operation='catalog.save' then
  insert into public.admin_catalog(id,kind,label,position,active) values(payload->>'id',payload->>'kind',payload->>'label',(payload->>'position')::integer,(payload->>'active')::boolean)
  on conflict(kind,id) do update set label=excluded.label,position=excluded.position,active=excluded.active;
 elsif operation='settings.save' then
  update public.platform_settings set value=payload,updated_at=now() where id='global';
 elsif operation='application.status' then
  update public.job_applications set status=payload->>'status' where id=(payload->>'id')::uuid;
  if not found then raise exception 'application missing';end if;
 else raise exception 'unsupported admin operation';
 end if;
 insert into public.admin_audit_log(actor_id,operation,target_id) values(actor_id,operation,coalesce(payload->>'id','global'));
end $$;
revoke all on function public.projecta_admin_mutation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.projecta_admin_mutation(uuid,text,jsonb) to service_role;
insert into public.admin_catalog(id,kind,label,position) values ('Dentists','role','أطباء الأسنان',0) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Pharmacists','role','الصيادلة',1) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Assistants & Techs','role','المساعدون والفنيون والتمريض',2) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Medical Reps','role','المندوبون العلميون والطبيون',3) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Receptionists / Admin','role','الإدارة والاستقبال والسكرتارية',4) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Baghdad','location','بغداد',0) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Babylon','location','بابل',1) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Karbala','location','كربلاء',2) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Najaf','location','النجف',3) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Basra','location','البصرة',4) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Erbil','location','أربيل',5) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Sulaymaniyah','location','السليمانية',6) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Duhok','location','دهوك',7) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Nineveh','location','نينوى',8) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Kirkuk','location','كركوك',9) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Diyala','location','ديالى',10) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Anbar','location','الأنبار',11) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Salah al-Din','location','صلاح الدين',12) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Wasit','location','واسط',13) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Maysan','location','ميسان',14) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Dhi Qar','location','ذي قار',15) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Al-Qadisiyyah','location','القادسية',16) on conflict do nothing;
insert into public.admin_catalog(id,kind,label,position) values ('Al-Muthanna','location','المثنى',17) on conflict do nothing;
commit;
