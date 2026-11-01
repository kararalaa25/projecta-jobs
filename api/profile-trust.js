import {createClient} from '@supabase/supabase-js'
import {EnvHttpProxyAgent,fetch as proxyFetch} from 'undici'
import {normalizeSupabaseUrl} from '../config/supabase-url.js'
import {listingTrust} from '../server/profile-trust.js'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Separate, bounded enrichment keeps trust lookups off the critical job-feed path.
export function createProfileTrustHandler(env=process.env,factory=createClient){
 const dispatcher=env.HTTPS_PROXY||env.HTTP_PROXY?new EnvHttpProxyAgent({httpProxy:env.HTTP_PROXY,httpsProxy:env.HTTPS_PROXY,noProxy:env.NO_PROXY}):undefined
 return async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8')
  res.setHeader('Cache-Control','no-store, max-age=0')
  res.setHeader('CDN-Cache-Control','no-store')
  res.setHeader('Vercel-CDN-Cache-Control','no-store')
  res.setHeader('X-Content-Type-Options','nosniff')
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body))}
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'طريقة الطلب غير مسموحة.'})}
  const ids=new URL(req.url||'/', 'http://localhost').searchParams.get('ids')?.split(',')||[]
  if(!ids.length||ids.length>24||ids.some(id=>!UUID.test(id)))return send(400,{error:'طلب غير صالح.'})
  if(!env.SUPABASE_SERVICE_ROLE_KEY||!env.SUPABASE_URL)return send(503,{error:'حالة الاعتماد غير متاحة حالياً.'})
  try{
   const signal=AbortSignal.timeout(6000)
   const db=factory(normalizeSupabaseUrl(env.SUPABASE_URL),env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
    const options={...init,signal:init?.signal?AbortSignal.any([signal,init.signal]):signal}
    return dispatcher?proxyFetch(input,{...options,dispatcher}):fetch(input,options)
   }}})
   // Internal ownership is queried only for requested, publicly active jobs.
   // No account IDs, emails, phone numbers or documents enter this response.
   const {data,error}=await db.from('job_offers').select('id,publisher_id,source').eq('status','active').in('id',[...new Set(ids)]).abortSignal(signal)
   if(error)throw error
   return send(200,{jobs:await listingTrust(db,data||[])})
  }catch{return send(503,{error:'تعذر التحقق من حالة الاعتماد حالياً.'})}
 }
}
export default createProfileTrustHandler()
