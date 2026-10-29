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
        self.db.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

    async def test_parse_uses_structured_model(self):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(return_value=SimpleNamespace(text=self.job.model_dump_json()))
        parsed = await scraper.parse_job(client, self.message.raw_text)
        self.assertEqual(parsed.city, 'Baghdad')
        kwargs = client.aio.models.generate_content.call_args.kwargs
        self.assertEqual(kwargs['model'], 'gemini-2.5-flash')
        self.assertIs(kwargs['config'].response_schema, scraper.ParsedJob)

    async def test_invalid_json_is_rejected(self):
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock(return_value=SimpleNamespace(text='not JSON'))
        with self.assertRaises(ValueError):
            await scraper.parse_job(client, self.message.raw_text)

    async def test_upsert_source_identity_and_no_invented_fields(self):
        with patch.object(scraper, 'parse_job', AsyncMock(return_value=self.job)):
            self.assertEqual(await scraper.ingest_message(None, self.db, self.message, 123, 'test_channel'), 'upserted')
        call = self.db.table.return_value.upsert.call_args
        self.assertEqual(call.kwargs['on_conflict'], 'source_chat_id,source_message_id')
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

    def test_channel_configuration(self):
        with patch.dict('os.environ', {'TELEGRAM_CHANNELS': '@clinic, -100123, @clinic'}):
            self.assertEqual(scraper.channels_from_env(), ['@clinic', -100123])


if __name__ == '__main__':
    unittest.main()
