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
    try {
      const db = clientFactory(url, key, { auth: { persistSession: false, autoRefreshToken: false },
        ...(dispatcher ? { global: { fetch: (input, init) => proxyFetch(input, { ...init, dispatcher }) } } : {}),
      })
      // Active marketplace posts only. Never expose user/account IDs or other tables.
      const { data, error } = await db.from('job_offers')
        .select('id,title,role_category,employment_type,location_city,salary_range,description,contact_info,source,created_at')
        .eq('status', 'active').order('created_at', { ascending: false }).limit(200)
        .abortSignal(AbortSignal.timeout(15000))
      if (error) throw error
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
      res.statusCode = 200
      return res.end(JSON.stringify({ jobs: data || [] }))
    } catch (error) {
      console.error("Job feed unavailable:", error?.name || "Error", error?.code || error?.cause?.code || "unknown")
      res.statusCode = 502
      return res.end(JSON.stringify({ error: 'Live jobs are temporarily unavailable. Please try again.' }))
    }
  }
}

export default createJobsHandler()
