begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Keep the existing authoritative job_offers table and stable message/child IDs.
-- Derive indexed metadata from the ingestion contact envelope on every write.
create or replace function private.projecta_job_metadata()
returns trigger language plpgsql security invoker set search_path='' as $$
declare metadata jsonb;
begin
 begin metadata:=new.contact_info::jsonb; exception when invalid_text_representation then metadata:='{}'; end;
 new.telegram_message_key:=case when new.source='telegram' then metadata->>'telegram_message_id' end;
 new.source_post_url:=case when (metadata->>'source_url') ~ '^https://t\.me/' then metadata->>'source_url' end;
 new.specialty_tags:=array[new.role_category];
 if jsonb_typeof(metadata->'role_categories')='array' then
  new.specialty_tags:=array(select distinct value from jsonb_array_elements_text(metadata->'role_categories') where length(value) between 1 and 100);
  if cardinality(new.specialty_tags)=0 then new.specialty_tags:=array[new.role_category]; end if;
 end if;
 new.split_index:=case when (metadata->>'job_index') ~ '^[0-9]{1,3}$' then greatest(1,(metadata->>'job_index')::integer) else 1 end;
 return new;
end $$;
revoke all on function private.projecta_job_metadata() from public,anon,authenticated;
grant execute on function private.projecta_job_metadata() to service_role;
alter table public.job_offers
 add column if not exists telegram_message_key text,
 add column if not exists source_post_url text,
 add column if not exists split_index integer not null default 1 check(split_index between 1 and 999),
 add column if not exists specialty_tags text[] not null default '{}',
 add column if not exists publisher_verified boolean not null default false;
comment on column public.job_offers.publisher_verified is 'Reserved administrator-controlled review flag; never inferred from Telegram text. Live account badges are resolved from administrator-controlled Auth claims.';
drop trigger if exists projecta_job_metadata on public.job_offers;
create trigger projecta_job_metadata before insert or update of contact_info,source,role_category
 on public.job_offers for each row execute function private.projecta_job_metadata();
create index if not exists job_offers_message_group_idx on public.job_offers(telegram_message_key) where telegram_message_key is not null;
create index if not exists job_offers_specialty_tags_idx on public.job_offers using gin(specialty_tags);
-- The existing identity-only supabase_realtime publication is already enabled.
-- Preserve all existing grants/publication settings and rows in this additive release.
-- No public CV URLs or editable verification claims. All sensitive profile data
-- remains service-only; published directory reads use explicit server projections.
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 120),
 profile_kind text not null default 'professional' check(profile_kind in('professional','doctor','dentist','pharmacist','nurse','medical_rep','clinic_operations','clinic','medical_center')),
 specialty text not null,
 governorate text,
 verification_status text not null default 'unverified' check(verification_status in('unverified','pending','verified','rejected')),
 verified_credentials jsonb not null default '{}' check(jsonb_typeof(verified_credentials)='object'),
 medical_credentials jsonb not null default '{}' check(jsonb_typeof(medical_credentials)='object'),
 matching_metadata jsonb not null default '{}' check(jsonb_typeof(matching_metadata)='object'),
 cv_asset_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(cv_asset_id,user_id) references public.resume_assets(id,user_id)
);
create table public.talent (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 name text not null check(length(name) between 1 and 120),
 headline text not null default '',specialty text not null,governorate text not null,
 qualification text not null default '',bio text not null default '',
 experience_years integer check(experience_years between 0 and 60),
 skill_tags text[] not null default '{}' check(cardinality(skill_tags)<=30),
 shift_preferences text[] not null default '{}' check(shift_preferences <@ array['Full-time','Part-time','Shift']),
 availability text not null default 'open' check(availability in('available','open','unavailable')),
 phone text,whatsapp_enabled boolean not null default false,
 contact_consent boolean not null default false,
 cv_asset_id uuid,
 publication_status text not null default 'draft' check(publication_status in('draft','published','archived')),
 published_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(cv_asset_id,user_id) references public.resume_assets(id,user_id),
 check(not whatsapp_enabled or phone is not null),
 check(publication_status<>'published' or published_at is not null)
);
create index talent_user_idx on public.talent(user_id);
create index talent_directory_idx on public.talent(governorate,specialty,availability) where publication_status='published';
create index talent_cv_owner_idx on public.talent(cv_asset_id,user_id) where cv_asset_id is not null;
create index profiles_cv_owner_idx on public.profiles(cv_asset_id,user_id) where cv_asset_id is not null;
create table public.courses (
 id uuid primary key default gen_random_uuid(),
 organizer_id uuid references auth.users(id) on delete set null,
 title text not null check(length(title) between 1 and 160),
 specialty text not null,governorate text not null,
 kind text not null check(kind in('hands_on','seminar','course','program')),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),
 instructor_name text not null check(length(instructor_name) between 1 and 120),
 instructor_credentials text not null check(length(instructor_credentials) between 1 and 240),
 venue text not null default '',description text not null default '',
 registration_url text check(registration_url is null or registration_url ~ '^https://'),
 phone text,whatsapp_enabled boolean not null default false,
 accreditation_verified boolean not null default false,
 accreditation_reference text,
 publication_status text not null default 'draft' check(publication_status in('draft','published','archived')),
 published_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(not whatsapp_enabled or phone is not null),
 check(not accreditation_verified or coalesce(length(accreditation_reference),0)>0),
 check(publication_status<>'published' or (published_at is not null and (registration_url is not null or phone is not null)))
);
create index courses_directory_idx on public.courses(starts_at,governorate,specialty) where publication_status='published';
create index courses_organizer_idx on public.courses(organizer_id) where organizer_id is not null;
alter table public.profiles enable row level security;
alter table public.talent enable row level security;
alter table public.courses enable row level security;
revoke all on public.profiles,public.talent,public.courses from public,anon,authenticated;
grant all on public.profiles,public.talent,public.courses to service_role;
comment on table public.profiles is 'Private profile/credential storage. Auth app_metadata remains the authority for live verification badges. Server-reviewed writes only.';
comment on table public.talent is 'Only explicitly published profiles enter the sanitized directory; contacts require separate consent. CV asset IDs stay private.';
comment on table public.courses is 'Only reviewed, published courses enter the public directory. Accreditation never inferred from course text.';
notify pgrst,'reload schema';
commit;
