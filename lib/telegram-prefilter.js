// Pure local intake gate shared by webhook capture. Mirrors the Python helper
// in telegram_scraper.py so no AI request is spent on short or unrelated posts.
export const TELEGRAM_MIN_INGEST_CHARS = 25

const VARIANTS = {أ: 'ا', إ: 'ا', آ: 'ا', ى: 'ي', ة: 'ه'}
const ARABIC_KEYWORDS = [
  'مطلوب', 'وظيفة', 'وظيفه', 'وظائف', 'وظايف', 'فرصة عمل', 'فرص عمل', 'فرصه عمل',
  'نبحث عن', 'عيادة', 'عيادات', 'عياده', 'طبيب', 'طبيبه', 'دكتور', 'دكتورة',
  'صيدلي', 'صيدليه', 'صيدلاني', 'مندوب', 'مندوب طبي', 'ممرض', 'ممرضة', 'تمريض',
  'فني', 'مختبر', 'معمل', 'استقبال', 'سكرتارية', 'اغلق', 'اغلاق', 'مغلق',
  'تم التوظيف', 'الغاء الاعلان', 'الغي الاعلان',
]
const ENGLISH_SIGNAL = /\b(?:hiring|jobs?|vacanc(?:y|ies)|dentist(?:ry)?|dental|doctor|physician|pharmac(?:y|ist)|nurse|rep|closed|filled|we are looking)\b/i

export function normalizeTelegramText(text) {
  return String(text || '')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآىة]/g, char => VARIANTS[char])
    .toLowerCase()
}

export function telegramTextAllowed(text) {
  const value = String(text || '')
  if (value.trim().length < TELEGRAM_MIN_INGEST_CHARS) return false
  const normalized = normalizeTelegramText(value)
  return ARABIC_KEYWORDS.some(word => normalized.includes(normalizeTelegramText(word)))
    || ENGLISH_SIGNAL.test(normalized)
}
