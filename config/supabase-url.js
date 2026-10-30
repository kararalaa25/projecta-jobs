// The SDK appends /rest/v1, /auth/v1, etc. Accept dashboard API URLs as well as
// project roots without ever forwarding query credentials or duplicating paths.
export function normalizeSupabaseUrl(value){
 try{
  const url=new URL(String(value||'').trim())
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error()
  url.pathname=url.pathname.replace(/\/(?:rest|auth|storage|functions|realtime)\/v1(?:\/.*)?$/,'').replace(/\/+$/,'')
  url.search='';url.hash=''
  return url.toString().replace(/\/+$/,'')
 }catch{
  const error=Error('عنوان Supabase غير صالح. استخدم رابط المشروع الذي يبدأ بـ https:// ضمن SUPABASE_URL.')
  error.status=503;error.code='SERVER_CONFIG';throw error
 }
}
