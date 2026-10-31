import {publicJobOffer} from '../server/public-jobs.js'
import {isPlatformOffer} from '../config/job-feeds.js'
import {normalizeSupabaseUrl} from '../config/supabase-url.js'
import {backendReason,safeBackendCode} from '../server/backend-errors.js'
import { createClient } from '@supabase/supabase-js'
import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Server-only module: never import from src/ or expose service credentials via VITE_.
export function createJobsHandler(env = process.env, clientFactory = createClient) {
  const dispatcher = env.HTTPS_PROXY || env.HTTP_PROXY
    ? new EnvHttpProxyAgent({ httpProxy: env.HTTP_PROXY, httpsProxy: env.HTTPS_PROXY, noProxy: env.NO_PROXY })
    : undefined
  return async function jobs(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control','no-store, max-age=0')
    res.setHeader('CDN-Cache-Control','no-store')
    res.setHeader('Vercel-CDN-Cache-Control','no-store')
    res.setHeader('X-Content-Type-Options','nosniff')
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
    let offset,feed,ids
    try {const params=new URL(req.url||'/', 'http://localhost').searchParams;offset=Number(params.get('offset')||0);feed=params.get('feed')||'all';ids=params.has('ids')?params.get('ids').split(','):null} catch {offset=NaN}
    if(!Number.isInteger(offset)||offset<0||offset>20000||!['all','platform','telegram'].includes(feed)||(ids&&(!ids.length||ids.length>100||ids.some(id=>!UUID.test(id))))){res.statusCode=400;return res.end(JSON.stringify({error:'طلب غير صالح.'}))}
    let upstreamStatus
    try {
      const db = clientFactory(normalizeSupabaseUrl(url), key, { auth: { persistSession: false, autoRefreshToken: false },
        ...(dispatcher ? { global: { fetch: (input, init) => proxyFetch(input, { ...init, dispatcher }) } } : {}),
      })
      // Active marketplace posts only. Never expose user/account IDs or other tables.
      const fields = 'id,title,role_category,employment_type,location_city,salary_range,description,contact_info,source,created_at'
      const query = columns => {
        let q=db.from('job_offers').select(columns).eq('status','active')
        if(feed!=='all')q=q.eq('source',feed==='telegram'?'telegram':'manual')
        if(ids)q=q.in('id',[...new Set(ids)])
        return q.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+199).abortSignal(AbortSignal.timeout(15000))
      }
      let result = await query(fields + ',contact_phone,contact_telegram,contact_whatsapp')
      if (['42703','PGRST204'].includes(result.error?.code)) result = await query(fields)
      const { data, error, status } = result
      upstreamStatus = status
      if (error) throw error
      res.statusCode = 200
      return res.end(JSON.stringify({ jobs: (data||[]).filter(row=>feed!=='platform'||isPlatformOffer(row)).map(publicJobOffer), hasMore:!ids&&(data||[]).length===200 }))
    } catch (error) {
      console.error("Job feed unavailable:", error?.name || "Error", error?.code || error?.cause?.code || "unknown")
      res.statusCode = error?.code==='SERVER_CONFIG'?503:502
      const reason = backendReason(error,upstreamStatus)
      return res.end(JSON.stringify({ error: 'تعذر تحميل الإعلانات حالياً. يرجى إعادة المحاولة.', reason, code:safeBackendCode(error) }))
    }
  }
}

export default createJobsHandler()
