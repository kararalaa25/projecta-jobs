import asyncio
import json
import unittest
from datetime import datetime,timezone
from types import SimpleNamespace
from unittest.mock import MagicMock,AsyncMock,patch

import telegram_scraper as scraper
import telegram_pipeline as pipeline
import telegram_sync as sync


def offer(section,role='Dentists',title='طبيب أسنان',**extra):
    return scraper.ExtractedJob(is_job_offer=True,title=title,role_category=role,
        source_text=section,city=None,company_name=None,contact_phone=None,
        contact_telegram=None,salary_text=None,employment_type=None,**extra)


def receipt(text):
    return {'message_key':'clinic:17','message_id':17,'chat_id':123,'channel':'clinic',
        'raw_text':text,'source_hash':scraper.text_hash(text),'posted_at':'2026-11-01T00:00:00Z',
        'state':'pending','next_attempt_at':'2020-01-01T00:00:00Z'}


class ExtractionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.message=SimpleNamespace(id=17,raw_text='',date=datetime(2026,11,1,tzinfo=timezone.utc))

    async def test_five_and_twelve_offers_become_separate_records_and_source_links(self):
        for count in [5,12]:
            sections=[f'{i+1}. مطلوب طبيب أسنان في بغداد لعيادة رقم {i+1}' for i in range(count)]
            self.message.raw_text='\n'.join(sections)
            parsed=scraper.ParsedPost(jobs=[offer(s) for s in sections])
            client=MagicMock();client.aio.models.generate_content=AsyncMock(return_value=SimpleNamespace(text=parsed.model_dump_json()))
            with patch.object(scraper,'discover_models',AsyncMock(return_value=['gemini-test'])):
                extracted=await scraper.parse_jobs(client,self.message.raw_text)
            records=pipeline.job_records(extracted,self.message,123,'clinic','native_contacts')
            self.assertEqual(len(records),count);self.assertEqual(len({r['id'] for r in records}),count)
            self.assertEqual(records,pipeline.job_records(extracted,self.message,-999,'clinic','native_contacts'))
            for row,section in zip(records,sections):
                self.assertEqual(row['description'],section)
                self.assertEqual(json.loads(row['contact_info'])['source_url'],'https://t.me/clinic/17')
                self.assertEqual(row['created_at'],self.message.date.isoformat())

    async def test_partial_numbered_list_is_rejected_for_retry(self):
        sections=[f'{i}. مطلوب طبيب أسنان في بغداد للعيادة رقم {i}' for i in range(1,13)]
        text='\n'.join(sections)
        with patch.object(scraper,'_parse_schema',AsyncMock(return_value=scraper.ParsedPost(jobs=[offer(sections[0])]))):
            with self.assertRaisesRegex(ValueError,'missing'):
                await scraper.parse_jobs(None,text)

    async def test_whole_compilation_cannot_be_one_job_description(self):
        text='1. مطلوب طبيب أسنان في بغداد\n2. مطلوب صيدلاني في البصرة'
        with patch.object(scraper,'_parse_schema',AsyncMock(return_value=scraper.ParsedPost(jobs=[offer(text)]))):
            with self.assertRaisesRegex(ValueError,'multiple numbered'):
                await scraper.parse_jobs(None,text)

    async def test_source_order_keeps_job_ids_stable_when_ai_reorders_jobs(self):
        a='1. مطلوب طبيب أسنان في بغداد'
        b='2. مطلوب صيدلاني في البصرة'
        self.message.raw_text=a+'\n'+b
        first=scraper.ParsedPost(jobs=[offer(a),offer(b,'Pharmacists','صيدلاني')])
        reversed_post=scraper.ParsedPost(jobs=list(reversed(first.jobs)))
        self.assertEqual(pipeline.job_records(first,self.message,123,'clinic','native'),
                         pipeline.job_records(reversed_post,self.message,123,'clinic','native'))
        with patch.object(scraper,'_parse_schema',AsyncMock(return_value=reversed_post)):
            parsed=await scraper.parse_jobs(None,self.message.raw_text)
        self.assertEqual([j.source_text for j in parsed.jobs],[a,b])

    def test_duplicate_ai_titles_do_not_multiply_the_same_offer(self):
        section='مطلوب طبيب أسنان للعمل في بغداد'
        self.message.raw_text=section
        a=offer(section);b=a.model_copy(update={'title':'فرصة عمل لطبيب أسنان'})
        rows=pipeline.job_records(scraper.ParsedPost(jobs=[a,b]),self.message,123,'clinic','native')
        self.assertEqual(len(rows),1)

    def test_shared_footer_contacts_reach_all_fallback_jobs(self):
        footer='للتقديم لجميع الوظائف واتساب 07701234567 @shared_jobs'
        text='فرص عمل في بغداد\n1. مطلوب طبيب أسنان\n2. مطلوب صيدلاني\n'+footer
        self.message.raw_text=text
        parsed=pipeline.fallback_post(text)
        rows=pipeline.job_records(parsed,self.message,123,'clinic','native_contacts',True)
        self.assertEqual(len(rows),2)
        for row in rows:
            self.assertEqual(row['contact_whatsapp'],'9647701234567')
            self.assertEqual(row['contact_telegram'],'shared_jobs')
            self.assertEqual(row['description'].count(footer),1)

    def test_unlabeled_last_section_phone_is_not_shared_by_fallback(self):
        text='فرص عمل في بغداد\n1. مطلوب طبيب أسنان\n2. مطلوب صيدلاني هاتف 07801234567'
        self.message.raw_text=text
        rows=pipeline.job_records(pipeline.fallback_post(text),self.message,123,'clinic','native_contacts',True)
        self.assertIsNone(rows[0]['contact_phone']);self.assertEqual(rows[1]['contact_phone'],'07801234567')

    def test_hiring_heading_with_experience_remains_a_distinct_offer(self):
        text='1. مطلوب طبيب أسنان خبرة سنتين في بغداد\n2. مطلوب صيدلاني خبرة سنة في البصرة'
        self.assertEqual(len(pipeline.fallback_post(text).jobs),2)

    def test_source_urls_normalize_usernames_and_private_channel_ids(self):
        self.assertEqual(scraper.telegram_source_url(123,'@Clinic_Jobs',17),'https://t.me/clinic_jobs/17')
        self.assertEqual(scraper.telegram_source_url(-1001234567890,'-1001234567890',17),'https://t.me/c/1234567890/17')
        self.assertIsNone(scraper.telegram_source_url(0,'0',17))

    def test_section_contacts_locations_and_roles_never_bleed_into_siblings(self):
        common='العمل في بغداد. للتقديم واتساب 07701234567 @shared_jobs'
        a='مطلوب طبيب أسنان في البصرة هاتف 07801234567 @dentist_jobs'
        b='مطلوب صيدلاني للعمل بدوام جزئي'
        self.message.raw_text=common+'\n'+a+'\n'+b
        parsed=scraper.ParsedPost(shared_context=[common],jobs=[offer(a),offer(b,'Pharmacists','صيدلاني')])
        rows=pipeline.job_records(parsed,self.message,123,'clinic','native_contacts')
        first,second=[json.loads(r['contact_info']) for r in rows]
        self.assertEqual(first['phone'],'07801234567');self.assertEqual(second['phone'],'07701234567')
        self.assertEqual(first['telegram'],'dentist_jobs');self.assertEqual(second['telegram'],'shared_jobs')
        self.assertEqual(second['whatsapp'],'9647701234567')
        self.assertEqual(rows[0]['location_city'],'Basra');self.assertEqual(rows[1]['location_city'],'Baghdad')
        self.assertEqual(second['role_categories'],['Pharmacists']);self.assertEqual(first['role_categories'],['Dentists'])
        self.assertEqual(rows[1]['employment_type'],'part_time')
        self.assertNotIn(a,rows[1]['description'])

    def test_local_phone_does_not_inherit_another_listings_whatsapp(self):
        a='مطلوب طبيب أسنان في بغداد واتساب 07701234567'
        b='مطلوب صيدلاني في البصرة هاتف 07801234567'
        self.message.raw_text=a+'\n'+b
        rows=pipeline.job_records(scraper.ParsedPost(jobs=[offer(a),offer(b,'Pharmacists','صيدلاني')]),self.message,123,'clinic','native_contacts')
        self.assertIsNone(rows[1]['contact_whatsapp']);self.assertEqual(rows[1]['contact_phone'],'07801234567')

    def test_model_cannot_invent_contacts_and_duplicate_extractions_are_collapsed(self):
        section='مطلوب طبيب أسنان للعمل في عيادة خاصة'
        self.message.raw_text=section
        job=offer(section).model_copy(update={'contact_phone':'07701234567','contact_whatsapp':'9647701234567','contact_telegram':'invented_jobs','salary_text':'1000000'})
        rows=pipeline.job_records(scraper.ParsedPost(jobs=[job,job]),self.message,123,'clinic','native_contacts')
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['location_city'],'')
        self.assertIsNone(rows[0]['contact_phone']);self.assertIsNone(rows[0]['contact_whatsapp']);self.assertIsNone(rows[0]['contact_telegram']);self.assertIsNone(rows[0]['salary_range'])

    async def test_ungrounded_excerpts_and_cross_listing_shared_context_are_rejected(self):
        for parsed in [scraper.ParsedPost(jobs=[offer('invented')]),scraper.ParsedPost(jobs=[offer('مطلوب طبيب أسنان في بغداد')],shared_context=['في بغداد'])]:
            with patch.object(scraper,'_parse_schema',AsyncMock(return_value=parsed)),self.assertRaises(ValueError):
                await scraper.parse_jobs(None,'مطلوب طبيب أسنان في بغداد')

    def test_same_role_different_offers_and_headcount_are_preserved_correctly(self):
        a='مطلوب 12 طبيب أسنان للعمل في بغداد'
        self.message.raw_text=a
        self.assertEqual(len(pipeline.job_records(scraper.ParsedPost(jobs=[offer(a)]),self.message,123,'clinic','native')),1)
        b='مطلوب طبيب أسنان للعمل في البصرة'
        self.message.raw_text=a+'\n'+b
        self.assertEqual(len(pipeline.job_records(scraper.ParsedPost(jobs=[offer(a),offer(b)]),self.message,123,'clinic','native')),2)

    def test_regex_fallback_splits_explicit_jobs_but_not_qualification_bullets(self):
        text='فرص عمل في بغداد للتقديم واتساب 07701234567\n1. مطلوب طبيب أسنان\n2. مطلوب صيدلاني\n3. مطلوب ممرض'
        self.assertEqual(len(pipeline.fallback_post(text).jobs),3)
        text='مطلوب طبيب أسنان في بغداد\n1. خبرة طبيب أسنان خمس سنوات\n2. مهام طبيب أسنان اليومية'
        self.assertEqual(len(pipeline.fallback_post(text).jobs),1)

    def test_whatsapp_links_and_temporary_schedule_mapping(self):
        self.assertEqual(scraper.extract_contacts('التقديم https://wa.me/9647701234567')['contact_whatsapp'],'9647701234567')
        section='مطلوب طبيب أسنان بعقد مؤقت في بغداد'
        self.message.raw_text=section
        row=pipeline.job_records(scraper.ParsedPost(jobs=[offer(section).model_copy(update={'employment_type':'Contract'})]),self.message,123,'clinic','native')[0]
        self.assertEqual(row['employment_type'],'locum_temp')


class ReliabilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_unchanged_complete_receipt_skips_ai_and_writes(self):
        r=receipt('مطلوب طبيب أسنان في بغداد');r['state']='complete'
        post=SimpleNamespace(id=17,raw_text=r['raw_text'],date=datetime.now(timezone.utc))
        with patch.object(pipeline,'enqueue_post',return_value=r),patch.object(scraper,'parse_jobs',AsyncMock()) as parse,patch.object(pipeline,'commit_jobs') as commit:
            self.assertEqual(await pipeline.ingest_native_message(None,MagicMock(),post,123,'clinic'),'unchanged')
        parse.assert_not_called();commit.assert_not_called()

    async def test_ai_failure_commits_fallback_with_retry_not_completion(self):
        r=receipt('مطلوب طبيب أسنان في بغداد هاتف 07701234567')
        with patch.object(scraper,'parse_jobs',AsyncMock(side_effect=TimeoutError())),patch.object(pipeline,'commit_jobs',return_value='retry') as commit:
            result=await pipeline.process_receipt(None,MagicMock(),r,'native')
        self.assertTrue(result['retry']);self.assertTrue(commit.call_args.args[3]);self.assertEqual(commit.call_args.args[4],'TimeoutError')

    async def test_partial_invalid_extraction_is_retried_instead_of_silently_dropped(self):
        text='مطلوب طبيب أسنان وصيدلاني للعمل في بغداد'
        partial=scraper.ParsedPost(jobs=[offer(text),offer(text,'Pharmacists','صيدلاني').model_copy(update={'role_category':None})])
        with patch.object(scraper,'parse_jobs',AsyncMock(return_value=partial)),patch.object(pipeline,'commit_jobs',return_value='retry'):
            result=await pipeline.process_receipt(None,MagicMock(),receipt(text),'native')
        self.assertTrue(result['retry'])

    async def test_nonoffer_edit_commits_empty_group_for_atomic_removal(self):
        with patch.object(scraper,'parse_jobs',AsyncMock(return_value=scraper.ParsedPost(jobs=[]))),patch.object(pipeline,'commit_jobs',return_value='complete') as commit:
            await pipeline.process_receipt(None,MagicMock(),receipt('تم إغلاق جميع فرص العمل المذكورة في هذا الإعلان'),'native')
        self.assertEqual(commit.call_args.args[2],[]);self.assertFalse(commit.call_args.args[3])

    async def test_transient_database_errors_retry_permanent_errors_do_not(self):
        call=MagicMock(side_effect=[TimeoutError(),TimeoutError(),'ok'])
        with patch.object(pipeline.asyncio,'sleep',AsyncMock()):
            self.assertEqual(await pipeline.retry_io(call),'ok')
        self.assertEqual(call.call_count,3)
        call=MagicMock(side_effect=ValueError())
        with self.assertRaises(ValueError):await pipeline.retry_io(call)
        self.assertEqual(call.call_count,1)

    async def test_cancellation_never_commits_fallback_or_swallows_shutdown(self):
        with patch.object(scraper,'parse_jobs',AsyncMock(side_effect=asyncio.CancelledError())),patch.object(pipeline,'commit_jobs') as commit:
            with self.assertRaises(asyncio.CancelledError):await pipeline.process_receipt(None,MagicMock(),receipt('مطلوب طبيب أسنان في بغداد'),'native')
        commit.assert_not_called()

    async def test_old_due_retries_have_reserved_capacity(self):
        db=MagicMock()
        db.table.return_value.select.return_value.eq.return_value.lte.return_value.order.return_value.limit.return_value.execute.side_effect=[SimpleNamespace(data=[receipt('old')]),SimpleNamespace(data=[receipt('new')])]
        with patch.object(pipeline,'process_receipt',AsyncMock(return_value={'outcome':'complete','jobs':1,'retry':False})) as process:
            result=await pipeline.drain_inbox(None,db,'native')
        self.assertEqual(result['processed'],2);self.assertEqual(process.call_count,2)

    async def test_processing_budget_defers_receipts_without_failing_sync(self):
        db=MagicMock()
        db.table.return_value.select.return_value.eq.return_value.lte.return_value.order.return_value.limit.return_value.execute.side_effect=[SimpleNamespace(data=[]),SimpleNamespace(data=[receipt('new')])]
        async def blocked(*args):await asyncio.Event().wait()
        with patch.object(pipeline,'process_receipt',side_effect=blocked):
            result=await pipeline.drain_inbox(None,db,'native',budget_seconds=.01)
        self.assertEqual(result['deferred'],1);self.assertEqual(result['failed'],0);self.assertEqual(result['processed'],0)

    async def test_schema_failure_releases_only_owned_schedule_lease(self):
        db=MagicMock()
        with patch.object(scraper,'check_database_schema',side_effect=RuntimeError()):
            result=await sync.scheduled_sync(db,'owner',['clinic'])
        self.assertEqual(result['error'],'RuntimeError')
        db.table.return_value.update.return_value.eq.return_value.eq.assert_called_once_with('lease_owner','owner')
        self.assertNotIn('last_success_at',db.table.return_value.update.call_args.args[0])
