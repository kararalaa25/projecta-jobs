"""Durable message inbox, grounded multi-job extraction and atomic publication.

The inbox is service-role only. Both cron and Telethon use this module; local
outboxes are a secondary recovery aid, never the source of serverless durability.
"""
import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import NAMESPACE_URL, uuid5

import telegram_scraper as scraper

LOG = logging.getLogger('telegram_pipeline')
PARSER_VERSION = 2


async def retry_io(call, attempts=3):
    """Retry transient I/O only; cancellation and permanent data errors propagate."""
    for attempt in range(attempts):
        try:
            return await asyncio.to_thread(call)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            code = str(getattr(exc, 'code', ''))
            transient = isinstance(exc, (OSError, TimeoutError, scraper.httpx.TransportError)) or code in {'429','500','502','503','504','40001','40P01','57014'} or code.startswith('08')
            if not transient or attempt == attempts - 1:
                raise
            await asyncio.sleep(2 ** attempt)


def enqueue_post(db, post, chat_id, channel):
    """One RPC makes receipt creation/edit ordering atomic across workers."""
    now = datetime.now(timezone.utc).isoformat()
    return db.rpc('enqueue_telegram_message', {'p_message': {
        'message_key': scraper.message_key(chat_id, channel, post.id),
        'chat_id': chat_id, 'channel': channel.lower().lstrip('@'),
        'message_id': post.id, 'raw_text': post.raw_text or '',
        'posted_at': post.date.isoformat(),
        'observed_at': getattr(post, 'observed_at', now),
        'source_hash': scraper.text_hash(post.raw_text or ''),
    }, 'p_parser_version': PARSER_VERSION}).execute().data


def fallback_post(text):
    """Conservative splitting of explicit numbered job sections during AI outages.

    Responsibility/qualification bullets are not offers. Unstructured compilations
    remain raw and pending AI; they are never silently marked fully parsed.
    """
    starts = []
    for match in re.finditer(r'(?m)^\s*(?:[0-9٠-٩۰-۹]{1,3}\s*[.)\-–:ـ]|[①-⑳]|[🔹🔸▪•])\s*([^\n]+)', text):
        heading = match.group(1)
        if scraper.classify_roles(heading) and not re.search(r'سنوات|خبرة|شروط|مهام|years|experience|requirements', heading, re.I):
            starts.append(match.start())
    sections = [text[a:b].strip() for a,b in zip(starts, starts[1:] + [len(text)])] if len(starts) > 1 else [text.strip()]
    shared = [text[:starts[0]].strip()] if len(starts) > 1 and text[:starts[0]].strip() else []
    jobs = []
    for section in sections:
        job = scraper.regex_job(section)
        # Explicit job-list headers may put "مطلوب" only in the common intro.
        if job is None and len(starts)>1 and scraper.raw_job_allowed(text):
            job = scraper.regex_job('مطلوب للعمل\n' + section)
        if job:
            jobs.append(scraper.ExtractedJob(**job.model_dump(),source_text=section))
    return scraper.ParsedPost(jobs=jobs, shared_context=shared)


def job_records(parsed, message, chat_id, channel, storage, fallback=False):
    """Scope contacts, classification and locations to one offer + common context."""
    records, seen = [], set()
    common = '\n'.join(parsed.shared_context)
    common_contacts = scraper.extract_contacts(common)
    for job in parsed.jobs:
        if not job.is_job_offer:
            continue
        section = job.source_text.strip()
        scope = section + '\n' + common
        local = scraper.extract_contacts(section)
        contacts = {key: local[key] or common_contacts[key] for key in local}
        roles = scraper.classify_roles(job.title or '')
        role = roles[0] if len(roles)==1 else job.role_category
        if not role or not job.title or not job.title.strip():
            continue
        places = scraper.locations(section) or scraper.locations(common)
        city = places[0] if places else (job.city if job.city in [g['id'] for g in scraper.GOVERNORATES] else '')
        description = section + ('\n\n' + common if common else '')
        # Don't multiply identical extractions, but keep same-role distinct offers.
        fingerprint = (job.title.strip(),section,role)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        index = len(records)
        base = scraper.native_id(chat_id,channel,message.id)
        identity = base if index==0 else str(uuid5(NAMESPACE_URL,f'projecta-jobs:telegram:{scraper.message_key(chat_id,channel,message.id)}:job:{index+1}'))
        schedule = scraper.employment_type(section) or scraper.employment_type(common) or job.employment_type
        # Marketplace constraint uses locum_temp for contract/internship, not contract.
        native_schedule = {'Full-time':'full_time','Part-time':'part_time','Contract':'locum_temp','Internship':'locum_temp'}.get(schedule)
        meta = {'phone':contacts['contact_phone'],'whatsapp':contacts['contact_whatsapp'],'telegram':contacts['contact_telegram'],
                'company_name':job.company_name if job.company_name and job.company_name in scope else None,'source_url':f'https://t.me/{channel}/{message.id}' if not channel.lstrip('-').isdigit() else f'https://t.me/c/{str(chat_id).removeprefix("-100")}/{message.id}',
                'telegram_message_id':scraper.message_key(chat_id,channel,message.id),'source_message_key':scraper.message_key(chat_id,channel,message.id),
                'source_text_hash':scraper.text_hash(message.raw_text),'source_posted_at':message.date.isoformat(),
                'role_category':role,'role_categories':[role],'governorate':city or None,'governorates':places or ([city] if city else []),
                'employment_type':schedule,'parsing_status':'retry' if fallback else 'parsed','parser_version':PARSER_VERSION,'job_index':index+1}
        records.append({'id':identity,'title':job.title.strip(),'description':description,'role_category':role,
                        'location_city':city or '', 'salary_range':job.salary_text if job.salary_text and job.salary_text in scope else None,'employment_type':native_schedule,
                        'source':'telegram','created_at':message.date.isoformat(),'contact_info':json.dumps(meta,ensure_ascii=False),
                        **scraper.native_contact_fields(contacts,storage)})
    return records


def commit_jobs(db, receipt, records, retry=False, error=None):
    return db.rpc('commit_telegram_jobs', {'p_message_key':receipt['message_key'],
        'p_source_hash':receipt['source_hash'],'p_records':records,'p_parser_version':PARSER_VERSION,
        'p_retry':retry,'p_error_type':error,
        'p_legacy_id':scraper.native_id(receipt['chat_id'],receipt['channel'],receipt['message_id'])}).execute().data


async def process_receipt(gemini, db, receipt, storage, parser='hybrid'):
    message = SimpleNamespace(id=receipt['message_id'],raw_text=receipt['raw_text'],date=datetime.fromisoformat(receipt['posted_at'].replace('Z','+00:00')))
    records, fallback, error = [], False, None
    # A course in one section must not suppress an entire multi-offer compilation.
    if message.raw_text.strip() and len(message.raw_text.strip())>=20:
        try:
            if parser=='regex':
                parsed = fallback_post(message.raw_text)
                fallback = True  # Explicit regex mode still leaves AI enrichment pending.
            else:
                parsed = await scraper.parse_jobs(gemini,message.raw_text)
            if any(j.is_job_offer and (not j.role_category or not j.title or not j.title.strip()) for j in parsed.jobs):
                raise ValueError('Incomplete extracted offering')
            records = job_records(parsed,message,receipt['chat_id'],receipt['channel'],storage,fallback)
            if any(j.is_job_offer for j in parsed.jobs) and not records:
                raise ValueError('No valid grounded offerings')
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            fallback,error = True,type(exc).__name__
            records = job_records(fallback_post(message.raw_text),message,receipt['chat_id'],receipt['channel'],storage,True)
            # Keep the original readable while AI is unavailable, without marking complete.
            if not records and scraper.raw_job_allowed(message.raw_text):
                record = scraper.raw_record(message,receipt['chat_id'],receipt['channel'],storage)
                records=[record]
            LOG.warning('AI extraction pending retry (%s)',error)
    result = await retry_io(lambda:commit_jobs(db,receipt,records,fallback,error))
    return {'outcome':result,'jobs':len(records) if result not in {'unchanged','superseded'} else 0,'retry':fallback}


async def ingest_native_message(gemini, db, message, chat_id, channel, dry_run=False, storage='native', parser='hybrid'):
    if not message.raw_text or not message.raw_text.strip():
        return 'empty'
    if dry_run:
        try:
            parsed = fallback_post(message.raw_text) if parser=='regex' else await scraper.parse_jobs(gemini,message.raw_text)
            return 'would_upsert' if job_records(parsed,message,chat_id,channel,storage,parser=='regex') else 'not_job'
        except Exception:
            return 'would_upsert_raw' if scraper.raw_job_allowed(message.raw_text) else 'not_job' 
    try:
        receipt = await retry_io(lambda:enqueue_post(db,message,chat_id,channel))
    except Exception:
        # Persistent workers have a private disk outbox as a second recovery path.
        # Cron does not advance its source checkpoint when enqueueing fails.
        await asyncio.to_thread(scraper.queue_record,scraper.raw_record(message,chat_id,channel,storage),storage)
        raise
    if receipt['state']=='complete' or datetime.fromisoformat(receipt['next_attempt_at'].replace('Z','+00:00'))>datetime.now(timezone.utc):
        return 'unchanged'
    result = await process_receipt(gemini,db,receipt,storage,parser)
    return 'upserted_raw' if result['retry'] else ('upserted' if result['jobs'] else 'not_job')


async def drain_inbox(gemini, db, storage, limit=24):
    now = datetime.now(timezone.utc).isoformat()
    # Reserve retry capacity so old failures cannot be starved by a busy channel.
    retries = await retry_io(lambda:db.table('telegram_ingestion_messages').select('*').eq('state','retry').lte('next_attempt_at',now).order('next_attempt_at').limit(6).execute())
    pending = await retry_io(lambda:db.table('telegram_ingestion_messages').select('*').eq('state','pending').lte('next_attempt_at',now).order('posted_at',desc=True).limit(limit).execute())
    gate=asyncio.Semaphore(3)
    async def process(receipt):
        async with gate:
            try:
                return await process_receipt(gemini,db,receipt,storage)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                LOG.warning('Inbox write remains pending (%s)',type(exc).__name__)
                return {'outcome':'failed','jobs':0,'retry':True}
    outcomes=await asyncio.gather(*(process(r) for r in retries.data+pending.data))
    return {'processed':len(outcomes),'jobs':sum(o['jobs'] for o in outcomes),
            'retrying':sum(o['retry'] for o in outcomes),'failed':sum(o['outcome']=='failed' for o in outcomes)}
