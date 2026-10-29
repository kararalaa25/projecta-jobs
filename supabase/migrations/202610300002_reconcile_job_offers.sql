-- Additive reconciliation: preserves rows and existing primary key/policies.
-- Run this independently on an existing table if migration 001 cannot be applied.
begin;
create table if not exists public.job_offers (id uuid primary key default gen_random_uuid());
alter table public.job_offers
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists telegram_message_id text,
  add column if not exists raw_text text,
  add column if not exists title text,
  add column if not exists company_name text,
  add column if not exists city text,
  add column if not exists role_category text,
  add column if not exists contact_phone text,
  add column if not exists contact_telegram text,
  add column if not exists salary_text text,
  add column if not exists employment_type text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists source_chat_id bigint,
  add column if not exists source_message_id bigint,
  add column if not exists source_channel text,
  add column if not exists source_url text,
  add column if not exists source_posted_at timestamptz,
  add column if not exists source_text_hash text,
  add column if not exists ingested_at timestamptz default now();
-- Canonical keys include the channel because Telegram IDs are channel-local.
alter table public.job_offers alter column telegram_message_id type text using telegram_message_id::text;
alter table public.job_offers alter column created_at set default now();
do $$
declare id_type text;
begin
  select data_type into id_type from information_schema.columns
    where table_schema='public' and table_name='job_offers' and column_name='id';
  if id_type='uuid' then
    alter table public.job_offers alter column id set default gen_random_uuid();
  elsif id_type='text' then
    alter table public.job_offers alter column id set default gen_random_uuid()::text;
  else
    raise exception 'job_offers.id must be uuid or text; reconcile its type manually';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.job_offers'::regclass and contype='p') then
    alter table public.job_offers add primary key (id);
  end if;
end $$;
-- Backfill previous ingestion rows. Do not fabricate identities for unrelated rows.
update public.job_offers
set telegram_message_id = case
  when source_channel is not null and source_channel !~ '^-?[0-9]+$'
    then lower(ltrim(source_channel,'@')) || ':' || source_message_id::text
  else source_chat_id::text || ':' || source_message_id::text end
where telegram_message_id is null and source_chat_id is not null and source_message_id is not null;
-- If pre-existing nonnull keys conflict, abort atomically rather than delete rows.
create unique index if not exists job_offers_telegram_message_id_uidx on public.job_offers (telegram_message_id);
create index if not exists job_offers_city_role_idx on public.job_offers (city, role_category);
alter table public.job_offers enable row level security;
grant all on public.job_offers to service_role;
notify pgrst, 'reload schema';
commit;
