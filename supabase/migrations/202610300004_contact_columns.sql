begin;
alter table public.job_offers
  add column if not exists contact_phone text,
  add column if not exists contact_telegram text,
  add column if not exists contact_whatsapp text;
-- Existing JSON contact metadata remains readable before/after this migration.
notify pgrst, 'reload schema';
commit;
