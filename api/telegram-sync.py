"""Supabase Cron invokes this bounded fallback using a single-use bearer token."""
import asyncio
import json
import logging
import re
from http.server import BaseHTTPRequestHandler
from uuid import uuid4

from supabase import create_client
from supabase.lib.client_options import SyncClientOptions
from urllib.parse import urlsplit,urlunsplit
from telegram_scraper import required, channels_from_env
from telegram_sync import scheduled_sync

TOKEN = re.compile(r'^Bearer ([0-9a-f-]{36})$')


def invoke(authorization, factory=create_client, sync=scheduled_sync):
    match = TOKEN.fullmatch(authorization or '')
    if not match:
        return 401, {'error': 'Unauthorized'}
    url=urlsplit(required('SUPABASE_URL'))
    root=urlunsplit((url.scheme,url.netloc,re.sub(r'/(?:rest|auth|storage|functions|realtime)/v1(?:/.*)?$','',url.path.rstrip('/')),'',''))
    db = factory(root, required('SUPABASE_SERVICE_ROLE_KEY'), options=SyncClientOptions(postgrest_client_timeout=20))
    owner = str(uuid4())
    claim = db.rpc('claim_telegram_sync', {'p_token': match[1], 'p_owner': owner}).execute().data
    if claim != 'accepted':
        return (409 if claim == 'busy' else 401), {'error': 'Sync already running' if claim == 'busy' else 'Unauthorized'}
    summary = asyncio.run(sync(db, owner, channels_from_env()))
    return (502 if summary['error'] else 200), summary


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            status, body = invoke(self.headers.get('Authorization'))
        except Exception as exc:
            code=str(getattr(exc,'code','unknown'))
            safe_code=code if re.fullmatch(r'[A-Za-z0-9_]{1,30}',code) else 'unknown'
            logging.error('Telegram sync invocation failed (%s, code=%s)', type(exc).__name__,safe_code)
            status, body = 503, {'error': 'Telegram sync unavailable'}
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        self.send_response(405)
        self.send_header('Allow', 'GET')
        self.end_headers()

    def log_message(self, *args):
        # Do not log request headers or token-bearing data.
        pass
