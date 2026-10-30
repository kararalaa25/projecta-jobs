import unittest,json
from unittest.mock import AsyncMock,MagicMock,patch
from datetime import datetime,timezone,timedelta
from types import SimpleNamespace
import telegram_scraper as scraper
from iraq_taxonomy import locations,classify_roles,GOVERNORATES,ROLE_IDS
class NationwideTests(unittest.IsolatedAsyncioTestCase):
 def test_all_18_governorates_and_aliases(self):
  self.assertEqual(len(GOVERNORATES),18)
  for province in GOVERNORATES:
   for alias in province['aliases']:
    with self.subTest(alias=alias):self.assertIn(province['id'],locations('الموقع: '+alias))
  self.assertEqual(locations('مطلوب طبيب ببغداد'),['Baghdad'])
  self.assertEqual(locations('العمل في الحلة'),['Babylon'])
  self.assertEqual(locations('الموقع: الناصرية'),['Dhi Qar'])
 def test_explicit_location_priority_and_multiple_regions(self):
  self.assertEqual(locations('شركة في بغداد، الموقع: الكوت')[0],'Wasit')
  self.assertEqual(set(locations('مطلوب مندوبين في بغداد والبصرة')),{'Baghdad','Basra'})
  self.assertEqual(set(locations('بغداد / البصرة')),{'Baghdad','Basra'})
 def test_five_professional_roles_and_qualification_exclusions(self):
  cases={
   'مطلوب طبيب أسنان في بغداد':['Dentists'],
   'مطلوب صيدلاني للعمل في الحلة':['Pharmacists'],
   'مطلوب مساعدة طبيب أسنان':['Assistants & Techs'],
   'مطلوب فني مختبرات':['Assistants & Techs'],
   'مطلوب ممرضين':['Assistants & Techs'],
   'مطلوب مندوب علمي خريج صيدلاني':['Medical Reps'],
   'مطلوب موظفة استقبال في صيدلية':['Receptionists / Admin'],
   'مطلوب صيدلي وموظفة استقبال':['Pharmacists','Receptionists / Admin'],
  }
  for text,expected in cases.items():
   with self.subTest(text=text):self.assertEqual(classify_roles(text),expected)
  self.assertEqual(len(ROLE_IDS),5)
 async def test_public_history_pages_to_date_cutoff(self):
  def html(mid,date):return f'<div class="tgme_widget_message" data-post="clinic/{mid}"><div class="tgme_widget_message_text">مطلوب صيدلاني في بغداد</div><time datetime="{date}"></time></div>'
  http=MagicMock();http.get=AsyncMock(side_effect=[SimpleNamespace(text=html(50,'2026-10-29T00:00:00Z'),raise_for_status=lambda:None),SimpleNamespace(text=html(30,'2026-10-01T00:00:00Z'),raise_for_status=lambda:None)])
  cm=MagicMock();cm.__aenter__=AsyncMock(return_value=http);cm.__aexit__=AsyncMock(return_value=None)
  with patch.object(scraper.httpx,'AsyncClient',return_value=cm),patch.object(scraper.asyncio,'sleep',AsyncMock()):
   _,_,posts=await scraper.fetch_public_posts('clinic',None,datetime(2026,10,16,tzinfo=timezone.utc),3)
  self.assertEqual([p.id for p in posts],[50]);self.assertEqual(http.get.call_count,2)
  self.assertEqual(http.get.call_args.kwargs['params'],{'before':50})
 async def test_history_budget_is_failure_not_silent_truncation(self):
  html='<div class="tgme_widget_message" data-post="clinic/50"><div class="tgme_widget_message_text">مطلوب صيدلاني في بغداد</div><time datetime="2026-10-29T00:00:00Z"></time></div>'
  http=MagicMock();http.get=AsyncMock(return_value=SimpleNamespace(text=html,raise_for_status=lambda:None));cm=MagicMock();cm.__aenter__=AsyncMock(return_value=http);cm.__aexit__=AsyncMock(return_value=None)
  with patch.object(scraper.httpx,'AsyncClient',return_value=cm),patch.object(scraper.asyncio,'sleep',AsyncMock()):
   with self.assertRaises(ValueError):await scraper.fetch_public_posts('clinic',None,datetime(2026,10,16,tzinfo=timezone.utc),1)
 async def test_regex_backfill_is_classified_batched_and_does_not_call_gemini(self):
  posts=[SimpleNamespace(id=1,raw_text='مطلوب صيدلاني للعمل في الحلة هاتف 07701234567',date=datetime.now(timezone.utc)),SimpleNamespace(id=2,raw_text='كورس تدريبي طبي في بغداد مطلوب التسجيل',date=datetime.now(timezone.utc))]
  db=MagicMock()
  with patch.object(scraper,'parse_job',AsyncMock()) as gemini:
   result,coverage=await scraper.ingest_regex_history(db,posts,123,'clinic','native')
  gemini.assert_not_called();self.assertEqual(result['filtered'],1);self.assertEqual(result['upserted'],1);self.assertEqual(coverage['Babylon'],1)
  row=db.table.return_value.upsert.call_args.args[0];self.assertEqual(row['location_city'],'Babylon');self.assertEqual(json.loads(row['contact_info'])['role_category'],'Pharmacists')
 def test_legacy_role_constraint_keeps_exact_category_in_metadata(self):
  class LegacyError(Exception):code='23514';message='violates constraint "job_offers_role_category_check"'
  db=MagicMock();db.table.return_value.upsert.return_value.execute.side_effect=[LegacyError(),None]
  row={'id':'id','role_category':'Pharmacists','contact_info':json.dumps({'role_category':'Pharmacists'})}
  self.assertEqual(scraper.store_batch(db,[row],'native'),1);self.assertEqual(row['role_category'],'');self.assertEqual(json.loads(row['contact_info'])['role_category'],'Pharmacists')
