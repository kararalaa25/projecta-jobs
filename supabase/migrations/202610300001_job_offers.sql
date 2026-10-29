-- Apply in the Supabase SQL editor or with your existing migration workflow.
-- The scraper uses the server-only service role. Browser access is denied by RLS.
create table if not exists public.job_offers (
    id uuid primary key default gen_random_uuid(),
    source_chat_id bigint not null,
    source_message_id bigint not null,
    source_channel text not null,
    source_url text,
    source_posted_at timestamptz not null,
    source_text_hash text not null,
    raw_text text not null,
    title text not null check (length(trim(title)) > 0),
    company_name text,
    city text,
    role_category text not null check (role_category in
      ('Dentists', 'Medical Reps', 'Dental Assistants', 'Receptionists/Secretaries', 'Lab Techs')),
    contact_phone text,
    contact_telegram text,
    salary_text text,
    employment_type text check (employment_type in ('Full-time', 'Part-time', 'Contract', 'Internship')),
    ingested_at timestamptz not null default now(),
    constraint job_offers_telegram_source_key unique (source_chat_id, source_message_id)
);
alter table public.job_offers enable row level security;
revoke all on public.job_offers from anon, authenticated;
grant all on public.job_offers to service_role;
create index if not exists job_offers_city_role_idx on public.job_offers (city, role_category);
