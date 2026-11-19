begin;
-- Strict message-ID cursor for public-channel polling. Existing checkpoints
-- backfill from counts so the first deployment after this migration never
-- rewinds to a timestamp window.
alter table public.telegram_sync_checkpoints
  add column if not exists last_processed_message_id bigint;

update public.telegram_sync_checkpoints
   set last_processed_message_id = nullif(counts->>'last_processed_message_id','')::bigint
 where last_processed_message_id is null
   and counts ? 'last_processed_message_id';
commit;
