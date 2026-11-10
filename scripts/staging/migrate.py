"""Apply the local fixture migrations only to the labelled local fixture, never a remote DB."""
import sys,time
from start import docker,ROOT,PREFIX
for _ in range(60):
    result=docker('exec',PREFIX+'storage','node','-e',"Promise.all([fetch('http://projecta-stage-auth:9999/health'),fetch('http://127.0.0.1:5000/status')]).then(rs=>process.exit(rs.every(r=>r.ok)?0:1)).catch(()=>process.exit(1))",check=False)
    if result.returncode==0:break
    time.sleep(.25)
else:raise SystemExit('Local Auth/Storage is not healthy. Check redacted local service logs.')
native="""
create table if not exists public.job_offers(
 id uuid primary key default gen_random_uuid(),publisher_id uuid references auth.users(id),
 title text not null,description text not null,role_category text not null default '',
 employment_type text not null default 'full_time',location_city text not null default '',
 salary_range text,contact_info text not null default '{}',source text not null default 'manual',
 status text not null default 'active',created_at timestamptz not null default now(),
 contact_phone text,contact_telegram text,contact_whatsapp text
);
alter table public.job_offers enable row level security;
grant select on public.job_offers to anon,authenticated;
grant all on public.job_offers to service_role;
"""
sql=native+'\n'+ '\n'.join((ROOT/'supabase/migrations'/name).read_text() for name in ['202610300007_super_admin.sql','202610300008_private_resumes.sql','202610300009_general_physicians.sql','20261110170414_job_trust_pipeline_distribution.sql'])+"\nnotify pgrst,'reload schema';"
result=docker('exec','-i',PREFIX+'db','psql','-U','postgres','-v','ON_ERROR_STOP=1',input=sql,check=False)
if result.returncode:print(result.stderr[-2000:]);sys.exit(1)
print('Local migrations 007/008/009 and job lifecycle/pipeline/outbox applied. Migration 010 was not applied.')
