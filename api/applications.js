import {notifyPublisherWhatsAppNewApplication} from '../lib/whatsapp.ts'
import {notifyPublisherNewApplication} from '../lib/telegram.js'
import {attachResume} from '../server/resumes.js'
import {serverClient} from '../server/supabase.js'
import {hasConfirmedIdentity,isSuspended,isSuperAdmin} from '../config/access.js'
import {readPlatform} from '../server/platform.js'
import {headers,json,sameOrigin,readBody,authenticate,bearerToken,HttpError,check,uuid,text,errorResponse} from '../server/http.js'
export function createApplicationsHandler(env=process.env,factory=serverClient,notifyWhatsApp=notifyPublisherWhatsAppNewApplication){return async(req,res)=>{
 headers(res)
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'طريقة الطلب غير مسموحة.'})
 try{
  sameOrigin(req,env);bearerToken(req);const db=factory(env),user=await authenticate(db,req)
  if(isSuspended(user)||!hasConfirmedIdentity(user))throw new HttpError(403,'يجب تأكيد الحساب وألّا يكون معلّقاً.')
  if(req.method==='GET'){const r=await db.from('job_applications').select('id,job_id,status,created_at').eq('applicant_id',user.id).order('created_at',{ascending:false}).limit(100);return json(res,200,{rows:check(r)})}
  const platform=await readPlatform(db);if(platform.settings.maintenance&&!isSuperAdmin(user))throw new HttpError(503,'المنصة قيد الصيانة حالياً. حاول لاحقاً.')
  const body=await readBody(req)
  if(body.action==='license.submit')throw new HttpError(409,'استخدم الملف الشخصي المكتمل وطلب التوثيق المنظم من قائمة حسابك.');
  const job=check(await db.from('job_offers').select('id,status').eq('id',uuid(body.job_id)).single());if(job.status!=='active')throw new HttpError(400,'الإعلان غير متاح للتقديم.')
  if(body.cv_url)throw new HttpError(400,'ارفع ملف السيرة الذاتية بدلاً من إدخال رابط خارجي.')
  const resume=body.resume_asset_id?await attachResume(db,uuid(body.resume_asset_id),user.id):null
  const letter=text(body.cover_letter,4000);if(letter.length<10)throw new HttpError(400,'اكتب نبذة لا تقل عن 10 أحرف.')
  const r=await db.from('job_applications').insert({job_id:job.id,applicant_id:user.id,cover_letter:letter,cv_url:null,...(resume?{resume_asset_id:resume}:{})}).select('id').single()
  if(r.error?.code==='23514'&&String(r.error.message).includes('resume_not_ready'))throw new HttpError(409,'تغيّرت حالة السيرة الذاتية. ارفع الملف مجدداً قبل إرسال الطلب.')
  if(r.error?.code==='23505')throw new HttpError(409,'سبق أن قدمت لهذا الإعلان.')
  const applicationId=check(r).id
  // Notification failure never turns a committed application into a failed submission.
  if(env.TELEGRAM_BOT_TOKEN)try{
   const offer=check(await db.from('job_offers').select('publisher_id,title').eq('id',job.id).single())
   if(offer.publisher_id){const publisher=check(await db.from('profiles').select('telegram_chat_id').eq('user_id',offer.publisher_id).maybeSingle());if(publisher?.telegram_chat_id)await notifyPublisherNewApplication(publisher.telegram_chat_id,user.user_metadata?.full_name||'متقدم',offer.title,{env})}
  }catch{console.warn('Publisher Telegram notification was not delivered')}
  if(env.WHATSAPP_ACCESS_TOKEN)try{
   const offer=check(await db.from('job_offers').select('publisher_id,title').eq('id',job.id).single())
   if(offer.publisher_id){const publisher=check(await db.from('profiles').select('display_name,whatsapp_phone,whatsapp_opt_in').eq('user_id',offer.publisher_id).maybeSingle());if(publisher?.whatsapp_opt_in===true&&publisher.whatsapp_phone)await notifyWhatsApp(publisher.whatsapp_phone,user.user_metadata?.full_name||'متقدم',offer.title,publisher.display_name,{env})}
  }catch{console.warn('Publisher WhatsApp notification was not confirmed')}
  return json(res,201,{id:applicationId})
 }catch(error){return errorResponse(res,error)}
}}
export default createApplicationsHandler()
