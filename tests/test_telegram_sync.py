import asyncio
import importlib.util
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import telegram_sync as sync
import telegram_scraper as scraper

spec=importlib.util.spec_from_file_location('telegram_sync_api','api/telegram-sync.py')
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)

class SyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_existing_posts_are_skipped_new_ids_ignore_conflicts_and_edits_update(self):
        posts=[SimpleNamespace(id=i,raw_text=f'مطلوب صيدلاني للعمل في بغداد هاتف 07701234567 {i}',date=datetime.now(timezone.utc)) for i in range(1,4)]
        ids=[scraper.native_id(123,'clinic',p.id) for p in posts]
        db=MagicMock();db.table.return_value.select.return_value.in_.return_value.execute.return_value.data=[{'id':ids[0],'description':posts[0].raw_text},{'id':ids[1],'description':'old'}]
        with patch.object(scraper,'store_batch') as store:
            result=await sync.store_changed_posts(db,posts,123,'clinic','native')
        self.assertEqual(result,{'inserted':1,'updated':1,'unchanged':1,'filtered':0})
        self.assertTrue(store.call_args_list[0].args[-1]);self.assertEqual(store.call_args_list[0].args[1][0]['id'],ids[2]);self.assertEqual(store.call_args_list[1].args[1][0]['id'],ids[1])

    async def test_failure_does_not_advance_durable_checkpoint(self):
        db=MagicMock();db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data=[]
        with patch.object(scraper,'fetch_public_posts',AsyncMock(side_effect=TimeoutError)),patch.object(sync.asyncio,'sleep',AsyncMock()):
            result=await sync.sync_public_channel(db,'clinic','native')
        self.assertEqual(result['status'],'failed');db.table.return_value.upsert.assert_not_called()

    async def test_listener_registers_new_messages_and_edits_and_cleans_up(self):
        client=MagicMock();entity=SimpleNamespace(id=123,username='clinic');client.get_entity=AsyncMock(return_value=entity)
        async def disconnected():await asyncio.sleep(0)
        client.run_until_disconnected=disconnected
        with patch.object(scraper,'replay_outbox'),patch.object(scraper,'ingest_message',AsyncMock()),self.assertRaises(ConnectionError):
            await sync.listen(client,None,MagicMock(),['clinic'],'native')
        self.assertEqual(client.add_event_handler.call_count,2);self.assertEqual(client.remove_event_handler.call_count,2)

class AuthTests(unittest.TestCase):
    def test_unauthorized_requests_never_construct_database_client(self):
        client=MagicMock();self.assertEqual(api.invoke(None,client)[0],401);self.assertEqual(api.invoke('Bearer invalid',client)[0],401);client.assert_not_called()
    def test_used_tokens_and_overlapping_runs_do_not_invoke_ingestion(self):
        db=MagicMock();runner=AsyncMock()
        for claim,status in [('invalid',401),('busy',409)]:
            db.rpc.return_value.execute.return_value.data=claim
            with patch.object(api,'required',return_value='test'):
                self.assertEqual(api.invoke('Bearer 11111111-1111-4111-8111-111111111111',lambda *args,**kwargs:db,runner)[0],status)
        runner.assert_not_called()
