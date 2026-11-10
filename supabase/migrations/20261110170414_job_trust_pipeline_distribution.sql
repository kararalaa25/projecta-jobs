-- Additive migration: trusted credentials, 30-day listings, private delivery outbox.
begin;

alter table public.job_offers add column if not exists renewed_at timestamptz;
alter table public.job_offers add column if not exists expires_at timestamptz;
alter table public.job_offers add column if not exists archive_reason text;
update public.job_offers set expires_at=coalesce(renewed_at,created_at,now())+interval '30 days' where expires_at is null;
alter table public.job_offers alter column expires_at set default (now()+interval '30 days');
alter table public.job_offers alter column expires_at set not null;
create index if not exists job_offers_active_expiry_idx on public.job_offers(expires_at) where status='active';
create or replace function public.projecta_job_initial_expiry() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 new.renewed_at:=null;
 new.expires_at:=coalesce(new.created_at,now())+interval '30 days';
 return new;
end $$;
revoke all on function public.projecta_job_initial_expiry() from public,anon,authenticated;
create trigger projecta_job_initial_expiry before insert on public.job_offers for each row execute function public.projecta_job_initial_expiry();

-- Enforce availability at insertion too, including service-role API callers.
create or replace function public.projecta_application_job_available() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.job_offers where id=new.job_id and status='active' and expires_at>now() for share;
 if not found then raise exception 'job_not_available' using errcode='23514';end if;
 return new;
end $$;
revoke all on function public.projecta_application_job_available() from public,anon,authenticated;
create trigger projecta_application_job_available before insert on public.job_applications for each row execute function public.projecta_application_job_available();

-- Retain existing decisions and add the requested transparent pipeline stages.
alter table public.job_applications drop constraint if exists job_applications_status_check;
alter table public.job_applications add constraint job_applications_status_check
 check(status in ('submitted','reviewing','viewed','shortlisted','archived','accepted','rejected'));
create or replace function public.projecta_application_status(p_actor uuid,p_job uuid,p_application uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_status not in ('viewed','shortlisted','archived','accepted','rejected') then raise exception 'invalid application status';end if;
 update public.job_applications a set status=p_status
 where a.id=p_application and a.job_id=p_job and exists(select 1 from public.job_offers j where j.id=p_job and j.publisher_id=p_actor)
 returning jsonb_build_object('id',a.id,'status',a.status) into result;
 return result;
end $$;
revoke all on function public.projecta_application_status(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.projecta_application_status(uuid,uuid,uuid,text) to service_role;

create or replace function public.projecta_renew_job(p_actor uuid,p_job uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 update public.job_offers j set status='active',archive_reason=null,renewed_at=now(),expires_at=now()+interval '30 days'
 where j.id=p_job and j.publisher_id=p_actor and j.source='manual' and (j.status='active' or (j.status='archived' and j.archive_reason='expired'))
 returning jsonb_build_object('id',j.id,'expires_at',j.expires_at) into result;
 return result;
end $$;
revoke all on function public.projecta_renew_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.projecta_renew_job(uuid,uuid) to service_role;

create or replace function public.projecta_archive_expired_jobs() returns integer
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 update public.job_offers set status='archived',archive_reason='expired' where status='active' and expires_at<=now();
 get diagnostics affected=row_count;
 return affected;
end $$;
revoke all on function public.projecta_archive_expired_jobs() from public,anon,authenticated;
grant execute on function public.projecta_archive_expired_jobs() to service_role;
-- APIs enforce expires_at on every read/application even between cron runs.
select public.projecta_archive_expired_jobs();
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute $schedule$select cron.schedule('projecta-expire-jobs','0 * * * *','select public.projecta_archive_expired_jobs()')$schedule$;
 end if;
end $$;

create table public.job_broadcast_outbox(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.job_offers(id) on delete cascade,
 channel text not null check(channel in ('telegram','whatsapp')),
 state text not null default 'pending' check(state in ('pending','sending','delivered','failed','cancelled')),
 attempts integer not null default 0,available_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,created_at timestamptz not null default now(),delivered_at timestamptz,
 unique(job_id,channel)
);
alter table public.job_broadcast_outbox enable row level security;
revoke all on public.job_broadcast_outbox from public,anon,authenticated;
grant all on public.job_broadcast_outbox to service_role;
create index job_broadcast_pending_idx on public.job_broadcast_outbox(available_at,created_at) where state in ('pending','sending');

create schema if not exists private;
-- Narrow internal lookup needs Auth access; never expose Auth rows to callers.
create or replace function private.projecta_verified_publisher(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from auth.users u where u.id=p_user
  and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
  and (u.banned_until is null or u.banned_until<=now())
  and not(coalesce(u.raw_app_meta_data->'suspended','false'::jsonb)='true'::jsonb
   and coalesce(nullif(u.raw_app_meta_data->>'suspended_until','')::timestamptz,'infinity'::timestamptz)>now())
  and case when u.raw_app_meta_data->>'profile_kind' in ('clinic','medical_center') then
   u.raw_app_meta_data->'organization_verified'='true'::jsonb
   and coalesce(u.raw_app_meta_data->>'organization_verification_status',u.raw_app_meta_data->>'verification_status','') not in ('pending','rejected')
   and u.raw_app_meta_data->'verified_credentials'->'facility_license'='true'::jsonb
  else u.raw_app_meta_data->'medical_professional_verified'='true'::jsonb
   and coalesce(u.raw_app_meta_data->>'verification_status','') not in ('pending','rejected')
   and u.raw_app_meta_data->'verified_credentials'->'syndicate_membership'='true'::jsonb end
 );
$$;
revoke all on function private.projecta_verified_publisher(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.projecta_verified_publisher(uuid) to service_role;

create or replace function public.projecta_enqueue_job_broadcast() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status<>'active' or new.source<>'manual' or new.expires_at<=now() then return new;end if;
 if tg_op='UPDATE' then if old.status='active' then return new;end if;end if;
 if private.projecta_verified_publisher(new.publisher_id) then
  insert into public.job_broadcast_outbox(job_id,channel) values(new.id,'telegram'),(new.id,'whatsapp') on conflict(job_id,channel) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.projecta_enqueue_job_broadcast() from public,anon,authenticated;
create trigger projecta_enqueue_job_broadcast after insert or update of status on public.job_offers for each row execute function public.projecta_enqueue_job_broadcast();

create or replace function public.projecta_claim_job_broadcasts(p_channels text[],p_job uuid default null)
returns setof public.job_broadcast_outbox language plpgsql security invoker set search_path='' as $$
begin
 update public.job_broadcast_outbox set state='failed',lease_token=null,lease_until=null where state='sending' and lease_until<=now() and attempts>=12;
 return query update public.job_broadcast_outbox o set state='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=o.attempts+1
 where o.id in (
  select q.id from public.job_broadcast_outbox q where q.channel=any(p_channels) and (p_job is null or q.job_id=p_job)
   and q.attempts<12 and ((q.state='pending' and q.available_at<=now()) or (q.state='sending' and q.lease_until<=now()))
  order by q.created_at limit 10 for update skip locked
 ) returning o.*;
end $$;
create or replace function public.projecta_finish_job_broadcast(p_id uuid,p_lease uuid,p_outcome text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_outcome not in ('delivered','failed','cancelled') then raise exception 'invalid delivery outcome';end if;
 update public.job_broadcast_outbox set state=case when p_outcome='failed' then case when attempts>=12 then 'failed' else 'pending' end else p_outcome end,
  delivered_at=case when p_outcome='delivered' then now() else null end,
  available_at=now()+least(3600,power(2,attempts)::integer*15)*interval '1 second',lease_until=null,lease_token=null
 where id=p_id and lease_token=p_lease and state='sending';
end $$;
revoke all on function public.projecta_claim_job_broadcasts(text[],uuid) from public,anon,authenticated;
revoke all on function public.projecta_finish_job_broadcast(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.projecta_claim_job_broadcasts(text[],uuid) to service_role;
grant execute on function public.projecta_finish_job_broadcast(uuid,uuid,text) to service_role;
commit;
