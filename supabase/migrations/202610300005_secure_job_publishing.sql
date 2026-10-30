-- Publishing goes through /api/publish-job. Keep existing public SELECT policies.
-- Revoke direct REST mutations so client-side metadata cannot bypass the server.
begin;
alter table public.job_offers enable row level security;
revoke insert, update, delete on public.job_offers from anon, authenticated;
grant all on public.job_offers to service_role;
-- Preserve existing role values, plus the canonical values validated by the API.
do $$
declare original_check text;
begin
  select pg_get_expr(conbin,conrelid) into original_check from pg_constraint
   where conrelid='public.job_offers'::regclass and conname='job_offers_role_category_check' and contype='c';
  if original_check is not null then
    alter table public.job_offers drop constraint job_offers_role_category_check;
    execute format('alter table public.job_offers add constraint job_offers_role_category_check check ((%s) OR role_category in (''Dentists'',''Pharmacists'',''Assistants & Techs'',''Medical Reps'',''Receptionists / Admin''))',original_check);
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
