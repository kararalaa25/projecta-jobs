import { createClient } from '@supabase/supabase-js'
import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici'
export function serverClient(env = process.env, factory = createClient) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server configuration unavailable')
  const dispatcher = env.HTTPS_PROXY || env.HTTP_PROXY ? new EnvHttpProxyAgent({httpProxy:env.HTTP_PROXY,httpsProxy:env.HTTPS_PROXY,noProxy:env.NO_PROXY}) : undefined
  return factory(url,key,{auth:{persistSession:false,autoRefreshToken:false},...(dispatcher?{global:{fetch:(input,init)=>proxyFetch(input,{...init,dispatcher,signal:init?.signal||AbortSignal.timeout(10000)})}}:{})})
}
