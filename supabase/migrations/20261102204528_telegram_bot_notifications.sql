begin;
alter table public.profiles
 add column if not exists telegram_chat_id text,
 add column if not exists telegram_link_token_hash text,
 add column if not exists telegram_link_expires_at timestamptz,
 add column if not exists telegram_last_update_id bigint;
create unique index if not exists profiles_telegram_chat_unique on public.profiles(telegram_chat_id) where telegram_chat_id is not null;
-- Profiles already has RLS and service-role-only grants. Keep chat IDs private.
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
create or replace function public.projecta_link_telegram(owner_id uuid,token_digest text,chat_id text,telegram_update bigint)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.profiles;
begin
 if chat_id !~ '^[1-9][0-9]{0,19}$' or token_digest !~ '^[a-f0-9]{64}$' then return false; end if;
 select * into p from public.profiles where user_id=owner_id for update;
 if not found then return false; end if;
 -- Telegram retries the same update if confirmation delivery fails.
 if p.telegram_last_update_id=telegram_update and p.telegram_chat_id=chat_id then return true; end if;
 if p.telegram_link_token_hash is distinct from token_digest or p.telegram_link_expires_at is null or p.telegram_link_expires_at<=now() then return false; end if;
 update public.profiles set telegram_chat_id=chat_id,telegram_last_update_id=telegram_update,
  telegram_link_token_hash=null,telegram_link_expires_at=null where user_id=owner_id;
 return true;
exception when unique_violation then return false;
end;
$$;
revoke all on function public.projecta_link_telegram(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.projecta_link_telegram(uuid,text,text,bigint) to service_role;
commit;
