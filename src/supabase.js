import {normalizeSupabaseUrl} from '../config/supabase-url.js'
import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(normalizeSupabaseUrl(url), key, { global:{fetch:(input,init)=>{const timeout=AbortSignal.timeout(String(input).includes('/object/upload/sign/')?120000:20000);return fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,timeout]):timeout})}}, auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null
