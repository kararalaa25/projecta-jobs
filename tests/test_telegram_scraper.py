import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import telegram_scraper as scraper


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.message = SimpleNamespace(id=17, raw_text='مطلوب طبيب اسنان في بغداد',
                                       date=datetime(2026, 10, 30, tzinfo=timezone.utc))
        self.job = scraper.ParsedJob(
            is_job_offer=True, title='طبيب اسنان', company_name=None, city='Baghdad',
            role_category='Dentists', contact_phone=None, contact_telegram=None,
            salary_text=None, employment_type=None)
        self.db = MagicMock()
        self.db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

    async def test_parse_uses_structured_model(self):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(return_value=SimpleNamespace(text=self.job.model_dump_json()))
        parsed = await scraper.parse_job(client, self.message.raw_text)
        self.assertEqual(parsed.city, 'Baghdad')
        kwargs = client.aio.models.generate_content.call_args.kwargs
        self.assertEqual(kwargs['model'], 'gemini-2.5-flash')
        self.assertIsNone(kwargs['config'].response_schema)
        self.assertIsNone(kwargs['config'].response_json_schema)
        self.assertEqual(kwargs['config'].response_mime_type, 'application/json')
        self.assertIn('role_category', kwargs['config'].system_instruction)

    async def test_invalid_json_is_rejected(self):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(return_value=SimpleNamespace(text='not JSON'))
        with self.assertRaises(ValueError):
            await scraper.parse_job(client, self.message.raw_text)

    async def test_upsert_source_identity_and_no_invented_fields(self):
        with patch.object(scraper, 'parse_job', AsyncMock(return_value=self.job)):
            self.assertEqual(await scraper.ingest_message(None, self.db, self.message, 123, 'test_channel'), 'upserted')
        call = self.db.table.return_value.upsert.call_args
        self.assertEqual(call.kwargs['on_conflict'], 'telegram_message_id')
        row = call.args[0]
        self.assertEqual(row['source_url'], 'https://t.me/test_channel/17')
        self.assertEqual(row['source_text_hash'], scraper.text_hash(self.message.raw_text))
        self.assertIsNone(row['contact_phone'])
        self.assertIsNone(row['company_name'])
        self.assertNotIn('is_job_offer', row)

    async def test_duplicate_skips_gemini_and_write(self):
        with patch.object(scraper, 'existing_hash', return_value=scraper.text_hash(self.message.raw_text)), patch.object(scraper, 'parse_job', AsyncMock()) as parse:
            self.assertEqual(await scraper.ingest_message(None, self.db, self.message, 123, 'test'), 'unchanged')
        parse.assert_not_called()
        self.db.table.return_value.upsert.assert_not_called()

    async def test_edited_message_updates_same_identity(self):
        with patch.object(scraper, 'existing_hash', return_value='old'), patch.object(scraper, 'parse_job', AsyncMock(return_value=self.job)):
            self.assertEqual(await scraper.ingest_message(None, self.db, self.message, 123, 'test'), 'upserted')
        row = self.db.table.return_value.upsert.call_args.args[0]
        self.assertEqual((row['source_chat_id'], row['source_message_id']), (123, 17))

    async def test_non_job_skipped_and_edited_offer_removed(self):
        non_job = self.job.model_copy(update={'is_job_offer': False})
        with patch.object(scraper, 'existing_hash', return_value='old'), patch.object(scraper, 'parse_job', AsyncMock(return_value=non_job)):
            self.assertEqual(await scraper.ingest_message(None, self.db, self.message, 123, 'test'), 'not_job')
        self.db.table.return_value.upsert.assert_not_called()
        self.db.table.return_value.delete.assert_called_once()

    async def test_dry_run_never_touches_database(self):
        with patch.object(scraper, 'parse_job', AsyncMock(return_value=self.job)):
            self.assertEqual(await scraper.ingest_message(None, self.db, self.message, 123, 'test', dry_run=True), 'would_upsert')
        self.db.table.assert_not_called()

    async def test_empty_message_skipped(self):
        self.message.raw_text = ''
        with patch.object(scraper, 'parse_job', AsyncMock()) as parse:
            self.assertEqual(await scraper.ingest_message(None, self.db, self.message, 123, 'test'), 'empty')
        parse.assert_not_called()

    def test_invalid_role_rejected(self):
        with self.assertRaises(ValueError):
            scraper.ParsedJob.model_validate({**self.job.model_dump(), 'role_category': 'Other'})

    async def test_model_is_pinned_despite_environment_override(self):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(return_value=SimpleNamespace(text=self.job.model_dump_json()))
        with patch.dict('os.environ', {'GEMINI_MODEL': 'wrong-model'}):
            await scraper.parse_job(client, self.message.raw_text)
        self.assertEqual(client.aio.models.generate_content.call_args.kwargs['model'], 'gemini-2.5-flash')

    async def test_unavailable_model_is_reported_without_fallback(self):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(side_effect=scraper.errors.ClientError(404, {'error': {'message': 'unavailable'}}))
        with self.assertRaises(scraper.errors.ClientError):
            await scraper.parse_job(client, self.message.raw_text)
        self.assertEqual(client.aio.models.generate_content.call_count, 1)

    async def test_native_upsert_only_uses_live_columns(self):
        with patch.object(scraper, 'existing_hash', return_value=None), patch.object(scraper, 'parse_job', AsyncMock(return_value=self.job)):
            result = await scraper.ingest_message(None, self.db, self.message, 123, 'test', storage='native')
        self.assertEqual(result, 'upserted')
        call = self.db.table.return_value.upsert.call_args
        self.assertEqual(call.kwargs['on_conflict'], 'id')
        row = call.args[0]
        self.assertEqual(set(row), {'id','title','role_category','location_city','salary_range','description','source','contact_info'})
        self.assertEqual(row['location_city'], 'Baghdad')
        self.assertEqual(row['description'], self.message.raw_text)
        self.assertEqual(row['id'], scraper.native_id(-123, 'test', 17))

    def test_native_mapping_skips_unknown_city(self):
        record = scraper.build_record(self.job.model_copy(update={'city':None}), self.message, 123, 'test')
        self.assertIsNone(scraper.native_record(record))

    def test_native_schedule_and_metadata(self):
        import json
        job = self.job.model_copy(update={'employment_type':'Full-time','company_name':'Clinic'})
        record = scraper.native_record(scraper.build_record(job, self.message, 123, 'test'))
        self.assertEqual(record['employment_type'], 'full_time')
        self.assertEqual(json.loads(record['contact_info'])['company_name'], 'Clinic')

    async def test_invalid_request_does_not_switch_models(self):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(side_effect=scraper.errors.ClientError(
            400, {'error': {'message': 'invalid request'}}))
        with self.assertRaises(scraper.errors.ClientError):
            await scraper.parse_job(client, self.message.raw_text)
        self.assertEqual(client.aio.models.generate_content.call_count, 1)

    async def test_https_preview_preserves_arabic_and_contacts(self):
        html = '<div class="tgme_widget_message" data-post="clinic/17"><div class="tgme_widget_message_text">مطلوب طبيب<br/>@contact</div><time datetime="2026-10-30T08:00:00Z"></time></div>'
        http = MagicMock()
        http.get = AsyncMock(return_value=SimpleNamespace(text=html, raise_for_status=lambda: None))
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=http)
        cm.__aexit__ = AsyncMock(return_value=None)
        with patch.object(scraper.httpx, 'AsyncClient', return_value=cm):
            cid, source, posts = await scraper.fetch_public_posts('@clinic', 1)
        self.assertEqual(source, 'clinic')
        self.assertEqual(posts[0].raw_text, 'مطلوب طبيب\n@contact')
        self.assertEqual(scraper.message_key(cid, source, 17), scraper.message_key(123, source, 17))
        self.assertEqual(http.get.call_args.args[0], 'https://t.me/s/clinic')

    async def test_private_id_cannot_use_public_https(self):
        with self.assertRaises(ValueError):
            await scraper.fetch_public_posts(-100123, 1)

    async def test_unreadable_public_channel_is_not_success(self):
        http = MagicMock()
        http.get = AsyncMock(return_value=SimpleNamespace(text='<html></html>', raise_for_status=lambda: None))
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=http)
        cm.__aexit__ = AsyncMock(return_value=None)
        with patch.object(scraper.httpx, 'AsyncClient', return_value=cm):
            with self.assertRaises(ValueError):
                await scraper.fetch_public_posts('clinic', 1)

    def test_schema_preflight_rejects_missing_columns(self):
        db = MagicMock()
        db.table.return_value.select.return_value.limit.return_value.execute.side_effect = RuntimeError('missing column')
        with self.assertRaises(RuntimeError):
            scraper.check_database_schema(db)

    def test_message_ids_are_channel_scoped(self):
        self.assertNotEqual(scraper.message_key(1, 'clinic', 17), scraper.message_key(2, 'other', 17))

    def test_channel_configuration(self):
        with patch.dict('os.environ', {'TELEGRAM_CHANNELS': '@clinic, -100123, @clinic'}):
            self.assertEqual(scraper.channels_from_env(), ['@clinic', -100123])


if __name__ == '__main__':
    unittest.main()
