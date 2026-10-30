const exact = new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baghdad' })
const relative = new Intl.RelativeTimeFormat('ar-IQ', { numeric: 'always' })
export function validDate(value) {
 if (!value) return null
 const date = new Date(value)
 return Number.isFinite(date.getTime()) ? date : null
}
export function exactDate(value) { const date = validDate(value); return date ? exact.format(date) : 'تاريخ النشر غير متاح' }
export function jobTimestamp(value, now = Date.now()) {
 const date = validDate(value)
 if (!date) return 'تاريخ النشر غير متاح'
 const seconds = (now - date.getTime()) / 1000
 if (seconds < -60 || seconds >= 30 * 86400) return exactDate(value)
 if (seconds < 60) return 'الآن'
 if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), 'minute')
 if (seconds < 86400) return relative.format(-Math.floor(seconds / 3600), 'hour')
 return relative.format(-Math.floor(seconds / 86400), 'day')
}
