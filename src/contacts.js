const digits = value => String(value || '').replace(/[٠-٩۰-۹]/g, c => String('٠١٢٣٤٥٦٧٨٩'.includes(c) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(c) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
export function normalizeIraqiPhone(value) {
  const number = digits(value).replace(/[^0-9]/g, '')
  const national = number.startsWith('964') ? number.slice(3).replace(/^0/, '') : number.replace(/^0/, '')
  return /^7[0-9]{9}$/.test(national) ? { local: `0${national}`, whatsapp: `964${national}` } : null
}
export function telegramHandle(value) {
  const match = String(value || '').match(/^(?:@|https?:\/\/(?:t\.me|telegram\.me)\/)?([A-Za-z][A-Za-z0-9_]{4,31})\/?$/i)
  return match?.[1] || null
}
export function extractContacts(text) {
  const value = digits(text)
  const matches = [...value.matchAll(/(?<!\d)(?:\+?964[\s().-]*0?7(?:[\s().-]*\d){9}|07(?:[\s().-]*\d){9})(?!\d)/g)]
  const phone = matches.length ? normalizeIraqiPhone(matches[0][0])?.local : null
  let whatsapp = null
  for (const marker of value.matchAll(/واتس\s*(?:اب|آب)|whats\s*app/gi)) {
    const nearest = matches.map(m => ({ match: m, distance: Math.max(0, m.index - (marker.index + marker[0].length), marker.index - (m.index + m[0].length)) })).sort((a,b)=>a.distance-b.distance)[0]
    if (nearest && nearest.distance <= 40) { whatsapp = normalizeIraqiPhone(nearest.match[0])?.whatsapp; break }
  }
  const telegram = value.match(/(?<![\w@])@([A-Za-z][A-Za-z0-9_]{4,31})(?!\w)|(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z][A-Za-z0-9_]{4,31})(?!\w)/i)
  return { phone: phone || null, whatsapp: whatsapp || null, telegram: telegram?.[1] || telegram?.[2] || null }
}
export function isRejectedPost(text) {
  const value = String(text || '').replace(/[\u064b-\u065f\u0670\u0640]/g, '').toLowerCase()
  return value.trim().length < 20 || ['كورس','دورة','دوره','ورشة','ورشه','#بداية_النشر'].some(word=>value.includes(word))
}

export function isRawJobAllowed(text) {
  const value = String(text || '').replace(/[\u064b-\u065f\u0670\u0640]/g, '').toLowerCase()
  return !isRejectedPost(text) && ['مطلوب','وظيفة','وظيفه','تجميع','صيدلية','صيدليه','عيادة','عياده','مركز'].some(word=>value.includes(word))
}
