"""Apply the additive job_offers migration using a database credential.

The Supabase service-role API key is not a PostgreSQL password and cannot run DDL.
"""
import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
import psycopg

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--migration', choices=[p.name for p in (ROOT / 'supabase/migrations').glob('*.sql')], default='202610300002_reconcile_job_offers.sql')
    args = parser.parse_args()
    migration = ROOT / 'supabase/migrations' / args.migration
    load_dotenv(ROOT / '.env', override=False)
    url = os.getenv('SUPABASE_DB_URL')
    if not url:
        print('Migration NOT applied: set SUPABASE_DB_URL securely, or run '
              f'{migration.relative_to(ROOT)} in the Supabase SQL editor.')
        return 1
    # Verify the server certificate and hostname. Never print the connection URL.
    try:
        with psycopg.connect(url, sslmode='verify-full', connect_timeout=10, autocommit=True) as db:
            db.execute(migration.read_text())
        print('job_offers migration applied successfully.')
        return 0
    except Exception as exc:
        print(f'Migration failed ({type(exc).__name__}); no credentials or SQL error details logged.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
