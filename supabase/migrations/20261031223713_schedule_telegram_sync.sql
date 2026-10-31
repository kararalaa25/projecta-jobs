begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function private.dispatch_telegram_sync()
returns bigint language plpgsql security invoker set search_path='' as $$
declare token text:=gen_random_uuid()::text; request_id bigint;
begin
  delete from private.telegram_sync_tokens where expires_at<now();
  -- Don't enqueue another run while a healthy invocation holds the lease.
  if exists(select 1 from public.telegram_sync_control where id=1 and lease_until>now()) then return null; end if;
  insert into private.telegram_sync_tokens(token_hash,expires_at)
  values(encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '5 minutes');
  select net.http_get(
    url:='https://projecta-jobs.vercel.app/api/telegram-sync',
    headers:=jsonb_build_object('Authorization','Bearer '||token),
    timeout_milliseconds:=300000
  ) into request_id;
  return request_id;
end $$;
revoke all on function private.dispatch_telegram_sync() from public,anon,authenticated,service_role;
select cron.schedule('projecta-telegram-sync','*/5 * * * *','select private.dispatch_telegram_sync();');
-- Activate only after the corresponding Vercel endpoint is deployed and checked.
select cron.alter_job(job_id:=(select jobid from cron.job where jobname='projecta-telegram-sync'),active:=false);
commit;
