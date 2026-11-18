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

    async def test_clean_sync_records_success_and_releases_only_owned_lease(self):
        db=MagicMock()
        clean={'processed':0,'jobs':0,'retrying':0,'failed':0,'deferred':0,'review_held':0}
        with patch.object(scraper,'check_database_schema',return_value='native'), \
             patch.object(scraper,'required',side_effect=RuntimeError('Gemini unavailable')), \
             patch.object(sync,'sync_public_channel',AsyncMock(return_value={'status':'complete','queued':0})), \
             patch.object(pipeline,'drain_inbox',AsyncMock(return_value=clean)):
            result=await sync.scheduled_sync(db,'owner',['clinic'])
        self.assertIsNone(result['error'])
        state=db.table.return_value.update.call_args.args[0]
        self.assertIn('last_success_at',state)
        self.assertIsNone(state['lease_owner'])
        self.assertIsNone(state['lease_until'])
        self.assertIsNone(state['last_error'])
        db.table.return_value.update.return_value.eq.return_value.eq.assert_called_once_with('lease_owner','owner')


class OptionBPipelineTests(unittest.IsolatedAsyncioTestCase):
    """Synthetic classification, hold and pending-publication regressions."""

    def mixed_post(self):
        vacancy = 'مطلوب طبيب أسنان للعمل في عيادة ببغداد'
        sale = 'يوجد كرسي أسنان للبيع'
        return vacancy + '. كذلك ' + sale + '.', scraper.ParsedPost(jobs=[
            scraper.ExtractedJob(is_job_offer=True, title='طبيب أسنان', role_category='Dentists',
                source_text=vacancy, disposition='job_offer', company_name=None, city=None,
                contact_phone=None, contact_telegram=None, salary_text=None, employment_type=None),
            scraper.ExtractedJob(is_job_offer=False, title='كرسي أسنان', role_category=None,
                source_text=sale, disposition='marketplace_item', company_name=None, city=None,
                contact_phone=None, contact_telegram=None, salary_text=None, employment_type=None),
        ], classification='mixed', needs_review=True, review_reasons=['mixed_content'])

    def with_jobs(self, text, count=1):
        result = receipt(text)
        result['job_ids'] = [f'00000000-0000-4000-8000-{i + 1:012d}' for i in range(count)]
        return result

    async def test_mixed_post_publishes_only_vacancy_as_pending(self):
        text, parsed = self.mixed_post()
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=parsed)), \
             patch.object(pipeline, 'commit_jobs', return_value='complete') as commit:
            result = await pipeline.process_receipt(None, MagicMock(), receipt(text), 'native')
        self.assertEqual(len(commit.call_args.args[2]), 1)
        self.assertEqual(commit.call_args.args[2][0]['role_category'], 'Dentists')
        self.assertEqual(commit.call_args.kwargs['initial_status'], 'pending')
        self.assertTrue(result['needs_review'])

    async def test_clean_single_job_uses_active_commit_without_pending_status(self):
        text = 'مطلوب طبيب أسنان للعمل في عيادة ببغداد'
        parsed = scraper.ParsedPost(jobs=[offer(text)], classification='job_offer',
            needs_review=False, review_reasons=[])
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=parsed)), \
             patch.object(pipeline, 'commit_jobs', return_value='complete') as commit:
            result = await pipeline.process_receipt(None, MagicMock(), receipt(text), 'native')
        self.assertEqual(len(commit.call_args.args[2]), 1)
        self.assertIsNone(commit.call_args.kwargs.get('initial_status'))
        self.assertNotEqual(result.get('reason'), 'held')

    async def test_ambiguous_non_mixed_announcement_routes_to_pending(self):
        text = 'فرصة عمل طبية في بغداد — التفاصيل غير واضحة'
        parsed = scraper.ParsedPost(jobs=[offer(text)], classification='job_offer',
            needs_review=True, review_reasons=['unknown_specialty'])
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=parsed)), \
             patch.object(pipeline, 'commit_jobs', return_value='complete') as commit:
            result = await pipeline.process_receipt(None, MagicMock(), receipt(text), 'native')
        self.assertEqual(len(commit.call_args.args[2]), 1)
        self.assertEqual(commit.call_args.kwargs['initial_status'], 'pending')
        self.assertTrue(result['needs_review'])

    def test_commit_jobs_routes_pending_without_downgrading_to_old_rpc(self):
        db, row = MagicMock(), receipt('synthetic')
        pipeline.commit_jobs(db, row, [{'id': 'x'}], initial_status='pending')
        self.assertEqual(db.rpc.call_args.args[0], pipeline.PENDING_RPC)
        self.assertEqual(db.rpc.call_args.args[1]['p_initial_status'], 'pending')
        db.reset_mock()
        pipeline.commit_jobs(db, row, [])
        self.assertEqual(db.rpc.call_args.args[0], 'commit_telegram_jobs')
        self.assertNotIn('p_initial_status', db.rpc.call_args.args[1])

    async def test_missing_pending_rpc_holds_without_calling_old_rpc(self):
        text, parsed = self.mixed_post()
        unavailable = RuntimeError('PGRST202 function not found')
        unavailable.code = 'PGRST202'
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=parsed)), \
             patch.object(pipeline, 'commit_jobs', side_effect=unavailable) as commit, \
             patch.object(pipeline, 'hold_receipt') as hold:
            result = await pipeline.process_receipt(None, MagicMock(), receipt(text), 'native')
        self.assertEqual(result['outcome'], 'held')
        self.assertEqual(result['reason'], 'pending_rpc_unavailable')
        self.assertEqual(commit.call_count, 1)
        hold.assert_called_once()

    async def test_existing_jobs_survive_uncertain_reclassification(self):
        row = self.with_jobs('مطلوب طبيب أسنان في بغداد')
        parsed = scraper.ParsedPost(jobs=[], classification='marketplace_item')
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=parsed)), \
             patch.object(pipeline, 'hold_receipt') as hold, \
             patch.object(pipeline, 'commit_jobs') as commit:
            result = await pipeline.process_receipt(None, MagicMock(), row, 'native')
        self.assertEqual(result['reason'], 'nonoffer_reclassification')
        hold.assert_called_once()
        commit.assert_not_called()

    async def test_explicit_full_closure_still_commits_atomic_removal(self):
        text = 'تم إغلاق جميع فرص العمل المذكورة في هذا الإعلان'
        row = self.with_jobs(text)
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=scraper.ParsedPost(jobs=[]))), \
             patch.object(pipeline, 'published_source_hashes', return_value={'older-hash'}), \
             patch.object(pipeline, 'hold_receipt') as hold, \
             patch.object(pipeline, 'commit_jobs', return_value='complete') as commit:
            await pipeline.process_receipt(None, MagicMock(), row, 'native')
        self.assertEqual(commit.call_args.args[2], [])
        self.assertFalse(commit.call_args.args[3])
        self.assertIsNone(commit.call_args.kwargs['initial_status'])
        hold.assert_not_called()

    async def test_negated_or_single_closure_is_held_not_deleted(self):
        cases = [('تم إغلاق الباب، لكن لم يُغلق الإعلان', 1), ('تم إغلاق فرصة طبيب الأسنان فقط', 2)]
        for text, count in cases:
            row = self.with_jobs(text, count)
            with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=scraper.ParsedPost(jobs=[]))), \
                 patch.object(pipeline, 'published_source_hashes', return_value={'older-hash'}), \
                 patch.object(pipeline, 'hold_receipt') as hold, \
                 patch.object(pipeline, 'commit_jobs') as commit:
                result = await pipeline.process_receipt(None, MagicMock(), row, 'native')
            self.assertEqual(result['reason'], 'nonoffer_reclassification', text)
            hold.assert_called_once()
            commit.assert_not_called()

    async def test_partial_group_shrinkage_is_held(self):
        text, parsed = self.mixed_post()
        parsed.classification, parsed.needs_review, parsed.review_reasons = 'job_offer', False, []
        row = self.with_jobs(text, 2)
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=parsed)), \
             patch.object(pipeline, 'hold_receipt') as hold, \
             patch.object(pipeline, 'commit_jobs') as commit:
            result = await pipeline.process_receipt(None, MagicMock(), row, 'native')
        self.assertEqual(result['reason'], 'partial_group_change')
        hold.assert_called_once()
        commit.assert_not_called()

    def test_unlabeled_whatsapp_footer_is_shared_but_role_contact_is_not(self):
        text = 'فرص عمل في بغداد\n1. مطلوب طبيب أسنان\n2. مطلوب صيدلاني\nواتساب 07701234567'
        message = SimpleNamespace(id=17, raw_text=text, date=datetime(2026, 11, 1, tzinfo=timezone.utc))
        rows = pipeline.job_records(pipeline.fallback_post(text), message, 123, 'clinic', 'native_contacts', True)
        self.assertEqual(len(rows), 2)
        for row in rows:
            self.assertEqual(row['contact_whatsapp'], '9647701234567')

    async def test_review_held_receipts_are_not_retried(self):
        db = MagicMock()
        held = self.with_jobs('held')
        held['error_type'] = 'review:nonoffer_reclassification'
        normal = self.with_jobs('new')
        chain = db.table.return_value.select.return_value.eq.return_value.lte.return_value.order.return_value.limit.return_value.execute
        chain.side_effect = [SimpleNamespace(data=[held, normal]), SimpleNamespace(data=[])]
        with patch.object(pipeline, 'process_receipt', AsyncMock(return_value={'outcome': 'complete', 'jobs': 1, 'retry': False})) as process:
            result = await pipeline.drain_inbox(None, db, 'native')
        self.assertEqual(process.call_count, 1)
        self.assertEqual(result['review_held'], 1)


class InboxDiagnosticTests(unittest.IsolatedAsyncioTestCase):
    """Sanitized stage/category attribution for exceptions escaping process_receipt."""

    def setUp(self):
        pipeline._STAGE.set('unknown')

    def db_with_row(self, row):
        db = MagicMock()
        chain = db.table.return_value.select.return_value.eq.return_value.lte.return_value.order.return_value.limit.return_value.execute
        chain.side_effect = [SimpleNamespace(data=[row]), SimpleNamespace(data=[])]
        return db

    async def test_escaping_commit_error_records_stage_and_sanitized_category(self):
        text = 'مطلوب طبيب أسنان في بغداد'
        parsed = scraper.ParsedPost(jobs=[offer(text)], classification='job_offer')
        db = self.db_with_row(receipt(text))
        with patch.object(scraper, 'parse_jobs', AsyncMock(return_value=parsed)), \
             patch.object(pipeline, 'commit_jobs', side_effect=RuntimeError('secret 07701234567')):
            result = await pipeline.drain_inbox(None, db, 'native')
        self.assertEqual(result['failed'], 1)
        updates = db.table.return_value.update.call_args_list
        self.assertEqual(len(updates), 1)
        payload = updates[0].args[0]
        self.assertEqual(payload['error_type'], 'failed:commit:RuntimeError')
        self.assertEqual(set(payload), {'error_type', 'updated_at'})
        self.assertNotIn('07701234567', str(updates))
        self.assertEqual(db.table.return_value.update.return_value.eq.call_args.args,
                         ('message_key', 'clinic:17'))
        db.table.return_value.update.return_value.eq.return_value.or_.assert_called_once_with(
            'error_type.is.null,error_type.not.like.review:%')
        tables = [call.args[0] for call in db.table.call_args_list]
        self.assertNotIn('job_offers', tables)
        self.assertNotIn('telegram_sync_checkpoints', tables)

    async def test_escaping_fallback_error_records_fallback_stage(self):
        text = 'مطلوب طبيب أسنان في بغداد'
        db = self.db_with_row(receipt(text))
        with patch.object(scraper, 'parse_jobs', AsyncMock(side_effect=ValueError('bad model output'))), \
             patch.object(pipeline, 'fallback_post', side_effect=RuntimeError('fallback down')):
            result = await pipeline.drain_inbox(None, db, 'native')
        self.assertEqual(result['failed'], 1)
        payload = db.table.return_value.update.call_args.args[0]
        self.assertEqual(payload['error_type'], 'failed:fallback:RuntimeError')
        db.rpc.assert_not_called()

    async def test_diagnostic_write_failure_does_not_interrupt_ingestion(self):
        db = self.db_with_row(receipt('مطلوب طبيب أسنان في بغداد'))
        db.table.return_value.update.side_effect = OSError('diagnostics unavailable')
        with patch.object(pipeline, 'process_receipt', AsyncMock(side_effect=RuntimeError('boom'))):
            result = await pipeline.drain_inbox(None, db, 'native')
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['failed'], 1)

    async def test_review_hold_error_type_is_not_rewritten(self):
        db = MagicMock()
        row = receipt('synthetic')
        row['error_type'] = 'review:review_required'
        self.assertIsNone(await pipeline.record_failed_receipt(db, row, RuntimeError('boom')))
        db.table.assert_not_called()

    async def test_concurrent_failures_keep_their_own_stage(self):
        first, second = receipt('مطلوب طبيب أسنان في بغداد'), receipt('مطلوب صيدلاني في البصرة')
        second['message_key'], second['message_id'] = 'clinic:18', 18
        db = self.db_with_row(first)
        db.table.return_value.select.return_value.eq.return_value.lte.return_value.order.return_value.limit.return_value.execute.side_effect = [
            SimpleNamespace(data=[first, second]), SimpleNamespace(data=[])]

        async def fail(gemini, database, row, storage):
            pipeline.set_stage('commit' if row['message_id'] == 17 else 'fallback')
            await asyncio.sleep(0)
            raise RuntimeError('boom')

        with patch.object(pipeline, 'process_receipt', side_effect=fail):
            result = await pipeline.drain_inbox(None, db, 'native')
        self.assertEqual(result['failed'], 2)
        values = [call.args[0]['error_type']
                  for call in db.table.return_value.update.call_args_list]
        self.assertCountEqual(values, ['failed:commit:RuntimeError', 'failed:fallback:RuntimeError'])

    def test_diagnostic_category_never_includes_exception_text(self):
        exc = ValueError('secret phone 07701234567')
        self.assertEqual(pipeline.diagnostic_category(exc), 'ValueError')
        self.assertNotIn('07701234567', pipeline.diagnostic_category(exc))
        self.assertLessEqual(len(f'failed:commit:{pipeline.diagnostic_category(exc)}'), 100)


class FallbackValueErrorTests(unittest.IsolatedAsyncioTestCase):
    """Regression for failed:fallback:ValueError from min([]) in shared-context validation."""

    # Synthetic text only. "فرص عمل"/"الوظائف" create sections but are not JOB_WORDs,
    # so no grounded offer exists and the footer must go to review, not inheritance.
    text = '\n'.join([
        'فرص عمل في بغداد',
        '1. طبيب أسنان في العاصمة',
        '2. صيدلاني في البصرة',
        'للتقديم لجميع الوظائف واتساب 07701234567',
    ])

    def test_fallback_post_keeps_ungrounded_sections_for_review(self):
        parsed = pipeline.fallback_post(self.text)
        self.assertEqual(parsed.jobs, [])
        self.assertEqual(parsed.shared_context, [])
        self.assertTrue(getattr(parsed, 'needs_review', False))
        self.assertIn('ambiguous_shared_contact', getattr(parsed, 'review_reasons', []))

    async def test_process_receipt_holds_instead_of_raising_from_fallback(self):
        db = MagicMock()
        with patch.object(scraper, 'parse_jobs', AsyncMock(side_effect=ValueError('synthetic AI failure'))):
            result = await pipeline.process_receipt(None, db, receipt(self.text), 'native')
        self.assertEqual(result['outcome'], 'held')
        self.assertEqual(result['reason'], 'review_required')
        payload = db.table.return_value.update.call_args.args[0]
        self.assertEqual(payload['error_type'], 'review:review_required')
        self.assertEqual(set(payload), {'state', 'error_type', 'next_attempt_at', 'updated_at'})
        db.rpc.assert_not_called()

    async def test_drain_inbox_records_no_failure_and_publishes_no_jobs(self):
        db = MagicMock()
        chain = db.table.return_value.select.return_value.eq.return_value.lte.return_value.order.return_value.limit.return_value.execute
        chain.side_effect = [SimpleNamespace(data=[receipt(self.text)]), SimpleNamespace(data=[])]
        with patch.object(scraper, 'parse_jobs', AsyncMock(side_effect=ValueError('synthetic AI failure'))):
            result = await pipeline.drain_inbox(None, db, 'native')
        self.assertEqual(result['failed'], 0)
        self.assertEqual(result['jobs'], 0)
        self.assertEqual(result['processed'], 1)
        updates = [call.args[0]['error_type'] for call in db.table.return_value.update.call_args_list]
        self.assertEqual(updates, ['review:review_required'])
        self.assertFalse(any(value.startswith('failed:') for value in updates))
        db.rpc.assert_not_called()
        tables = [call.args[0] for call in db.table.call_args_list]
        self.assertNotIn('job_offers', tables)
