import {canPublish,isSuperAdmin} from '../config/access.js'
import {readPlatform} from '../server/platform.js'
import { serverClient } from '../server/supabase.js'
import catalog from '../config/iraq.json' with { type: 'json' }
import { normalizeIraqiPhone, telegramHandle } from '../src/contacts.js'
const roles = new Set(catalog.roles.map(r=>r.id))
const schedules = {'Full-time':'full_time','Part-time':'part_time','Contract':'contract'}
const cities = new Set(catalog.governorates.map(g=>g.id))
export const verifiedProfessional=canPublish
export function validateJob(body,custom) {
  if (!body || typeof body!=='object' || Array.isArray(body)) throw Error('Invalid body')
  const field=(name,max)=>{const value=body[name];if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid field');return value.trim()}
  const title=field('title',100), company=field('company',100), description=field('description',4000), salary=field('salary',100)
  if(!(custom?new Set(custom.roles):roles).has(body.role)||!(custom?new Set(custom.cities):cities).has(body.city)||!schedules[body.schedule])throw Error('Invalid category')
  const phone=normalizeIraqiPhone(body.phone)
  if(!phone)throw Error('Invalid Iraqi phone')
  const telegram=body.telegram?telegramHandle(body.telegram):null
  if(body.telegram&&!telegram)throw Error('Invalid Telegram handle')
  return {title,role_category:body.role,employment_type:schedules[body.schedule],location_city:body.city,salary_range:salary,description,
    contact_info:JSON.stringify({phone:phone.local,whatsapp:phone.whatsapp,telegram,company_name:company}),source:'manual',status:'active'}
}
export function createPublishHandler(env=process.env, clientFactory=serverClient) {
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store')
    const send=(status,error)=>{res.statusCode=status;res.end(JSON.stringify({error}))}
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,'طريقة الطلب غير مسموحة.')}
    const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers?.authorization||'')?.[1]
    if(!token)return send(401,'يرجى تسجيل الدخول أولاً.')
    // No cookie authentication: every submission must carry a verified bearer token.
    if(req.headers?.origin){
      try{const allowed=new Set([env.VERCEL_URL?`https://${env.VERCEL_URL}`:null,env.APP_ORIGIN].filter(Boolean));const origin=new URL(req.headers.origin);const host=req.headers.host;if(origin.host!==host&&!allowed.has(origin.origin))return send(403,'مصدر الطلب غير مسموح.')}
      catch{return send(403,'مصدر الطلب غير مسموح.')}
    }
    let db,user
    try{
      db=clientFactory(env)
      const result=await db.auth.getUser(token)
      if(result.error||!result.data?.user)return send(401,'انتهت الجلسة. يرجى تسجيل الدخول مجدداً.')
      user=result.data.user
    }catch{return send(503,'خدمة التحقق غير متاحة مؤقتاً.')}
    if(!verifiedProfessional(user))return send(403,'يتطلب النشر حساباً طبياً معتمداً ووسيلة تواصل مؤكدة. يرجى التواصل مع إدارة المنصة لاعتماد الحساب.')
    let platform
    try{platform=await readPlatform(db)}catch{return send(503,'تعذر التحقق من حالة المنصة. حاول لاحقاً.')}
    if(platform.settings.maintenance&&!isSuperAdmin(user))return send(503,'المنصة قيد الصيانة حالياً. حاول لاحقاً.')
    let record
    try{
      let body=req.body
      if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return send(413,'حجم الطلب أكبر من المسموح.')}body=JSON.parse(raw)}
      if(typeof body==='string'){if(Buffer.byteLength(body)>16000)return send(413,'حجم الطلب أكبر من المسموح.');body=JSON.parse(body)}
      if(Buffer.byteLength(JSON.stringify(body))>16000)return send(413,'حجم الطلب أكبر من المسموح.')
      record=validateJob(body,{roles:platform.catalog.filter(c=>c.kind==='role'&&c.active).map(c=>c.id),cities:platform.catalog.filter(c=>c.kind==='location'&&c.active).map(c=>c.id)})
    }catch{return send(400,'يرجى التأكد من بيانات الإعلان ورقم الهاتف العراقي.')}
    try{
      // Ownership, source, status and all accepted columns are assigned by the server.
      const {data,error}=await db.from('job_offers').insert({...record,publisher_id:user.id}).select('id').single()
      if(error)throw error
      res.statusCode=201;return res.end(JSON.stringify({id:data.id}))
    }catch{return send(502,'تعذر حفظ الإعلان. لم يتم تأكيد النشر؛ يرجى المحاولة لاحقاً.')}
  }
}
export default createPublishHandler()
