begin;
-- The webhook captures brand-new channel posts; this low-frequency dispatcher
-- only drains the durable inbox so AI extraction stays batched and bounded.
do $$
begin
  if exists (select 1 from cron.job where jobname='projecta-telegram-sync') then
    perform cron.alter_job(
      job_id := (select jobid from cron.job where jobname='projecta-telegram-sync'),
      schedule := '*/20 * * * *'
    );
  end if;
end $$;
commit;
