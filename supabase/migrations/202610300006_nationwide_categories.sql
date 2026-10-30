-- Optional canonical-column upgrade. Ingestion also preserves categories in
-- contact_info JSON for compatibility with an older role CHECK constraint.
begin;
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
notify pgrst,'reload schema';
commit;
