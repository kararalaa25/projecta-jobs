import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {OWNER_EMAILS} from '../config/access.js'
import {createMonitoringHandler} from '../api/monitoring.js'
import {
  AlertState, DEFAULT_THRESHOLDS, alertText, buildSnapshot, createEmailNotifier, detectAlerts,
} from '../server/monitoring.js'

const NOW = Date.parse('2026-11-18T12:00:00.000Z')
const ago = ms => new Date(NOW - ms).toISOString()
const healthy = () => ({
  sync: {lastSuccessAt: ago(60000), lastError: null, lastSummaryError: null, leaseUntil: null},
  retries: [],
  retryCount: 0,
  moderation: {pendingCount: 0, oldestPendingAt: null},
  newestSourcePostAt: ago(10 * 86400000),
})
const response = () => ({statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(raw) { this.body = JSON.parse(raw) }})
const fakeDb = (tables = {}) => ({
  from(table) {
    const data = tables[table] || []
    const query = {
      select() { return query },
      eq() { return query },
      limit() { return query },
      lt() { return query },
      like() { return query },
      or() { return query },
      order() { return query },
      abortSignal() { return Promise.resolve({data, error: null, count: data.length}) },
      insert() { throw new Error('write not allowed') },
      update() { throw new Error('write not allowed') },
      upsert() { throw new Error('write not allowed') },
      delete() { throw new Error('write not allowed') },
    }
    return query
  },
})

test('idle channel with no new posts produces no alert', () => {
  assert.deepEqual(detectAlerts(healthy(), DEFAULT_THRESHOLDS, NOW), [])
})

test('ingestion failure produces a sanitized, actionable alert', () => {
  const snapshot = healthy()
  snapshot.sync.lastError = 'inbox_write_failure:SECRET123 phone=07701234567'
  const [finding] = detectAlerts(snapshot, DEFAULT_THRESHOLDS, NOW)
  assert.equal(finding.key, 'database_error')
  assert.equal(finding.category, 'database_write')
  const text = alertText(finding)
  assert.match(text, /service-role access/)
  assert.equal(text.includes('SECRET123'), false)
  assert.equal(text.includes('07701234567'), false)
})

test('stale success heartbeat is distinguished from an idle channel', () => {
  const snapshot = healthy()
  snapshot.sync.lastSuccessAt = ago(2 * 3600000)
  const findings = detectAlerts(snapshot, DEFAULT_THRESHOLDS, NOW)
  assert.deepEqual(findings.map(item => item.key), ['ingestion_stalled'])
  assert.equal(findings[0].counts.lastSuccessMinutes, 120)
})

test('repeated classification failures are detected but review holds are ignored', () => {
  const snapshot = healthy()
  snapshot.retries = [
    {attempts: 4, errorType: 'ValueError'},
    {attempts: 3, errorType: 'TimeoutError'},
    {attempts: 5, errorType: 'TypeError'},
    {attempts: 5, errorType: 'review:nonoffer_reclassification'},
    {attempts: 1, errorType: 'ValueError'},
  ]
  const findings = detectAlerts(snapshot, DEFAULT_THRESHOLDS, NOW)
  assert.deepEqual(findings.map(item => item.key), ['classification_retry_storm'])
  assert.equal(findings[0].counts.stuckRetries, 3)
})

test('moderation backlog uses count and review-hold age, not source-post age', () => {
  const snapshot = healthy()
  snapshot.moderation = {pendingCount: 2, oldestPendingAt: ago(25 * 3600000), oldestReviewHoldAt: null}
  assert.deepEqual(detectAlerts(snapshot, DEFAULT_THRESHOLDS, NOW), [])
  snapshot.moderation = {pendingCount: 1, oldestReviewHoldAt: ago(25 * 3600000)}
  assert.deepEqual(detectAlerts(snapshot, DEFAULT_THRESHOLDS, NOW).map(item => item.key), ['moderation_backlog'])
  snapshot.moderation = {pendingCount: 12, oldestReviewHoldAt: null}
  assert.deepEqual(detectAlerts(snapshot, DEFAULT_THRESHOLDS, NOW).map(item => item.key), ['moderation_backlog'])
})

test('cooldown suppresses duplicates and allows a later alert', () => {
  const state = new AlertState({now: () => NOW})
  const finding = detectAlerts({...healthy(), sync: {...healthy().sync, lastError: 'channel_failure'}}, DEFAULT_THRESHOLDS, NOW)[0]
  let events = state.evaluate([finding], NOW)
  assert.equal(events.length, 1)
  state.commit(events[0], NOW)
  assert.equal(state.evaluate([finding], NOW + 60000).length, 0)
  const later = detectAlerts({...healthy(), sync: {...healthy().sync, lastError: 'channel_failure'}}, DEFAULT_THRESHOLDS, NOW + 31 * 60000)[0]
  events = state.evaluate([later], NOW + 31 * 60000)
  assert.equal(events.length, 1)
  state.commit(events[0], NOW + 31 * 60000)
})

test('recovery is delayed and emitted once after the condition clears', () => {
  const state = new AlertState({now: () => NOW})
  const finding = detectAlerts({...healthy(), moderation: {pendingCount: 20, oldestReviewHoldAt: null}}, DEFAULT_THRESHOLDS, NOW)[0]
  const alertEvents = state.evaluate([finding], NOW)
  state.commit(alertEvents[0], NOW)
  assert.equal(state.evaluate([], NOW + 60000).length, 0)
  const events = state.evaluate([], NOW + 6 * 60000)
  assert.deepEqual(events.map(event => [event.type, event.key]), [['recovery', 'moderation_backlog']])
  state.commit(events[0], NOW + 6 * 60000)
  assert.equal(state.evaluate([], NOW + 7 * 60000).length, 0)
})

test('email notifier delivers to both administrators without leaking the API key', async () => {
  const received = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      received.push({headers: req.headers, body: JSON.parse(raw)})
      res.writeHead(202, {'Content-Type': 'application/json'})
      res.end('{"id":"test"}')
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const {port} = server.address()
    const notifier = createEmailNotifier({RESEND_API_KEY: 'test-key', ALERT_FROM_EMAIL: 'alerts@example.test'}, {
      endpoint: `http://127.0.0.1:${port}/emails`,
      now: () => NOW,
    })
    const finding = detectAlerts({...healthy(), retryCount: 60}, DEFAULT_THRESHOLDS, NOW)[0]
    const result = await notifier.send({type: 'alert', ...finding})
    assert.equal(result.delivered, true)
    assert.equal(received.length, 1)
    assert.deepEqual(received[0].body.to, [...OWNER_EMAILS])
    assert.equal(received[0].headers.authorization, 'Bearer test-key')
    assert.match(received[0].body.text, /retryCount: 60/)
    assert.equal(JSON.stringify(received[0].body).includes('test-key'), false)
    const again = await notifier.send({type: 'alert', ...finding})
    assert.equal(again.delivered, true)
    assert.equal(received[1].headers.idempotencykey, received[0].headers.idempotencykey)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('email notifier fails closed when the provider is not configured', async () => {
  const notifier = createEmailNotifier({})
  assert.equal(notifier.configured(), false)
  assert.deepEqual(await notifier.send({key: 'ingestion_error'}), {delivered: false, reason: 'not_configured'})
})

test('monitoring endpoint requires a secret and a configured provider', async () => {
  const env = {MONITORING_SECRET: 'cron-secret'}
  const handler = createMonitoringHandler(env, () => { throw new Error('database should not be called') }, {notifierFactory: createEmailNotifier})
  const unauthorized = response()
  await handler({method: 'POST', headers: {}}, unauthorized)
  assert.equal(unauthorized.statusCode, 401)
  const unconfigured = response()
  await handler({method: 'POST', headers: {authorization: 'Bearer cron-secret'}}, unconfigured)
  assert.equal(unconfigured.statusCode, 503)
})

test('snapshot builds from existing tables using read-only queries', async () => {
  const db = fakeDb({
    telegram_sync_control: [{last_success_at: ago(60000), last_error: 'channel_failure', last_summary: {}, lease_until: null}],
    telegram_sync_checkpoints: [{counts: {newest_source_post_at: ago(3600000)}}],
  })
  const snapshot = await buildSnapshot(db, NOW)
  assert.equal(snapshot.sync.lastError, 'channel_failure')
  assert.equal(snapshot.newestSourcePostAt, ago(3600000))
})

test('handler end-to-end delivers an alert to both administrator recipients', async () => {
  const received = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      received.push({headers: req.headers, body: JSON.parse(raw)})
      res.writeHead(202, {'Content-Type': 'application/json'})
      res.end('{"id":"test"}')
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const {port} = server.address()
    const db = fakeDb({
      telegram_sync_control: [{last_success_at: ago(60000), last_error: 'inbox_write_failure', last_summary: {}, lease_until: null}],
    })
    const handler = createMonitoringHandler(
      {MONITORING_SECRET: 'cron-secret'},
      () => db,
      {
        state: new AlertState({now: () => NOW}),
        notifierFactory: env => createEmailNotifier(
          {...env, RESEND_API_KEY: 'test-key', ALERT_FROM_EMAIL: 'alerts@example.test'},
          {endpoint: `http://127.0.0.1:${port}/emails`, now: () => NOW},
        ),
        now: () => NOW,
      },
    )
    const res = response()
    await handler({method: 'POST', headers: {authorization: 'Bearer cron-secret'}}, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.delivered, [{key: 'database_error', type: 'alert', delivered: true}])
    assert.equal(received.length, 1)
    assert.deepEqual(received[0].body.to, [...OWNER_EMAILS])
    assert.equal(received[0].body.text.includes('inbox_write_failure'), false)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('monitoring check failures are deduplicated like other alerts', async () => {
  let sends = 0
  const notifierFactory = () => ({configured: () => true, send: async () => { sends += 1; return {delivered: true} }})
  const handler = createMonitoringHandler(
    {MONITORING_SECRET: 'cron-secret'},
    () => { throw new Error('connection failed') },
    {state: new AlertState({now: () => NOW}), notifierFactory, now: () => NOW},
  )
  const first = response()
  await handler({method: 'POST', headers: {authorization: 'Bearer cron-secret'}}, first)
  const second = response()
  await handler({method: 'POST', headers: {authorization: 'Bearer cron-secret'}}, second)
  assert.equal(first.statusCode, 502)
  assert.equal(second.statusCode, 502)
  assert.equal(sends, 1)
})

test('failed checks never emit false recovery for unrelated active alerts', async () => {
  const sent = []
  const notifierFactory = () => ({
    configured: () => true,
    send: async event => { sent.push(event); return {delivered: true} },
  })
  let clock = NOW
  let fail = false
  const db = fakeDb({
    telegram_sync_control: [{last_success_at: ago(60000), last_error: 'inbox_write_failure', last_summary: {}, lease_until: null}],
  })
  const handler = createMonitoringHandler(
    {MONITORING_SECRET: 'cron-secret'},
    () => { if (fail) throw new Error('connection failed'); return db },
    {state: new AlertState({now: () => clock}), notifierFactory, now: () => clock},
  )
  const call = () => handler({method: 'POST', headers: {authorization: 'Bearer cron-secret'}}, response())

  // Establish an active, unrelated alert while checks succeed.
  await call()
  assert.deepEqual(sent.map(event => event.key), ['database_error'])

  // Supabase goes away for longer than the recovery delay; only failed checks run.
  fail = true
  clock = NOW + 10 * 60000
  await call()
  clock = NOW + 20 * 60000
  await call()

  assert.equal(sent.some(event => event.type === 'recovery'), false)
  assert.deepEqual(sent.map(event => event.key), ['database_error', 'monitoring_check_failed'])
})

test('failed delivery does not consume the cooldown', async () => {
  const sentKeys = []
  const notifierFactory = () => ({
    configured: () => true,
    send: async event => {
      sentKeys.push(event.key)
      if (event.key === 'database_error' && sentKeys.filter(key => key === 'database_error').length === 1) {
        throw new Error('provider rejected')
      }
      return {delivered: true}
    },
  })
  const db = fakeDb({
    telegram_sync_control: [{last_success_at: ago(60000), last_error: 'inbox_write_failure', last_summary: {}, lease_until: null}],
  })
  const handler = createMonitoringHandler(
    {MONITORING_SECRET: 'cron-secret'},
    () => db,
    {state: new AlertState({now: () => NOW}), notifierFactory, now: () => NOW},
  )
  await handler({method: 'POST', headers: {authorization: 'Bearer cron-secret'}}, response())
  await handler({method: 'POST', headers: {authorization: 'Bearer cron-secret'}}, response())
  assert.equal(sentKeys.filter(key => key === 'database_error').length, 2)
})
