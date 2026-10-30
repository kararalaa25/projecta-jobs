import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAuthProviders, authError } from '../src/auth.js'
import { jobTimestamp, exactDate } from '../src/dates.js'
import { toJob } from '../src/jobs.js'

test('provider discovery reflects public settings without assuming missing flags are enabled', async () => {
 const flags = await loadAuthProviders({supabaseUrl:'https://test.supabase.co',supabaseKey:'public-key'}, async (url, init) => {
  assert.equal(url,'https://test.supabase.co/auth/v1/settings'); assert.equal(init.headers.apikey,'public-key')
  return {ok:true,json:async()=>({external:{google:false,email:true,phone:false}})}
 })
 assert.deepEqual(flags,{google:false,email:true,phone:false})
 assert.deepEqual(await loadAuthProviders(null),{google:false,email:false,phone:false})
 assert.deepEqual(await loadAuthProviders({supabaseUrl:'test'},async()=>({ok:true,json:async()=>({external:{email:true}})})),{google:null,email:true,phone:null})
 await assert.rejects(()=>loadAuthProviders({},async()=>({ok:false})))
 await assert.rejects(()=>loadAuthProviders({},async()=>({ok:true,json:async()=>({})})))
})
test('auth errors explain disabled providers, expired codes, email delivery and throttling in Arabic', () => {
 assert.match(authError({code:'phone_provider_disabled'},'phone'),/SMS/)
 assert.match(authError({code:'provider_disabled'},'google'),/Authentication/)
 assert.match(authError({code:'otp_expired'}),/غير صحيح/)
 assert.match(authError({code:'over_email_send_rate_limit'}),/الحد المسموح/)
 assert.match(authError({message:'SMTP email send failed'}),/إعدادات البريد/)
 assert.match(authError({code:'access_denied'},'google'),/لم يكتمل/)
 assert.match(authError({message:'Failed to fetch'}),/الاتصال/)
})
test('timestamps handle Arabic dual/plural forms, invalid dates and Baghdad calendar dates', () => {
 const now=Date.parse('2026-10-30T12:00:00Z')
 assert.equal(jobTimestamp(null,now),'تاريخ النشر غير متاح')
 assert.equal(jobTimestamp('not a date',now),'تاريخ النشر غير متاح')
 assert.equal(jobTimestamp(new Date(now-1000).toISOString(),now),'الآن')
 assert.match(jobTimestamp(new Date(now-3600000).toISOString(),now),/ساعة/)
 assert.match(jobTimestamp(new Date(now-2*86400000).toISOString(),now),/يومين/)
 assert.match(jobTimestamp(new Date(now-3*86400000).toISOString(),now),/٣ أيام/)
 assert.equal(jobTimestamp('2025-01-01',now),exactDate('2025-01-01'))
 assert.equal(exactDate('2026-10-29T22:00:00Z'),exactDate('2026-10-30T01:00:00+03:00'))
})
test('Telegram source date is used consistently rather than the ingestion date', () => {
 const job=toJob({id:'x',created_at:'2026-10-30',contact_info:JSON.stringify({source_posted_at:'2025-01-01'})})
 assert.equal(job.createdAt,'2025-01-01');assert.equal(job.time,exactDate('2025-01-01'))
})
