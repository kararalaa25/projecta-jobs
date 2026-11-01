"""Checkpointed public-preview fallback and persistent Telethon listener.

Only aggregate outcomes are logged. Scheduled runs enqueue before AI extraction,
so failed parsing remains durable independently of channel history checkpoints.
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
    from telegram_pipeline import enqueue_post, retry_io
    counts = {'inserted': 0, 'updated': 0, 'unchanged': 0, 'filtered': 0, 'queued': 0}
    for post in posts:
        # Save even filtered edits: an offer changed into a non-offer must be removed.
        receipt = await retry_io(lambda: enqueue_post(db,post,chat_id,source))
        if receipt['state']=='complete':
            counts['unchanged'] += 1
        else:
            counts['queued'] += 1
    return counts


async def sync_public_channel(db, channel, storage):
    key = str(channel).strip().lower().lstrip('@')
    state = await asyncio.to_thread(lambda: db.table('telegram_sync_checkpoints').select('last_success_at').eq('channel', key).limit(1).execute())
    previous = state.data[0]['last_success_at'] if state.data else None
    # Public previews can expose a post late. Revisit at least 24 hours even
    # when checkpoints are current; stable source IDs make this inexpensive to deduplicate.
    since = min(datetime.fromisoformat(previous.replace('Z', '+00:00')) - timedelta(hours=1), utcnow() - timedelta(days=1)) if previous else utcnow() - timedelta(days=3)
    started = utcnow().isoformat()
    # Never advance a checkpoint on incomplete history, HTTP or database failures.
    for attempt in range(3):
        try:
            chat_id, source, posts = await scraper.fetch_public_posts(channel, None, since, max_pages=200, fresh=True)
            counts = await store_changed_posts(db, posts, chat_id, source, storage)
            counts.update(fetched=len(posts),newest_source_post_at=max((p.date.isoformat() for p in posts),default=None))
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
    from telegram_pipeline import drain_inbox
    gemini = None
    outcomes, pipeline = [], {}
    error = None
    try:
        storage = await asyncio.to_thread(scraper.check_database_schema, db)
        if not scraper.is_native(storage):
            raise ValueError('Scheduled ingestion requires marketplace schema')
        try:
            gemini = scraper.genai.Client(api_key=scraper.required('GEMINI_API_KEY'),
                http_options=scraper.types.HttpOptions(timeout=30000))
        except Exception as exc:
            LOG.warning('Gemini unavailable; extraction will retry (%s)',type(exc).__name__)
        gate = asyncio.Semaphore(3)
        async def sync(channel):
            async with gate:
                return await sync_public_channel(db,channel,storage)
        async with asyncio.timeout(240):
            # Persist all fetched messages before spending the remaining budget on AI.
            # Channel failures do not prevent other channels or queued retries.
            try:
                async with asyncio.timeout(100):
                    outcomes = await asyncio.gather(*(sync(c) for c in channels))
            except TimeoutError:
                error = 'fetch_timeout'
            pipeline = await drain_inbox(gemini,db,storage)
        error = error or ('channel_failure' if any(o['status']=='failed' for o in outcomes) else None)
        if pipeline.get('failed'):
            error = 'inbox_write_failure'
    except Exception as exc:
        error = type(exc).__name__
    finally:
        if gemini:
            await gemini.aio.aclose()
            gemini.close()
    summary = {'channels':len(channels),'completed':sum(o['status']=='complete' for o in outcomes),
        'queued':sum(o.get('queued',0) for o in outcomes),**pipeline,'error':error}
    state = {'lease_owner':None,'lease_until':None,'last_error':error,'last_summary':summary}
    if not error:
        state['last_success_at']=utcnow().isoformat()
    await asyncio.to_thread(lambda:db.table('telegram_sync_control').update(state).eq('id',1).eq('lease_owner',owner).execute())
    LOG.info('Telegram sync complete: %s',summary)
    return summary


async def listen(client, gemini, db, channels, storage, parser='hybrid', catchup_interval=60):
    """Register before catch-up; atomic source receipts serialize competing commits."""
    entities = [await client.get_entity(c) for c in channels]
    sources = {e.id: (getattr(e, 'username', None) or str(e.id)) for e in entities}
    gate = asyncio.Semaphore(3)

    async def ingest(post, chat_id, source):
        async with gate:
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
                await asyncio.to_thread(scraper.replay_outbox, db, storage)
                from telegram_pipeline import drain_inbox
                await drain_inbox(gemini,db,storage,limit=12)
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

    task = None
    try:
        await client.catch_up()
        task = asyncio.create_task(catchup())
        LOG.info('Telegram listener active for %d monitored channels', len(entities))
        await client.run_until_disconnected()
        raise ConnectionError('Telegram listener disconnected')
    finally:
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        client.remove_event_handler(on_message, new_event)
        client.remove_event_handler(on_message, edit_event)
