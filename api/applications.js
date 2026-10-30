import {serverClient} from '../server/supabase.js'
import {hasConfirmedIdentity,isSuspended,isSuperAdmin} from '../config/access.js'
import {readPlatform} from '../server/platform.js'
import {headers,json,sameOrigin,readBody,authenticate,bearerToken,HttpError,check,uuid,text,errorResponse} from '../server/http.js'
export function createApplicationsHandler(env=process.env,factory=serverClient){return async(req,res)=>{
 headers(res)
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'طريقة الطلب غير مسموحة.'})
 try{
  sameOrigin(req,env);bearerToken(req);const db=factory(env),user=await authenticate(db,req)
  if(isSuspended(user)||!hasConfirmedIdentity(user))throw new HttpError(403,'يجب تأكيد الحساب وألّا يكون معلّقاً.')
  if(req.method==='GET'){const r=await db.from('job_applications').select('id,job_id,status,created_at').eq('applicant_id',user.id).order('created_at',{ascending:false}).limit(100);return json(res,200,{rows:check(r)})}
  const platform=await readPlatform(db);if(platform.settings.maintenance&&!isSuperAdmin(user))throw new HttpError(503,'المنصة قيد الصيانة حالياً. حاول لاحقاً.')
  const body=await readBody(req)
  if(body.action==='license.submit'){
   const profile={full_name:text(body.full_name,150),profession:text(body.profession,150),license_number:text(body.license_number,150),license_url:text(body.license_url||'',2000,false)}
   if(profile.license_url){try{if(new URL(profile.license_url).protocol!=='https:')throw Error()}catch{throw new HttpError(400,'رابط الترخيص يجب أن يبدأ بـ https://.')}}
   const result=await db.auth.admin.updateUserById(user.id,{user_metadata:{...user.user_metadata,...profile},...(!isSuperAdmin(user)?{app_metadata:{...user.app_metadata,medical_professional_verified:false,verification_status:'pending'}}:{})});if(result.error)throw result.error
   return json(res,200,{ok:true})
  }
  const job=check(await db.from('job_offers').select('id,status').eq('id',uuid(body.job_id)).single());if(job.status!=='active')throw new HttpError(400,'الإعلان غير متاح للتقديم.')
  const cv=text(body.cv_url||'',2000,false);if(cv){try{if(new URL(cv).protocol!=='https:')throw Error()}catch{throw new HttpError(400,'رابط السيرة الذاتية يجب أن يبدأ بـ https://.')}}
  const letter=text(body.cover_letter,4000);if(letter.length<10)throw new HttpError(400,'اكتب نبذة لا تقل عن 10 أحرف.')
  const r=await db.from('job_applications').insert({job_id:job.id,applicant_id:user.id,cover_letter:letter,cv_url:cv||null}).select('id').single()
  if(r.error?.code==='23505')throw new HttpError(409,'سبق أن قدمت لهذا الإعلان.')
  return json(res,201,{id:check(r).id})
 }catch(error){return errorResponse(res,error)}
}}
export default createApplicationsHandler()
