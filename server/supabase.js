import {normalizeSupabaseUrl} from '../config/supabase-url.js'
import { createClient } from '@supabase/supabase-js'
import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici'
export function serverClient(env = process.env, factory = createClient, { allowAnon = false } = {}) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || (allowAnon ? env.VITE_SUPABASE_ANON_KEY : null)
  if (!url || !key) { const error = new Error('إعدادات الخادم غير مكتملة. أضف SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY إلى بيئة Production في Vercel ثم أعد النشر.'); error.status=503; error.code='SERVER_CONFIG'; throw error }
  const dispatcher = env.HTTPS_PROXY || env.HTTP_PROXY ? new EnvHttpProxyAgent({httpProxy:env.HTTP_PROXY,httpsProxy:env.HTTPS_PROXY,noProxy:env.NO_PROXY}) : undefined
  return factory(normalizeSupabaseUrl(url),key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const timeout=AbortSignal.timeout(15000);const signal=init?.signal?AbortSignal.any([init.signal,timeout]):timeout;return (dispatcher?proxyFetch:globalThis.fetch)(input,{...init,...(dispatcher?{dispatcher}:{}),signal})}}})
}

// Identity verification can use the public key; privileged queries never do.
export const serverAuthClient=env=>serverClient(env,createClient,{allowAnon:true})
