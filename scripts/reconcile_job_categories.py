"""Prepare a conservative category reconciliation. Read-only unless --apply is explicit.

Only restore a missing physical category from already stored canonical metadata.
No AI calls, post rewriting, invented role/location/salary or moderation changes.
"""
import argparse,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from supabase import create_client
from iraq_taxonomy import ROLE_IDS,CATALOG

def planned_category(row):
    if row.get('role_category'):return None
    try:meta=json.loads(row.get('contact_info') or '{}')
    except (TypeError,ValueError):return None
    if not isinstance(meta,dict):return None
    value=meta.get('role_category')
    value=CATALOG.get('legacyRoles',{}).get(value,value)
    return value if value in ROLE_IDS else None

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true',help='Apply reviewed metadata-only reconciliation; requires owner approval')
    args=parser.parse_args();load_dotenv()
    db=create_client(os.environ['SUPABASE_URL'],os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    scanned=planned=updated=0
    for offset in range(0,100000,500):
        rows=db.table('job_offers').select('id,role_category,contact_info').order('id').range(offset,offset+499).execute().data
        for row in rows:
            scanned+=1;role=planned_category(row)
            if not role:continue
            planned+=1
            if args.apply:
                # Compare metadata to avoid overwriting a concurrent moderation edit.
                query=db.table('job_offers').update({'role_category':role}).eq('id',row['id']).eq('contact_info',row['contact_info'])
                query=query.is_('role_category','null') if row.get('role_category') is None else query.eq('role_category',row['role_category'])
                result=query.execute()
                updated+=len(result.data or [])
        if len(rows)<500:break
    else:raise RuntimeError('Scan limit reached; review pagination before applying more changes')
    print(json.dumps({'mode':'apply' if args.apply else 'read_only','scanned':scanned,'eligible':planned,'updated':updated}))
if __name__=='__main__':main()
