-- PREPARED FOR REVIEW. Enable the sixth canonical medical target audience.
begin;
insert into public.admin_catalog(id,kind,label,position,active)
values('General Physicians','role','الأطباء العامون',5,true) on conflict(kind,id) do nothing;
commit;
