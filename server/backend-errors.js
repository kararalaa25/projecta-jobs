// Error messages may contain request values. Expose only bounded diagnostic categories.
export function backendReason(error,status){
 const code=String(error?.code||error?.cause?.code||'')
 const message=String(error?.message||'').toLowerCase()
 if(code==='PGRST125'||code==='SERVER_CONFIG'||code==='ERR_INVALID_URL'||/supabaseurl|supabasekey.*required|invalid url|failed to parse url|invalid.*header|invalid character|bytestring/.test(message))return 'configuration'
 if(code==='42501')return 'permissions'
 if(status===401||status===403||/jwt|api.?key|invalid signature/.test(message))return 'credentials'
 if(['42703','42P01','PGRST202','PGRST204','PGRST205'].includes(code))return 'schema'
 if(/fetch failed|timeout|abort|network|dns/.test(message)||['ENOTFOUND','ECONNREFUSED','ETIMEDOUT'].includes(code))return 'connection'
 return 'unavailable'
}
export function safeBackendCode(error){const code=String(error?.code||error?.cause?.code||'');return /^(?:[0-9A-Z]{5}|PGRST[0-9]{3}|ERR_[A-Z_]{1,40}|UND_ERR_[A-Z_]{1,40}|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|SERVER_CONFIG)$/.test(code)?code:undefined}
