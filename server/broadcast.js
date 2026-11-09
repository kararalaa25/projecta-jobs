import {createHmac} from 'node:crypto'
import {publicProfileTrust} from '../config/profile-trust.js'
import {sendTelegramMessage} from '../lib/telegram.js'

/**
 * Formats a standardized B2B broadcast payload for multi-channel distribution
 * (Telegram Public Channels, WhatsApp Communities, and Partner RSS/Webhooks).
 */
export function buildBroadcastPayload({job, publisher, verification, siteUrl = 'https://projecta-jobs.vercel.app'}) {
 const contact = (() => {
  try { return JSON.parse(job.contact_info || '{}') } catch { return {} }
 })()

 const isFacility = verification?.credentials?.includes('facility_license') ||
  ['clinic', 'medical_center'].includes(verification?.kind)

 const companyName = contact.company_name || job.company || 'مؤسسة صحية معتمدة'
 const quickApplyWhatsapp = contact.whatsapp
  ? `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(`مرحباً، أود التقديم على فرصة العمل (${job.title} في ${companyName}) المعلنة عبر منصة Projecta Jobs.`)}`
  : null

 const quickApplyTelegram = contact.telegram
  ? `https://t.me/${contact.telegram}`
  : null

 return {
  event: 'job.verified_published',
  timestamp: new Date().toISOString(),
  job: {
   id: job.id,
   title: job.title,
   company: companyName,
   role_category: job.role_category,
   location_city: job.location_city,
   employment_type: job.employment_type,
   salary_range: job.salary_range,
   description_summary: (job.description || '').slice(0, 400),
   verification: {
    status: verification?.status || 'verified',
    kind: verification?.kind || 'professional',
    is_facility: isFacility,
    badge_label: isFacility ? 'مركز طبي / عيادة مرخصة' : 'حساب مهني معتمد',
    credentials: verification?.credentials || []
   },
   links: {
    portal_url: `${siteUrl}/#opportunities`,
    quick_apply_whatsapp: quickApplyWhatsapp,
    quick_apply_telegram: quickApplyTelegram
   }
  },
  formatted_messages: {
   telegram_channel: [
    `🏥 <b>فرصة عمل جديدة موثقة في القطاع الصحي</b>`,
    ``,
    `▫️ <b>المسمّى:</b> ${job.title}`,
    `▫️ <b>الجهة:</b> ${companyName} ${isFacility ? '🛡️ (مركز طبي / عيادة مرخصة)' : '✅ (معتمد)'}`,
    `▫️ <b>المحافظة:</b> ${job.location_city}`,
    `▫️ <b>الدوام:</b> ${job.employment_type}`,
    `▫️ <b>الراتب / المخصصات:</b> ${job.salary_range || 'حسب الاتفاق'}`,
    ``,
    quickApplyWhatsapp ? `📲 <b>التقديم السريع عبر واتساب:</b> <a href="${quickApplyWhatsapp}">اضغط هنا للمراسلة</a>` : '',
    quickApplyTelegram ? `✈️ <b>التقديم عبر تليجرام:</b> <a href="${quickApplyTelegram}">اضغط هنا للمراسلة</a>` : '',
    `🌐 <b>رابط الإعلان بالمنصة:</b> <a href="${siteUrl}/#opportunities">Projecta Jobs</a>`,
    ``,
    `#وظائف_العراق #${job.role_category} #${job.location_city}`
   ].filter(Boolean).join('\n'),
   whatsapp_community: [
    `*فرصة عمل طبية موثقة — Projecta Jobs*`,
    ``,
    `• المسمّى: ${job.title}`,
    `• الجهة: ${companyName} ${isFacility ? '(عيادة / مركز طبي مرخص)' : ''}`,
    `• المحافظة: ${job.location_city}`,
    `• نوع الدوام: ${job.employment_type}`,
    `• الراتب: ${job.salary_range || 'حسب الاتفاق'}`,
    ``,
    quickApplyWhatsapp ? `التقديم السريع: ${quickApplyWhatsapp}` : `التفاصيل عبر المنصة: ${siteUrl}/#opportunities`
   ].filter(Boolean).join('\n')
  }
 }
}

/**
 * Dispatches automated webhooks and channel notifications for new verified jobs.
 * This runs asynchronously and does not block the HTTP publishing response.
 */
export async function dispatchJobBroadcast(db, jobRow, publisherUser, env = process.env, fetcher = fetch) {
 try {
  const verification = publicProfileTrust(publisherUser)
  const payload = buildBroadcastPayload({
   job: jobRow,
   publisher: publisherUser,
   verification,
   siteUrl: env.APP_ORIGIN || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://projecta-jobs.vercel.app')
  })

  const tasks = []

  // 1. Telegram Channel broadcast
  const channelId = env.TELEGRAM_BROADCAST_CHAT_ID || env.TELEGRAM_CHANNEL_ID
  if (channelId && env.TELEGRAM_BOT_TOKEN) {
   tasks.push(
    sendTelegramMessage(channelId, payload.formatted_messages.telegram_channel, {env, fetcher})
     .catch(err => console.warn('Telegram channel broadcast skipped/failed:', err.message))
   )
  }

  // 2. WhatsApp Community / Partner Webhook broadcast
  const webhookUrl = env.WHATSAPP_BROADCAST_WEBHOOK_URL || env.COMMUNITY_BROADCAST_WEBHOOK_URL
  if (webhookUrl) {
   const secret = env.COMMUNITY_WEBHOOK_SECRET || env.TELEGRAM_LINK_SECRET || 'projecta-broadcast-secret'
   const timestamp = String(Date.now())
   const rawBody = JSON.stringify(payload)
   const signature = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest('hex')

   tasks.push(
    fetcher(webhookUrl, {
     method: 'POST',
     headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Projecta-Timestamp': timestamp,
      'X-Projecta-Signature': signature,
      'X-Projecta-Event': payload.event
     },
     body: rawBody,
     signal: AbortSignal.timeout(7000)
    }).catch(err => console.warn('Community webhook broadcast skipped/failed:', err.message))
   )
  }

  await Promise.allSettled(tasks)
  return {ok: true, payload}
 } catch (error) {
  console.warn('Broadcast dispatcher encountered an issue:', error.message)
  return {ok: false, error: error.message}
 }
}
