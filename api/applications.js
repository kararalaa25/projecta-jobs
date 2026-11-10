import {isJobFresh} from '../config/job-lifecycle.js'
import {employerApplicationStatuses} from '../config/application-status.js'
import {broadcastTrust} from '../server/verifications.js'
import {canPublish} from '../config/access.js'
import {accountApplications} from '../server/account-applications.js'
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
  if(req.method==='GET')return json(res,200,await accountApplications(db,user,new URL(req.url||'/','http://localhost')))
  const platform=await readPlatform(db);if(platform.settings.maintenance&&!isSuperAdmin(user))throw new HttpError(503,'المنصة قيد الصيانة حالياً. حاول لاحقاً.')
  const body=await readBody(req)
  if(body.action==='application.status'){
   if(!employerApplicationStatuses.includes(body.status))throw new HttpError(400,'حالة الطلب غير صالحة.')
   const result=check(await db.rpc('projecta_application_status',{p_actor:user.id,p_job:uuid(body.job_id),p_application:uuid(body.application_id),p_status:body.status}))
   if(!result)throw new HttpError(404,'الطلب غير موجود أو لا تملك صلاحية تعديله.')
   return json(res,200,{...result,warning:await broadcastTrust(db)})
  }
  if(body.action==='job.renew'){
   if(!canPublish(user))throw new HttpError(403,'تجديد الإعلان يتطلب حساباً مهنياً معتمداً.')
   const result=check(await db.rpc('projecta_renew_job',{p_actor:user.id,p_job:uuid(body.job_id)}))
   if(!result)throw new HttpError(404,'الإعلان غير موجود أو غير متاح للتجديد.')
   return json(res,200,result)
  }
  if(body.action==='license.submit')throw new HttpError(409,'استخدم الملف الشخصي المكتمل وطلب التوثيق المنظم من قائمة حسابك.');
  const job=check(await db.from('job_offers').select('id,status,created_at,renewed_at,expires_at').eq('id',uuid(body.job_id)).single());if(job.status!=='active'||!isJobFresh(job))throw new HttpError(400,'الإعلان غير متاح للتقديم.')
  if(body.cv_url)throw new HttpError(400,'ارفع ملف السيرة الذاتية بدلاً من إدخال رابط خارجي.')
  const resume=body.resume_asset_id?await attachResume(db,uuid(body.resume_asset_id),user.id):null
  const letter=text(body.cover_letter,4000);if(letter.length<10)throw new HttpError(400,'اكتب نبذة لا تقل عن 10 أحرف.')
  const r=await db.from('job_applications').insert({job_id:job.id,applicant_id:user.id,cover_letter:letter,cv_url:null,...(resume?{resume_asset_id:resume}:{})}).select('id').single()
  if(r.error?.code==='23514'&&String(r.error.message).includes('job_not_available'))throw new HttpError(409,'انتهت صلاحية الإعلان أو أُغلق قبل إرسال الطلب.')
  if(r.error?.code==='23514'&&String(r.error.message).includes('resume_not_ready'))throw new HttpError(409,'تغيّرت حالة السيرة الذاتية. ارفع الملف مجدداً قبل إرسال الطلب.')
  if(r.error?.code==='23505')throw new HttpError(409,'سبق أن قدمت لهذا الإعلان.')
  const applicationId=check(r).id
  // Notification failure never turns a committed application into a failed submission.
  if(env.TELEGRAM_BOT_TOKEN)try{
   const offer=check(await db.from('job_offers').select('publisher_id,title').eq('id',job.id).single())
   if(offer.publisher_id){const publisher=check(await db.from('profiles').select('telegram_chat_id').eq('user_id',offer.publisher_id).maybeSingle());if(publisher?.telegram_chat_id)await notifyPublisherNewApplication(publisher.telegram_chat_id,user.user_metadata?.full_name||'متقدم',offer.title,{env});else console.info('Notification skipped',{provider:'telegram',reason:'publisher_chat_not_linked'})}
  }catch(error){console.warn('Notification failed',error.diagnostics||{provider:'telegram',reason:'lookup_or_configuration_failed'})}
  if(env.WHATSAPP_ACCESS_TOKEN)try{
   const offer=check(await db.from('job_offers').select('publisher_id,title').eq('id',job.id).single())
   if(offer.publisher_id){const publisher=check(await db.from('profiles').select('display_name,whatsapp_phone,whatsapp_opt_in').eq('user_id',offer.publisher_id).maybeSingle());const phone=publisher?.whatsapp_opt_in===true&&publisher.whatsapp_phone?publisher.whatsapp_phone:env.WHATSAPP_NOTIFICATION_PHONE;const recipientName=phone===publisher?.whatsapp_phone?publisher.display_name:env.WHATSAPP_NOTIFICATION_RECIPIENT_NAME;if(phone){console.info('Notification attempt',{provider:'whatsapp',template:'new_job_applicant',recipient:phone===publisher?.whatsapp_phone?'publisher':'configured_admin'});await notifyWhatsApp(phone,user.user_metadata?.full_name||'متقدم',offer.title,recipientName,{env});console.info('Notification accepted',{provider:'whatsapp'})}else console.info('Notification skipped',{provider:'whatsapp',reason:'no_opted_in_publisher_or_admin'})}
  }catch(error){console.warn('Notification failed',error.diagnostics||{provider:'whatsapp',reason:'lookup_or_configuration_failed'})}
  return json(res,201,{id:applicationId})
 }catch(error){return errorResponse(res,error)}
}}
export default createApplicationsHandler()
