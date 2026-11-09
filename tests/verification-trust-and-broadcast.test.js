import test from 'node:test'
import assert from 'node:assert/strict'
import {isJobExpired, jobTimestamp} from '../src/dates.js'
import {buildBroadcastPayload, dispatchJobBroadcast} from '../server/broadcast.js'
import {applicationStatus} from '../src/account/AccountApplications.jsx'

test('automated 30-day expiry marks jobs older than 30 days unless renewed', () => {
 const now = Date.now()
 const freshJob = {id: '1', type: 'jobs', createdAt: new Date(now - 10 * 86400000).toISOString()}
 const expiredJob = {id: '2', type: 'jobs', createdAt: new Date(now - 35 * 86400000).toISOString()}
 const renewedJob = {id: '3', type: 'jobs', createdAt: new Date(now - 40 * 86400000).toISOString(), renewed: true}
 const renewedDateJob = {id: '4', type: 'jobs', createdAt: new Date(now - 50 * 86400000).toISOString(), renewedAt: new Date(now - 5 * 86400000).toISOString()}
 const candidate = {id: '5', type: 'candidates', createdAt: new Date(now - 60 * 86400000).toISOString()}

 assert.equal(isJobExpired(freshJob, 30, now), false)
 assert.equal(isJobExpired(expiredJob, 30, now), true)
 assert.equal(isJobExpired(renewedJob, 30, now), false)
 assert.equal(isJobExpired(renewedDateJob, 30, now), false)
 assert.equal(isJobExpired(candidate, 30, now), false) // Candidates are not expired by job expiry
})

test('B2B Social Alert payload structures Telegram and WhatsApp broadcast channels', () => {
 const job = {
  id: '55555555-5555-4555-8555-555555555555',
  title: 'طبيب أسنان عام',
  role_category: 'Dentists',
  location_city: 'Baghdad',
  employment_type: 'Full-time',
  salary_range: '١٬٥٠٠٬٠٠٠ د.ع',
  description: 'مطلوب طبيب أسنان للعمل في مركز طبي في المنصور.',
  contact_info: JSON.stringify({
   company_name: 'مركز النور التخصصي',
   whatsapp: '9647801234567',
   telegram: 'alnoor_clinic'
  })
 }

 const verification = {
  status: 'verified',
  kind: 'medical_center',
  credentials: ['facility_license']
 }

 const payload = buildBroadcastPayload({job, verification, siteUrl: 'https://projecta-jobs.vercel.app'})

 assert.equal(payload.event, 'job.verified_published')
 assert.equal(payload.job.title, 'طبيب أسنان عام')
 assert.equal(payload.job.company, 'مركز النور التخصصي')
 assert.equal(payload.job.verification.is_facility, true)
 assert.equal(payload.job.verification.badge_label, 'مركز طبي / عيادة مرخصة')
 assert.ok(payload.job.links.quick_apply_whatsapp.includes('wa.me/9647801234567'))
 assert.ok(payload.job.links.quick_apply_telegram.includes('t.me/alnoor_clinic'))

 // Verify formatted Telegram markdown channel broadcast
 const tgMsg = payload.formatted_messages.telegram_channel
 assert.ok(tgMsg.includes('مركز النور التخصصي'))
 assert.ok(tgMsg.includes('طبيب أسنان عام'))
 assert.ok(tgMsg.includes('مركز طبي / عيادة مرخصة'))
 assert.ok(tgMsg.includes('#Dentists'))
 assert.ok(tgMsg.includes('#Baghdad'))

 // Verify formatted WhatsApp community broadcast
 const waMsg = payload.formatted_messages.whatsapp_community
 assert.ok(waMsg.includes('مركز النور التخصصي'))
 assert.ok(waMsg.includes('التقديم السريع'))
})

test('dispatchJobBroadcast sends webhooks with HMAC signature and handles absence of env gracefully', async () => {
 const sentRequests = []
 const mockFetcher = async (url, options) => {
  sentRequests.push({url, ...options})
  return {ok: true, json: async () => ({ok: true})}
 }

 const job = {
  id: '77777777-7777-4777-8777-777777777777',
  title: 'صيدلاني مرخص',
  role_category: 'Pharmacists',
  location_city: 'Basra',
  employment_type: 'Full-time',
  salary_range: 'حسب الاتفاق',
  contact_info: JSON.stringify({company_name: 'صيدلية النجاة', phone: '07800000000'})
 }

 const user = {
  id: 'user-1',
  email_confirmed_at: '2026-01-01',
  app_metadata: {
   profile_kind: 'clinic',
   organization_verified: true,
   organization_verification_status: 'approved',
   verified_credentials: {facility_license: true}
  }
 }

 const env = {
  COMMUNITY_BROADCAST_WEBHOOK_URL: 'https://webhook.projecta.test/broadcast',
  COMMUNITY_WEBHOOK_SECRET: 'test-secret'
 }

 const res = await dispatchJobBroadcast({}, job, user, env, mockFetcher)
 assert.equal(res.ok, true)
 assert.equal(sentRequests.length, 1)
 assert.equal(sentRequests[0].url, 'https://webhook.projecta.test/broadcast')
 assert.equal(sentRequests[0].headers['X-Projecta-Event'], 'job.verified_published')
 assert.ok(sentRequests[0].headers['X-Projecta-Signature'])
 assert.ok(sentRequests[0].headers['X-Projecta-Timestamp'])
})

test('application tracking statuses support all transparent pipeline stages', () => {
 assert.equal(applicationStatus.submitted, 'قيد المراجعة')
 assert.equal(applicationStatus.viewed, 'تمت المشاهدة')
 assert.equal(applicationStatus.reviewing, 'تمت المشاهدة')
 assert.equal(applicationStatus.shortlisted, 'مُرشَّح للقائمة القصيرة')
 assert.equal(applicationStatus.accepted, 'مقبول')
 assert.equal(applicationStatus.archived, 'تم الأرشفتة')
 assert.equal(applicationStatus.rejected, 'غير مقبول')
})
