-- PREPARED FOR REVIEW: do not apply until the private-resume design is approved.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('projecta-resumes','projecta-resumes',false,5242880,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.resume_assets (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 object_path text not null unique,filename text not null,mime_type text not null,
 byte_size integer not null check(byte_size between 1 and 5242880),sha256 text,
 state text not null default 'pending' check(state in ('pending','ready','rejected','deleted')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '2 hours',
 unique(id,user_id),check(object_path like user_id::text||'/%')
);
create index if not exists resume_assets_user_created_idx on public.resume_assets(user_id,created_at desc);
alter table public.resume_assets enable row level security;
revoke all on public.resume_assets from anon,authenticated;
grant all on public.resume_assets to service_role;
alter table public.job_applications add column if not exists resume_asset_id uuid;
alter table public.job_applications drop constraint if exists job_applications_resume_owner_fkey;
alter table public.job_applications add constraint job_applications_resume_owner_fkey foreign key(resume_asset_id,applicant_id) references public.resume_assets(id,user_id);
-- Even pre-existing permissive storage policies must not expose this bucket.
drop policy if exists projecta_resume_server_only on storage.objects;
create policy projecta_resume_server_only on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'projecta-resumes') with check(bucket_id<>'projecta-resumes');
create or replace function public.projecta_reserve_resume(asset_id uuid,owner_id uuid,path text,original_name text,content_type text,size_bytes integer)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 if (select count(*) from public.resume_assets where user_id=owner_id and created_at>now()-interval '24 hours')>=20 then raise exception 'resume upload quota reached';end if;
 insert into public.resume_assets(id,user_id,object_path,filename,mime_type,byte_size) values(asset_id,owner_id,path,original_name,content_type,size_bytes);
end $$;
revoke all on function public.projecta_reserve_resume(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.projecta_reserve_resume(uuid,uuid,text,text,text,integer) to service_role;
-- Serialize attachment and discard on the asset row: a linked file cannot disappear
-- between an HTTP preflight check and application insertion.
create or replace function public.projecta_validate_resume_attachment()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare asset public.resume_assets;
begin
 if new.resume_asset_id is null then return new;end if;
 select * into asset from public.resume_assets where id=new.resume_asset_id for update;
 if not found or asset.user_id<>new.applicant_id then raise foreign_key_violation using message='resume_owner_mismatch';end if;
 if asset.state<>'ready' then raise check_violation using message='resume_not_ready';end if;
 return new;
end $$;
revoke all on function public.projecta_validate_resume_attachment() from public,anon,authenticated;
grant execute on function public.projecta_validate_resume_attachment() to service_role;
drop trigger if exists projecta_resume_attachment_guard on public.job_applications;
create trigger projecta_resume_attachment_guard before insert or update of resume_asset_id,applicant_id on public.job_applications for each row execute function public.projecta_validate_resume_attachment();
create or replace function public.projecta_discard_resume(asset_id uuid,owner_id uuid)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare asset public.resume_assets;
begin
 select * into asset from public.resume_assets where id=asset_id and user_id=owner_id for update;
 if not found then raise exception 'resume_missing';end if;
 if exists(select from public.job_applications where resume_asset_id=asset.id) then raise exception 'resume_in_use';end if;
 update public.resume_assets set state='deleted' where id=asset.id;
 return asset.object_path;
end $$;
revoke all on function public.projecta_discard_resume(uuid,uuid) from public,anon,authenticated;
grant execute on function public.projecta_discard_resume(uuid,uuid) to service_role;
commit;
