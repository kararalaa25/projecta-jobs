-- PROPOSED ARCHITECTURAL CHANGE: requires owner approval and consumer inventory.
-- The website already reads via /api/jobs using the server service role.
-- This closes direct anon/authenticated table reads, including publisher_id.
begin;
revoke select on public.job_offers from anon,authenticated;
grant select on public.job_offers to service_role;
commit;
