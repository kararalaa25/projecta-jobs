import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const scheduleSql = read('../supabase/migrations/20261031223713_schedule_telegram_sync.sql')
const feedSql = read('../supabase/migrations/20261031223330_realtime_job_feed.sql')
const intervalSql = read('../supabase/migrations/20261119000001_telegram_batch_drain_interval.sql')
const cursorSql = read('../supabase/migrations/20261119000000_telegram_message_cursor.sql')
const vercelConfig = JSON.parse(read('../vercel.json'))

test('one pg_cron dispatcher is tuned to a twenty-minute batch drain', () => {
  assert.match(scheduleSql, /cron\.schedule\('projecta-telegram-sync','\*\/5 \* \* \* \*','select private\.dispatch_telegram_sync\(\);'\)/)
  assert.equal((scheduleSql.match(/cron\.schedule\(/g) || []).length, 1)
  assert.match(scheduleSql, /url:='https:\/\/projecta-jobs\.vercel\.app\/api\/telegram-sync'/)
  assert.match(scheduleSql, /timeout_milliseconds:=300000/)
  assert.match(scheduleSql, /now\(\)\+interval '5 minutes'/)
  assert.match(scheduleSql, /lease_until>now\(\)/)
  assert.match(intervalSql, /cron\.job where jobname='projecta-telegram-sync'/)
  assert.match(intervalSql, /schedule := '\*\/20 \* \* \* \*'/)
  assert.equal(vercelConfig.crons, undefined)
})

test('the message-ID cursor migration backfills legacy checkpoint counts', () => {
  assert.match(cursorSql, /add column if not exists last_processed_message_id bigint/)
  assert.match(cursorSql, /counts->>'last_processed_message_id'/)
})

test('the sync lease is time-bounded, owner-claimable and service-role only', () => {
  assert.match(feedSql, /lease_until=now\(\)\+interval '6 minutes'/)
  assert.match(feedSql, /\(lease_until is null or lease_until<now\(\)\)/)
  assert.match(feedSql, /revoke all on function public\.claim_telegram_sync\(text,uuid\) from public,anon,authenticated/)
  assert.match(feedSql, /grant execute on function public\.claim_telegram_sync\(text,uuid\) to service_role/)
})
