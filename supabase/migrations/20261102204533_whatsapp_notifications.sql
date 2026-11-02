begin;
alter table public.profiles
 add column if not exists whatsapp_phone text,
 add column if not exists whatsapp_opt_in boolean not null default false;
alter table public.profiles add constraint profiles_whatsapp_phone_format
 check (whatsapp_phone is null or whatsapp_phone ~ '^9647[0-9]{9}$');
-- Preserve existing accounts as opted out; only future rows get the requested default.
alter table public.profiles alter column whatsapp_opt_in set default true;
-- A nullable phone is valid; sending still requires both opt-in and a valid phone.
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
commit;
