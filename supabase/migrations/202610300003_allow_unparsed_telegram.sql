-- Required only for the published marketplace table's existing role check.
-- Preserve its original allowed categories and add an explicit unknown role
-- for raw Telegram records; never label an unparsed post as a medical profession.
-- Apply via the SQL editor or an authorized PostgreSQL connection.
begin;
do $$
declare original_check text;
begin
  select pg_get_expr(conbin, conrelid) into original_check
  from pg_constraint
  where conrelid='public.job_offers'::regclass
    and conname='job_offers_role_category_check' and contype='c';
  if original_check is not null then
    alter table public.job_offers drop constraint job_offers_role_category_check;
    execute format(
      'alter table public.job_offers add constraint job_offers_role_category_check check ((%s) OR (role_category = %L AND source = %L))',
      original_check, '', 'telegram'
    );
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
