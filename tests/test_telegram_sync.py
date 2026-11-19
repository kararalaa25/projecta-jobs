import asyncio
import importlib.util
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import telegram_sync as sync
import telegram_scraper as scraper
import telegram_pipeline as pipeline

spec=importlib.util.spec_from_file_location('telegram_sync_api','api/telegram-sync.py')
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)

class SyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_posts_are_durable_before_parsing_including_filtered_edits(self):
        posts=[SimpleNamespace(id=i,raw_text='إعلان عام',date=datetime.now(timezone.utc)) for i in range(3)]
        with patch.object(pipeline,'enqueue_post',side_effect=[{'state':'complete'},{'state':'pending'},{'state':'retry'}]) as enqueue:
            result=await sync.store_changed_posts(MagicMock(),posts,123,'clinic','native')
        self.assertEqual(result['queued'],2);self.assertEqual(result['unchanged'],1)
        self.assertEqual(enqueue.call_count,3)

    async def test_failure_does_not_advance_durable_checkpoint(self):
        db=MagicMock();db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data=[]
        with patch.object(scraper,'fetch_public_posts',AsyncMock(side_effect=TimeoutError)),patch.object(sync.asyncio,'sleep',AsyncMock()):
            result=await sync.sync_public_channel(db,'clinic','native')
        self.assertEqual(result['status'],'failed');db.table.return_value.upsert.assert_not_called()

    async def test_recent_checkpoint_revisits_day_for_delayed_preview_posts(self):
        db=MagicMock()
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data=[{'last_success_at':'2026-11-01T00:05:00Z'}]
        now=datetime(2026,11,1,0,10,tzinfo=timezone.utc)
        fetch=AsyncMock(return_value=(123,'clinic',[]))
        with patch.object(sync,'utcnow',return_value=now),patch.object(scraper,'fetch_public_posts',fetch):
            result=await sync.sync_public_channel(db,'@clinic','native')
        self.assertEqual(result['status'],'complete')
        self.assertEqual(fetch.call_args.args[2],datetime(2026,10,31,0,10,tzinfo=timezone.utc))
        self.assertIsNone(fetch.call_args.kwargs['after_id'])
        self.assertTrue(fetch.call_args.kwargs['fresh'])
        checkpoint=db.table.return_value.upsert.call_args.args[0]
        self.assertEqual(checkpoint['counts']['fetched'],0)

    async def test_message_id_cursor_fetches_only_newer_posts(self):
        db=MagicMock()
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data=[
            {'last_success_at':'2026-11-01T00:05:00Z','counts':{},'last_processed_message_id':120}]
        now=datetime(2026,11,1,0,10,tzinfo=timezone.utc)
        posts=[SimpleNamespace(id=121,raw_text='مطلوب طبيب أسنان في بغداد',date=now)]
        fetch=AsyncMock(return_value=(123,'clinic',posts))
        with patch.object(sync,'utcnow',return_value=now),patch.object(scraper,'fetch_public_posts',fetch),\
             patch.object(pipeline,'enqueue_post',return_value={'state':'pending'}):
            result=await sync.sync_public_channel(db,'@clinic','native')
        self.assertEqual(result['status'],'complete')
        self.assertIsNone(fetch.call_args.args[2])
        self.assertEqual(fetch.call_args.kwargs['after_id'],120)
        checkpoint=db.table.return_value.upsert.call_args.args[0]
        self.assertEqual(checkpoint['last_processed_message_id'],121)
        self.assertEqual(checkpoint['counts']['last_processed_message_id'],121)

    async def test_legacy_counts_cursor_still_advances_without_new_column(self):
        db=MagicMock()
        legacy={'last_success_at':'2026-11-01T00:05:00Z','counts':{'last_processed_message_id':120}}
        fetch=AsyncMock(return_value=(123,'clinic',[]))
        with patch.object(sync,'load_checkpoint',AsyncMock(return_value=(legacy,False))),\
             patch.object(scraper,'fetch_public_posts',fetch):
            result=await sync.sync_public_channel(db,'clinic','native')
        self.assertEqual(result['status'],'complete')
        self.assertEqual(fetch.call_args.kwargs['after_id'],120)
        checkpoint=db.table.return_value.upsert.call_args.args[0]
        self.assertNotIn('last_processed_message_id',checkpoint)
        self.assertEqual(checkpoint['counts']['last_processed_message_id'],120)

    async def test_public_preview_stops_at_message_id_cursor(self):
        page_one=''.join(
            f'<div class="tgme_widget_message" data-post="clinic/{mid}">'
            f'<div class="tgme_widget_message_text">مطلوب طبيب أسنان في بغداد</div>'
            f'<time datetime="2026-11-01T00:0{mid-119}:00Z"></time></div>' for mid in (122,121,120))
        page_two=''.join(
            f'<div class="tgme_widget_message" data-post="clinic/{mid}">'
            f'<div class="tgme_widget_message_text">مطلوب طبيب أسنان في بغداد</div>'
            f'<time datetime="2026-11-01T00:00:00Z"></time></div>' for mid in (119,118))
        http=MagicMock();http.get=AsyncMock(side_effect=[
            SimpleNamespace(text=page_one,raise_for_status=lambda:None),
            SimpleNamespace(text=page_two,raise_for_status=lambda:None)])
        context=MagicMock();context.__aenter__=AsyncMock(return_value=http);context.__aexit__=AsyncMock(return_value=None)
        with patch.object(scraper.httpx,'AsyncClient',return_value=context),patch.object(scraper.asyncio,'sleep',AsyncMock()):
            _,_,posts=await scraper.fetch_public_posts('clinic',None,after_id=121)
        self.assertEqual([post.id for post in posts],[122])
        self.assertEqual(http.get.call_count,2)

    async def test_strict_cursor_does_not_advance_on_exhausted_page_budget(self):
        page=lambda mids:''.join(
            f'<div class="tgme_widget_message" data-post="clinic/{mid}">'
            f'<div class="tgme_widget_message_text">مطلوب طبيب أسنان في بغداد</div>'
            f'<time datetime="2026-11-01T00:00:00Z"></time></div>' for mid in mids)
        http=MagicMock();http.get=AsyncMock(side_effect=[
            SimpleNamespace(text=page(mids),raise_for_status=lambda:None) for mids in ([3,2],[1,0])])
        context=MagicMock();context.__aenter__=AsyncMock(return_value=http);context.__aexit__=AsyncMock(return_value=None)
        with patch.object(scraper.httpx,'AsyncClient',return_value=context),patch.object(scraper.asyncio,'sleep',AsyncMock()):
            with self.assertRaisesRegex(ValueError,'page budget'):
                await scraper.fetch_public_posts('clinic',None,after_id=-1,max_pages=2)

    async def test_fresh_preview_requests_change_url_each_polling_window(self):
        html='<div class="tgme_widget_message" data-post="clinic/1"><div class="tgme_widget_message_text">مطلوب صيدلاني للعمل في بغداد</div><time datetime="2026-11-01T00:00:00Z"></time></div>'
        http=MagicMock();http.get=AsyncMock(return_value=SimpleNamespace(text=html,raise_for_status=lambda:None))
        context=MagicMock();context.__aenter__=AsyncMock(return_value=http);context.__aexit__=AsyncMock(return_value=None)
        with patch.object(scraper.httpx,'AsyncClient',return_value=context):
            await scraper.fetch_public_posts('clinic',1,fresh=True)
        self.assertIn('_sync',http.get.call_args.kwargs['params'])
        self.assertEqual(http.get.call_args.kwargs['headers']['Cache-Control'],'no-cache')

    async def test_listener_registers_new_messages_and_edits_and_cleans_up(self):
        client=MagicMock();entity=SimpleNamespace(id=123,username='clinic');client.get_entity=AsyncMock(return_value=entity);client.catch_up=AsyncMock()
        async def disconnected():await asyncio.sleep(0)
        client.run_until_disconnected=disconnected
        with patch.object(scraper,'replay_outbox'),patch.object(scraper,'ingest_message',AsyncMock()),self.assertRaises(ConnectionError):
            await sync.listen(client,None,MagicMock(),['clinic'],'native')
        self.assertEqual(client.add_event_handler.call_count,2);self.assertEqual(client.remove_event_handler.call_count,2)

class AuthTests(unittest.TestCase):
    def test_unauthorized_requests_never_construct_database_client(self):
        client=MagicMock();self.assertEqual(api.invoke(None,client)[0],401);self.assertEqual(api.invoke('Bearer invalid',client)[0],401);client.assert_not_called()
    def test_sync_client_options_and_rest_url_normalization(self):
        db=MagicMock();db.rpc.return_value.execute.return_value.data='invalid'
        def factory(url,key,options):
            self.assertEqual(url,'https://test.supabase.co')
            self.assertTrue(hasattr(options,'storage'))
            self.assertEqual(options.postgrest_client_timeout,20)
            return db
        with patch.object(api,'required',side_effect=lambda name:'https://test.supabase.co/rest/v1' if name=='SUPABASE_URL' else 'test-key'):
            self.assertEqual(api.invoke('Bearer 11111111-1111-4111-8111-111111111111',factory)[0],401)
    def test_used_tokens_and_overlapping_runs_do_not_invoke_ingestion(self):
        db=MagicMock();runner=AsyncMock()
        for claim,status in [('invalid',401),('busy',409)]:
            db.rpc.return_value.execute.return_value.data=claim
            with patch.object(api,'required',return_value='test'):
                self.assertEqual(api.invoke('Bearer 11111111-1111-4111-8111-111111111111',lambda *args,**kwargs:db,runner)[0],status)
        runner.assert_not_called()
