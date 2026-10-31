"""Checkpointed public-preview fallback and persistent Telethon listener.

Only aggregate outcomes are logged. Scheduled runs use deterministic local parsing,
so they require neither a Telegram account session nor a Gemini credential.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

import telegram_scraper as scraper
from telethon import events

LOG = logging.getLogger('telegram_sync')


def utcnow():
    return datetime.now(timezone.utc)


async def store_changed_posts(db, posts, chat_id, source, storage):
    counts = {'inserted': 0, 'updated': 0, 'unchanged': 0, 'filtered': 0}
    records = []
    for post in posts:
        if not scraper.raw_job_allowed(post.raw_text):
            counts['filtered'] += 1
            continue
        job = scraper.regex_job(post.raw_text)
        record = scraper.build_record(job, post, chat_id, source) if job else None
        if record is not None and scraper.is_native(storage):
            record = scraper.native_record(record, storage == 'native_contacts')
        if record is None:
            record = scraper.raw_record(post, chat_id, source, storage)
        if storage == 'ingestion':
            record.pop('contact_whatsapp', None)
        records.append(record)
    identity = 'id' if scraper.is_native(storage) else 'telegram_message_id'
    value = 'description' if scraper.is_native(storage) else 'source_text_hash'
    for offset in range(0, len(records), 100):
        chunk = records[offset:offset + 100]
        result = await asyncio.to_thread(lambda: db.table('job_offers').select(f'{identity},{value}').in_(identity, [r[identity] for r in chunk]).execute())
        existing = {r[identity]: r[value] for r in result.data}
        inserts, updates = [], []
        for record in chunk:
            key = record[identity]
            if key not in existing:
                inserts.append(record)
            elif existing[key] == record[value]:
                counts['unchanged'] += 1
            else:
                updates.append(record)
        if inserts:
            await asyncio.to_thread(scraper.store_batch, db, inserts, storage, True)
            counts['inserted'] += len(inserts)
        if updates:
            await asyncio.to_thread(scraper.store_batch, db, updates, storage)
            counts['updated'] += len(updates)
    return counts


async def sync_public_channel(db, channel, storage):
    key = str(channel).strip().lower().lstrip('@')
    state = await asyncio.to_thread(lambda: db.table('telegram_sync_checkpoints').select('last_success_at').eq('channel', key).limit(1).execute())
    previous = state.data[0]['last_success_at'] if state.data else None
    since = datetime.fromisoformat(previous.replace('Z', '+00:00')) - timedelta(hours=1) if previous else utcnow() - timedelta(days=3)
    started = utcnow().isoformat()
    # Never advance a checkpoint on incomplete history, HTTP or database failures.
    for attempt in range(3):
        try:
            chat_id, source, posts = await scraper.fetch_public_posts(channel, None, since, max_pages=200)
            counts = await store_changed_posts(db, posts, chat_id, source, storage)
            await asyncio.to_thread(lambda: db.table('telegram_sync_checkpoints').upsert({'channel': key, 'last_success_at': started, 'counts': counts}, on_conflict='channel').execute())
            return {'status': 'complete', **counts}
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOG.warning('Channel sync attempt failed (%s)', type(exc).__name__)
            if attempt == 2:
                return {'status': 'failed', 'error_type': type(exc).__name__}
            await asyncio.sleep(2 ** attempt)


async def scheduled_sync(db, owner, channels):
    storage = await asyncio.to_thread(scraper.check_database_schema, db)
    gate = asyncio.Semaphore(3)

    async def sync(channel):
        async with gate:
            return await sync_public_channel(db, channel, storage)

    outcomes = []
    error = None
    try:
        async with asyncio.timeout(240):
            outcomes = await asyncio.gather(*(sync(c) for c in channels))
        failures = sum(o['status'] == 'failed' for o in outcomes)
        error = 'channel_failure' if failures else None
    except Exception as exc:
        error = type(exc).__name__
    summary = {'channels': len(channels), 'completed': sum(o['status'] == 'complete' for o in outcomes),
               'inserted': sum(o.get('inserted', 0) for o in outcomes), 'updated': sum(o.get('updated', 0) for o in outcomes), 'error': error}
    state = {'lease_owner': None, 'lease_until': None, 'last_error': error, 'last_summary': summary}
    if not error:
        state['last_success_at'] = utcnow().isoformat()
    # A timed-out/stale invocation cannot release a newer invocation's lease.
    await asyncio.to_thread(lambda: db.table('telegram_sync_control').update(state).eq('id', 1).eq('lease_owner', owner).execute())
    LOG.info('Telegram sync complete: %s', summary)
    return summary


async def listen(client, gemini, db, channels, storage, parser='hybrid', catchup_interval=60):
    """Register handlers before catch-up; shared lock serializes source writes."""
    entities = [await client.get_entity(c) for c in channels]
    sources = {e.id: (getattr(e, 'username', None) or str(e.id)) for e in entities}
    lock = asyncio.Lock()

    async def ingest(post, chat_id, source):
        async with lock:
            for attempt in range(3):
                try:
                    await scraper.ingest_message(gemini, db, post, chat_id, source, False, storage, parser)
                    return True
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    LOG.warning('Live ingestion retry (%s)', type(exc).__name__)
                    if attempt < 2:
                        await asyncio.sleep(2 ** attempt)
                    # ingest_message already persisted failed writes to the outbox.
            return False

    async def on_message(event):
        chat = await event.get_chat()
        await ingest(event.message, chat.id, sources[chat.id])

    new_event, edit_event = events.NewMessage(chats=entities), events.MessageEdited(chats=entities)
    client.add_event_handler(on_message, new_event)
    client.add_event_handler(on_message, edit_event)

    async def catchup():
        while True:
            try:
                async with lock:
                    await asyncio.to_thread(scraper.replay_outbox, db, storage)
                # Checkpoints also cover reconnects/outages beyond the last 100 posts.
                for entity in entities:
                    key = sources[entity.id]
                    state = await asyncio.to_thread(lambda: db.table('telegram_sync_checkpoints').select('last_success_at').eq('channel', key.lower()).limit(1).execute())
                    since = datetime.fromisoformat(state.data[0]['last_success_at'].replace('Z', '+00:00')) - timedelta(hours=1) if state.data else utcnow() - timedelta(days=3)
                    started = utcnow().isoformat()
                    posts = []
                    async for post in client.iter_messages(entity, limit=None):
                        if post.date < since:
                            break
                        posts.append(post)
                    for post in reversed(posts):
                        if not await ingest(post, entity.id, key):
                            raise RuntimeError("Catch-up remains incomplete")
                    # Failed live writes remain in the durable local outbox; replay
                    # above and on the next cycle continues independently of history.
                    await asyncio.to_thread(lambda: db.table('telegram_sync_checkpoints').upsert({'channel': key.lower(), 'last_success_at': started}, on_conflict='channel').execute())
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                LOG.warning('Listener catch-up failed (%s)', type(exc).__name__)
            await asyncio.sleep(catchup_interval)

    task = asyncio.create_task(catchup())
    try:
        LOG.info('Telegram listener active for %d monitored channels', len(entities))
        await client.run_until_disconnected()
        raise ConnectionError('Telegram listener disconnected')
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        client.remove_event_handler(on_message, new_event)
        client.remove_event_handler(on_message, edit_event)
