import {backendReason,safeBackendCode} from './backend-errors.js'
export class HttpError extends Error { constructor(status,message){super(message);this.status=status} }
export function json(res,status,data){res.statusCode=status;res.end(JSON.stringify(data))}
export function headers(res){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')}
export function sameOrigin(req,env){
 if(!req.headers?.origin)return
 try{const url=new URL(req.headers.origin);const allowed=new Set([env.APP_ORIGIN,env.VERCEL_URL?`https://${env.VERCEL_URL}`:null].filter(Boolean));if(url.host===req.headers.host||allowed.has(url.origin))return}catch{}
 throw new HttpError(403,'مصدر الطلب غير مسموح.')
}
export async function readBody(req,max=32000){
 let body=req.body
 if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>max)throw new HttpError(413,'حجم الطلب أكبر من المسموح.')}body=raw}
 if(typeof body==='string'){if(Buffer.byteLength(body)>max)throw new HttpError(413,'حجم الطلب أكبر من المسموح.');try{body=JSON.parse(body)}catch{throw new HttpError(400,'بيانات الطلب غير صالحة.')}}
 if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>max)throw new HttpError(400,'بيانات الطلب غير صالحة.')
 return body
}
export function bearerToken(req){
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers?.authorization||'')?.[1]
 if(!token)throw new HttpError(401,'يرجى تسجيل الدخول أولاً.')
 return token
}
export async function authenticate(db,req){
 const token=bearerToken(req)
 const {data,error}=await db.auth.getUser(token)
 if(error||!data?.user)throw new HttpError(401,'انتهت الجلسة. سجّل الدخول مجدداً.')
 return data.user
}
export function check(result){if(result.error)throw result.error;return result.data}
export const uuid=value=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||''))throw new HttpError(400,'معرّف غير صالح.');return value}
export function text(value,max,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new HttpError(400,'يرجى التحقق من الحقول المطلوبة وأطوالها.');return value.trim()}
export const missingSchema=error=>['42P01','42703','PGRST204','PGRST205','PGRST202'].includes(error?.code)
export function errorResponse(res,error){if(error.status)return json(res,error.status,{error:error.message});if(missingSchema(error))return json(res,503,{error:'هذه الوحدة تحتاج إلى تطبيق ترحيل الإدارة 007 في Supabase.',migrationRequired:true});console.error('Admin operation failed:',error?.code||error?.name||'unknown');return json(res,502,{error:'تعذر إتمام العملية على الخادم. لم يتم تأكيد الحفظ؛ يرجى التحديث والمحاولة مجدداً.',reason:backendReason(error),code:safeBackendCode(error)})}
