import json,unittest
from pathlib import Path
from iraq_taxonomy import classify_roles
from telegram_scraper import ParsedJob
class TargetingTests(unittest.TestCase):
 def test_shared_targeting_fixtures(self):
  fixtures=json.loads((Path(__file__).parents[1]/'config/job-targeting-fixtures.json').read_text())
  for fixture in fixtures:
   with self.subTest(title=fixture['title']):self.assertEqual(classify_roles(fixture['title']) or classify_roles(fixture['description']),fixture['roles'])
 def test_gemini_schema_accepts_general_physicians(self):
  parsed=ParsedJob(is_job_offer=True,title='طبيب عام',company_name=None,city=None,role_category='General Physicians',contact_phone=None,contact_telegram=None,salary_text=None,employment_type=None)
  self.assertEqual(parsed.role_category,'General Physicians')
