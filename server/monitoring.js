import {createHash} from 'node:crypto'
import {OWNER_EMAILS} from '../config/access.js'
import {backendReason} from './backend-errors.js'

export const DEFAULT_THRESHOLDS = Object.freeze({
  staleSuccessMs: 45 * 60000,
  retryAttempts: 3,
  retryStormCount: 3,
  retryBacklogCount: 50,
  moderationPendingCount: 10,
  moderationAgeMs: 24 * 60 * 60000,
  cooldownMs: 30 * 60000,
  recoveryDelayMs: 5 * 60000,
  requestTimeoutMs: 10000,
})

const LABELS = Object.freeze({
  ingestion_error: 'Telegram ingestion error',
  database_error: 'Telegram database error',
  ingestion_stalled: 'Telegram ingestion heartbeat stale',
  classification_retry_storm: 'Repeated classification failures',
  retry_backlog: 'Ingestion retry backlog',
  moderation_backlog: 'Moderation backlog',
  monitoring_check_failed: 'Monitoring check failed',
})

const ACTIONS = Object.freeze({
  ingestion_error: 'Inspect the scheduled Telegram run and its generic error category. Do not replay messages or reset checkpoints.',
  database_error: 'Verify service-role access to the Telegram tables and the required schema. Do not replay messages or reset checkpoints.',
  ingestion_stalled: 'Confirm the projecta-telegram-sync schedule is active and completing. No new posts are required for a healthy heartbeat.',
  classification_retry_storm: 'Check Gemini API availability, quota and model configuration. Queued posts remain durable in the inbox.',
  retry_backlog: 'Inspect the retry queue and database write path. Avoid manual replay until the underlying error category is resolved.',
  moderation_backlog: 'Assign a reviewer and clear /admin/jobs?status=pending. Pending jobs are never public.',
  monitoring_check_failed: 'Verify Supabase connectivity and the monitoring function configuration. The check did not evaluate alerts.',
})

const DB_CATEGORIES = new Set(['configuration', 'permissions', 'schema', 'credentials', 'connection', 'database_write'])
const ALLOWED_CATEGORIES = new Set([...DB_CATEGORIES, 'ingestion_fetch', 'classification', 'unavailable', 'none'])

const number = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
const time = value => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null }
const category = value => {
  const raw = String(value || '')
  if (raw.startsWith('inbox_write_failure')) return 'database_write'
  if (/^(?:fetch_timeout|channel_failure)\b/.test(raw)) return 'ingestion_fetch'
  const mapped = backendReason({message: raw})
  return ALLOWED_CATEGORIES.has(mapped) ? mapped : 'unavailable'
}
const iso = value => Number.isFinite(value) ? new Date(value).toISOString() : 'unknown'

function alert(key, severity, categoryValue, counts, at) {
  return {key, severity, category: categoryValue, counts, at: iso(at), cooldownMs: DEFAULT_THRESHOLDS.cooldownMs}
}

/**
 * Evaluate only operational signals. An idle channel with no new posts is healthy
 * as long as the sync heartbeat, inbox and moderation queue remain current.
 */
export function detectAlerts(snapshot = {}, thresholds = DEFAULT_THRESHOLDS, now = Date.now()) {
  const findings = []
  const sync = snapshot.sync || {}
  const error = sync.lastError || sync.lastSummaryError || null
  const lastSuccess = time(sync.lastSuccessAt)
  const leaseActive = time(sync.leaseUntil) > now
  const retries = Array.isArray(snapshot.retries) ? snapshot.retries : []
  const stuck = retries.filter(row => {
    const type = String(row?.errorType || '')
    return number(row?.attempts) >= thresholds.retryAttempts && !type.startsWith('review:') && Boolean(type)
  })

  if (error) {
    const cause = category(error)
    findings.push(DB_CATEGORIES.has(cause)
      ? alert('database_error', 'critical', cause, {}, now)
      : alert('ingestion_error', 'warning', cause, {}, now))
  }
  if (!leaseActive && (!lastSuccess || now - lastSuccess > thresholds.staleSuccessMs)) {
    findings.push(alert('ingestion_stalled', 'warning', 'none', {
      lastSuccessMinutes: lastSuccess ? Math.max(0, Math.floor((now - lastSuccess) / 60000)) : null,
    }, now))
  }
  if (stuck.length >= thresholds.retryStormCount) {
    findings.push(alert('classification_retry_storm', 'warning', 'classification', {
      stuckRetries: stuck.length,
    }, now))
  }
  if (number(snapshot.retryCount) >= thresholds.retryBacklogCount) {
    findings.push(alert('retry_backlog', 'warning', 'unavailable', {
      retryCount: number(snapshot.retryCount),
    }, now))
  }
  // job_offers.created_at is the source-post date, not queue-entry time, so it
  // must never be used as a moderation SLA. Review holds carry their own updated_at.
  const holdAge = time(snapshot.moderation?.oldestReviewHoldAt)
  if (number(snapshot.moderation?.pendingCount) >= thresholds.moderationPendingCount ||
      (holdAge !== null && now - holdAge > thresholds.moderationAgeMs)) {
    findings.push(alert('moderation_backlog', 'warning', 'none', {
      pendingCount: number(snapshot.moderation?.pendingCount),
      oldestHoldMinutes: holdAge !== null ? Math.max(0, Math.floor((now - holdAge) / 60000)) : null,
    }, now))
  }
  return findings
}

/** Deliver each condition at most once per cooldown, with delayed recovery notices. */
export class AlertState {
  constructor({now = Date.now, cooldownMs = DEFAULT_THRESHOLDS.cooldownMs, recoveryDelayMs = DEFAULT_THRESHOLDS.recoveryDelayMs} = {}) {
    this.now = now
    this.cooldownMs = cooldownMs
    this.recoveryDelayMs = recoveryDelayMs
    this.entries = new Map()
  }

  evaluate(findings = [], at = this.now(), {recover = true} = {}) {
    const events = []
    const active = new Set(findings.map(item => item.key))
    for (const finding of findings) {
      const entry = this.entries.get(finding.key) || {active: false, lastSentAt: 0, missingSince: null, sentCount: 0}
      const wait = finding.cooldownMs ?? this.cooldownMs
      if (!entry.active || at - entry.lastSentAt >= wait) {
        events.push({type: 'alert', ...finding, at: iso(at), generation: entry.sentCount + 1,
          _state: {previous: {...entry}, at}})
      }
    }
    // An incomplete check must never be treated as evidence that other
    // conditions have cleared; skip the recovery pass in that case.
    if (recover) {
      for (const [key, entry] of this.entries) {
        if (!entry.active || active.has(key)) continue
        if (entry.missingSince === null) entry.missingSince = at
        else if (at - entry.missingSince >= this.recoveryDelayMs) {
          events.push({type: 'recovery', key, severity: 'info', category: 'none', counts: {},
            at: iso(at), generation: entry.sentCount + 1, _state: {previous: {...entry}, at}})
        }
      }
    }
    return events
  }

  /** Advance state only after the provider confirms delivery. */
  commit(event = {}, at = event._state?.at ?? this.now()) {
    const previous = event._state?.previous
    if (!previous) return
    const entry = {...previous}
    if (event.type === 'alert') {
      entry.active = true
      entry.lastSentAt = at
      entry.missingSince = null
      entry.sentCount += 1
    } else {
      entry.active = false
      entry.missingSince = null
    }
    this.entries.set(event.key, entry)
  }
}

export function alertText(event = {}) {
  const label = LABELS[event.key] || 'Unknown monitoring condition'
  const action = ACTIONS[event.key] || 'Review the monitoring configuration.'
  const lines = [
    `Projecta Jobs ${event.type === 'recovery' ? 'RESOLVED' : 'ALERT'}: ${label}`,
    `Code: ${event.key}`,
    `Detected: ${event.at || 'unknown'}`,
    `Category: ${ALLOWED_CATEGORIES.has(event.category) ? event.category : 'unavailable'}`,
  ]
  for (const [name, value] of Object.entries(event.counts || {})) {
    if (/^[a-zA-Z]+$/.test(name) && Number.isFinite(value)) lines.push(`${name}: ${number(value)}`)
  }
  lines.push('', `Action: ${action}`, 'This message contains no job content, private messages or personal data.')
  return lines.join('\n')
}

/** Resend REST delivery: no new dependency, bearer token only in the request header. */
export function createEmailNotifier(env = process.env, {
  fetchImpl = globalThis.fetch,
  endpoint = 'https://api.resend.com/emails',
  now = Date.now,
  recipients = OWNER_EMAILS,
} = {}) {
  const apiKey = env.RESEND_API_KEY
  const from = env.ALERT_FROM_EMAIL
  const to = [...new Set(recipients)]
  return {
    configured() { return Boolean(apiKey && from && to.length) },
    async send(event = {}) {
      if (!this.configured()) return {delivered: false, reason: 'not_configured'}
      const bucket = Math.floor(now() / (event.cooldownMs || DEFAULT_THRESHOLDS.cooldownMs))
      const generation = Number.isFinite(event.generation) ? event.generation : 0
      const idempotencyKey = createHash('sha256')
        .update(`${event.key}|${event.type}|${bucket}|${generation}|${to.join(',')}`)
        .digest('hex')
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to,
          subject: `[Projecta Jobs] ${event.type === 'recovery' ? 'RESOLVED' : 'ALERT'} ${LABELS[event.key] || 'Monitoring'}`,
          text: alertText(event),
        }),
        signal: AbortSignal.timeout(DEFAULT_THRESHOLDS.requestTimeoutMs),
      })
      if (!response.ok) throw new Error(`Alert provider rejected request (${response.status})`)
      return {delivered: true, status: response.status, to}
    },
  }
}

/** Read-only snapshot built from existing tables; no schema or cron changes. */
export async function buildSnapshot(db, now = Date.now(), factory = AbortSignal.timeout) {
  const check = result => { if (result.error) throw result.error; return result }
  const signal = () => factory(10000)
  const control = check(await db.from('telegram_sync_control')
    .select('last_success_at,last_error,last_summary,lease_until').eq('id', 1).limit(1).abortSignal(signal()))
  // Moderation holds also live in the retry state; they are not write failures.
  const retryCount = check(await db.from('telegram_ingestion_messages')
    .select('*', {count: 'exact', head: true}).eq('state', 'retry')
    .or('error_type.is.null,error_type.not.like.review:%').abortSignal(signal()))
  const retries = check(await db.from('telegram_ingestion_messages')
    .select('attempts,error_type,next_attempt_at,updated_at').eq('state', 'retry')
    .lt('next_attempt_at', new Date(now).toISOString()).order('attempts', {ascending: false}).limit(50).abortSignal(signal()))
  const oldestHold = check(await db.from('telegram_ingestion_messages')
    .select('updated_at').eq('state', 'retry').like('error_type', 'review:%')
    .order('updated_at', {ascending: true}).limit(1).abortSignal(signal()))
  const pendingCount = check(await db.from('job_offers')
    .select('*', {count: 'exact', head: true}).eq('status', 'pending').abortSignal(signal()))
  const oldestPending = check(await db.from('job_offers')
    .select('created_at').eq('status', 'pending').order('created_at', {ascending: true}).limit(1).abortSignal(signal()))
  const checkpoints = check(await db.from('telegram_sync_checkpoints').select('counts').abortSignal(signal()))
  const sourceDates = (checkpoints.data || []).map(row => time(row?.counts?.newest_source_post_at)).filter(Number.isFinite)
  const row = control.data?.[0] || {}
  return {
    sync: {
      lastSuccessAt: row.last_success_at || null,
      lastError: row.last_error || null,
      lastSummaryError: row.last_summary?.error || null,
      leaseUntil: row.lease_until || null,
    },
    retryCount: retryCount.count || 0,
    retries: retries.data || [],
    moderation: {
      pendingCount: pendingCount.count || 0,
      oldestPendingAt: oldestPending.data?.[0]?.created_at || null,
      oldestReviewHoldAt: oldestHold.data?.[0]?.updated_at || null,
    },
    newestSourcePostAt: sourceDates.length ? iso(Math.max(...sourceDates)) : null,
  }
}
