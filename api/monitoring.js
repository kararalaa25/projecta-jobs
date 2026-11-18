import {headers,json} from '../server/http.js'
import {serverClient} from '../server/supabase.js'
import {backendReason} from '../server/backend-errors.js'
import {
  DEFAULT_THRESHOLDS, AlertState, buildSnapshot, createEmailNotifier, detectAlerts,
} from '../server/monitoring.js'

const sharedState = new AlertState()

export function createMonitoringHandler(env = process.env, factory = serverClient, {
  state = sharedState,
  notifierFactory = createEmailNotifier,
  now = Date.now,
} = {}) {
  const notifier = notifierFactory(env)
  return async (req, res) => {
    headers(res)
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST')
      return json(res, 405, {error: 'Method not allowed'})
    }
    const secret = env.MONITORING_SECRET
    if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
      return json(res, 401, {error: 'Unauthorized'})
    }
    if (!notifier.configured()) {
      return json(res, 503, {error: 'Alert provider is not configured', configured: false})
    }
    try {
      const snapshot = await buildSnapshot(factory(env), now())
      const findings = detectAlerts(snapshot, DEFAULT_THRESHOLDS, now())
      const events = state.evaluate(findings, now())
      const delivered = []
      for (const event of events) {
        const result = await notifier.send(event)
        state.commit(event, now())
        delivered.push({key: event.key, type: event.type, delivered: result.delivered})
      }
      return json(res, 200, {
        evaluated: findings.length,
        delivered,
        idle: findings.length === 0,
        newestSourcePostAt: snapshot.newestSourcePostAt,
      })
    } catch (error) {
      // A failed check is itself an alert, subject to the same dedupe/cooldown.
      const finding = {type: 'alert', key: 'monitoring_check_failed', severity: 'critical',
        category: backendReason(error), counts: {}, at: new Date(now()).toISOString(),
        cooldownMs: DEFAULT_THRESHOLDS.cooldownMs}
      for (const event of state.evaluate([finding], now(), {recover: false})) {
        try {
          await notifier.send(event)
          state.commit(event, now())
        } catch {}
      }
      return json(res, 502, {error: 'Monitoring check failed', reason: backendReason(error)})
    }
  }
}

export default createMonitoringHandler()
