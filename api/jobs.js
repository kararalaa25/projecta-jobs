import { createClient } from '@supabase/supabase-js'
import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici'

// Server-only module: never import from src/ or expose service credentials via VITE_.
export function createJobsHandler(env = process.env, clientFactory = createClient) {
  const dispatcher = env.HTTPS_PROXY || env.HTTP_PROXY
    ? new EnvHttpProxyAgent({ httpProxy: env.HTTP_PROXY, httpsProxy: env.HTTPS_PROXY, noProxy: env.NO_PROXY })
    : undefined
  return async function jobs(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      res.statusCode = 405
      return res.end(JSON.stringify({ error: 'Method not allowed' }))
    }
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      res.statusCode = 503
      return res.end(JSON.stringify({ error: 'The job feed is not configured on this server.' }))
    }
    let upstreamStatus
    try {
      const db = clientFactory(url, key, { auth: { persistSession: false, autoRefreshToken: false },
        ...(dispatcher ? { global: { fetch: (input, init) => proxyFetch(input, { ...init, dispatcher }) } } : {}),
      })
      // Active marketplace posts only. Never expose user/account IDs or other tables.
      const fields = 'id,title,role_category,employment_type,location_city,salary_range,description,contact_info,source,created_at'
      const query = columns => db.from('job_offers').select(columns)
        .eq('status', 'active').order('created_at', { ascending: false }).limit(200)
        .abortSignal(AbortSignal.timeout(15000))
      let result = await query(fields + ',contact_phone,contact_telegram,contact_whatsapp')
      if (['42703','PGRST204'].includes(result.error?.code)) result = await query(fields)
      const { data, error, status } = result
      upstreamStatus = status
      if (error) throw error
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
      res.statusCode = 200
      return res.end(JSON.stringify({ jobs: data || [] }))
    } catch (error) {
      console.error("Job feed unavailable:", error?.name || "Error", error?.code || error?.cause?.code || "unknown")
      res.statusCode = 502
      const detail = String(error?.message || '').toLowerCase()
      const reason = upstreamStatus === 401 || upstreamStatus === 403 || /jwt|api key/.test(detail)
        ? 'credentials' : /fetch failed|timeout|abort/.test(detail) ? 'connection'
        : ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code) ? 'schema' : 'unavailable'
      return res.end(JSON.stringify({ error: 'Live jobs are temporarily unavailable. Please try again.', reason }))
    }
  }
}

export default createJobsHandler()
