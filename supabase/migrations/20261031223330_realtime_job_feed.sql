-- Only identity/status columns leave the database over job change sockets.
-- Full public cards continue through the existing API sanitizer.
begin;
do $$
begin
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='job_offers') then
    alter publication supabase_realtime drop table public.job_offers;
  end if;
  alter publication supabase_realtime add table public.job_offers (id,source,status);
end $$;

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;
create table if not exists private.telegram_sync_tokens (
  token_hash text primary key,
  expires_at timestamptz not null
);
revoke all on private.telegram_sync_tokens from public,anon,authenticated;
grant select,delete on private.telegram_sync_tokens to service_role;

create table if not exists public.telegram_sync_control (
  id integer primary key check(id=1),
  lease_owner uuid,
  lease_until timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_summary jsonb
);
create table if not exists public.telegram_sync_checkpoints (
  channel text primary key,
  last_success_at timestamptz not null,
  counts jsonb
);
alter table public.telegram_sync_control enable row level security;
alter table public.telegram_sync_checkpoints enable row level security;
revoke all on public.telegram_sync_control,public.telegram_sync_checkpoints from public,anon,authenticated;
grant all on public.telegram_sync_control,public.telegram_sync_checkpoints to service_role;
insert into public.telegram_sync_control(id) values(1) on conflict do nothing;

create or replace function public.claim_telegram_sync(p_token text,p_owner uuid)
returns text language plpgsql security invoker set search_path='' as $$
begin
  delete from private.telegram_sync_tokens
  where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and expires_at>now();
  if not found then return 'invalid'; end if;
  update public.telegram_sync_control set lease_owner=p_owner,lease_until=now()+interval '6 minutes'
  where id=1 and (lease_until is null or lease_until<now());
  if not found then return 'busy'; end if;
  return 'accepted';
end $$;
revoke all on function public.claim_telegram_sync(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_telegram_sync(text,uuid) to service_role;
commit;
