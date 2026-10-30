import {serverClient,serverAuthClient} from '../server/supabase.js'
import {isPlatformOffer} from '../config/job-feeds.js'
import {isSuperAdmin,isOwner,isSuspended,hasConfirmedIdentity} from '../config/access.js'
import {headers,json,sameOrigin,readBody,authenticate,bearerToken,HttpError,check,uuid,text,errorResponse,missingSchema} from '../server/http.js'
import {readPlatform,adminMutation} from '../server/platform.js'
import {normalizeIraqiPhone,telegramHandle} from '../src/contacts.js'
const memberRoles=['member','moderator','admin','super_admin']
export const publicUser=user=>({id:user.id,email:user.email||'',phone:user.phone||'',created_at:user.created_at,last_sign_in_at:user.last_sign_in_at,confirmed:hasConfirmedIdentity(user),owner:isOwner(user),role:isOwner(user)?'super_admin':user.app_metadata?.role||'member',verified:isOwner(user)||user.app_metadata?.medical_professional_verified===true,verification_status:isOwner(user)?'approved':user.app_metadata?.verification_status||'not_submitted',suspended:isSuspended(user),suspension:isSuspended(user)?user.app_metadata?.suspension_kind||'ban':'none',license:{name:String(user.user_metadata?.full_name||'').slice(0,150),profession:String(user.user_metadata?.profession||'').slice(0,150),number:String(user.user_metadata?.license_number||'').slice(0,150),url:/^https:\/\//.test(user.user_metadata?.license_url||'')?String(user.user_metadata.license_url).slice(0,2000):''}})
const pageOf=url=>{const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>1000)throw new HttpError(400,'رقم صفحة غير صالح.');return page}
const jobColumns='id,title,role_category,employment_type,location_city,salary_range,description,contact_info,source,status,created_at'
export function adminJobRecord(job,catalog){
 if(!job||typeof job!=='object')throw new HttpError(400,'بيانات الإعلان غير صالحة.')
 const role=text(job.role||'',100,false),city=text(job.city||'',100,false)
 if(role&&!catalog.some(c=>c.kind==='role'&&c.id===role)||city&&!catalog.some(c=>c.kind==='location'&&c.id===city))throw new HttpError(400,'يرجى اختيار تصنيف وموقع من القاموس.')
 const phone=job.phone?normalizeIraqiPhone(job.phone):null,telegram=job.telegram?telegramHandle(job.telegram):null
 if(job.phone&&!phone||job.telegram&&!telegram)throw new HttpError(400,'وسائل التواصل غير صالحة.')
 const schedule={'Full-time':'full_time','Part-time':'part_time',Contract:'contract'}[job.schedule]
 if(!schedule)throw new HttpError(400,'نوع الدوام غير صالح.')
 return {title:text(job.title,100),description:text(job.description,12000),role_category:role,location_city:city,salary_range:text(job.salary||'',100,false)||null,employment_type:schedule,source:'manual',status:'active',contact_phone:phone?.local||null,contact_whatsapp:phone?.whatsapp||null,contact_telegram:telegram,contact_info:JSON.stringify({company_name:text(job.company,100),phone:phone?.local||null,whatsapp:phone?.whatsapp||null,telegram,parsing_status:'admin_reviewed',role_category:role,role_categories:role?[role]:[],target_audience:catalog.filter(c=>c.kind==='role'&&c.id===role).map(c=>c.label),categorization:{source:'admin',primary:role||null,roles:role?[role]:[],needsReview:!role},governorate:city,governorates:city?[city]:[],employment_type:schedule})}
}
export function createAdminHandler(env=process.env,factory=serverClient,verifierFactory=factory===serverClient?serverAuthClient:factory){return async(req,res)=>{
 headers(res)
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'طريقة الطلب غير مسموحة.'})
 try{
  sameOrigin(req,env)
  // Verify identity remotely on EVERY request. Browser metadata never authorizes writes.
  bearerToken(req)
  const actor=await authenticate(verifierFactory(env),req)
  if(!isSuperAdmin(actor))throw new HttpError(403,'هذه الصفحة مخصصة للمشرف الأعلى فقط.')
  const db=factory(env)
  const url=new URL(req.url||'/','http://localhost'),section=url.searchParams.get('section')||'overview',page=pageOf(url),start=(page-1)*30
  if(req.method==='GET'){
   if(section==='session')return json(res,200,{user:publicUser(actor)})
   if(section==='overview'){
    let total=0,pending=0,complete=false
    for(let p=1;p<=100;p++){const r=await db.auth.admin.listUsers({page:p,perPage:1000});if(r.error)throw r.error;const users=r.data.users;total+=users.length;pending+=users.filter(u=>!isOwner(u)&&u.app_metadata?.verification_status==='pending').length;if(users.length<1000){complete=true;break}}
    const [jobs,applications,platform]=await Promise.all([db.from('job_offers').select('id',{count:'exact',head:true}).eq('status','active'),db.from('job_applications').select('id',{count:'exact',head:true}),readPlatform(db)])
    if(jobs.error)throw jobs.error;if(applications.error&&!missingSchema(applications.error))throw applications.error
    return json(res,200,{metrics:{users:complete?total:null,usersScanned:total,active:jobs.count,pending:complete?pending:null,applications:applications.error?null:applications.count},platform,updatedAt:new Date().toISOString()})
   }
   if(section==='users'){const r=await db.auth.admin.listUsers({page,perPage:30});if(r.error)throw r.error;return json(res,200,{rows:r.data.users.map(publicUser),hasMore:r.data.users.length===30})}
   if(section==='jobs'){let q=db.from('job_offers').select(jobColumns,{count:'exact'}).order('created_at',{ascending:false}).range(start,start+29);const status=url.searchParams.get('status');if(status&&status!=='all')q=q.eq('status',text(status,30));const search=url.searchParams.get('search');if(search)q=q.ilike('title',`%${text(search,150)}%`);const r=await q;return json(res,200,{rows:check(r),total:r.count,hasMore:start+30<r.count})}
   if(section==='catalog'||section==='settings')return json(res,200,await readPlatform(db))
   const table=section==='applications'?'job_applications':section==='audit'?'admin_audit_log':section==='data'?url.searchParams.get('table'):null
   const columns={job_offers:jobColumns,job_applications:'id,job_id,applicant_id,cover_letter,cv_url,resume_asset_id,status,created_at',platform_settings:'id,value,updated_at',admin_catalog:'id,kind,label,position,active',admin_audit_log:'id,actor_id,operation,target_id,created_at'}
   if(!Object.hasOwn(columns,table||''))throw new HttpError(400,'القسم أو الجدول غير مسموح.')
   const r=await db.from(table).select(columns[table],{count:'exact'}).order(table==='admin_catalog'?'position':table==='platform_settings'?'updated_at':'created_at',{ascending:false}).range(start,start+29)
   return json(res,200,{rows:check(r),hasMore:start+30<r.count,total:r.count})
  }
  const body=await readBody(req),action=body.action
  async function saved(target){const audit=await db.from('admin_audit_log').insert({actor_id:actor.id,operation:action,target_id:target||null});return json(res,200,{ok:true,warning:audit.error?'تم الحفظ، لكن سجل التدقيق غير متاح؛ طبّق ترحيل 007.':null})}
  if(action==='user.update'){
   const id=uuid(body.id),r=await db.auth.admin.getUserById(id);if(r.error)throw r.error;const target=r.data.user
   if(isOwner(target))throw new HttpError(403,'حسابات المالك محمية من تغيير الصلاحيات أو التعليق.')
   if(id===actor.id)throw new HttpError(403,'لا يمكنك تعديل صلاحيات حسابك من هذه الشاشة.')
   const meta={...target.app_metadata};let ban
   if(body.role!==undefined){if(!memberRoles.includes(body.role))throw new HttpError(400,'صلاحية غير صالحة.');meta.role=body.role}
   if(body.verified!==undefined){if(typeof body.verified!=='boolean')throw new HttpError(400,'قيمة غير صالحة.');meta.medical_professional_verified=body.verified;meta.verification_status=body.verified?'approved':'rejected'}
   if(body.verification_status!==undefined){if(!['not_submitted','pending','approved','rejected'].includes(body.verification_status))throw new HttpError(400,'حالة غير صالحة.');meta.verification_status=body.verification_status;meta.medical_professional_verified=body.verification_status==='approved'}
   if(body.suspension!==undefined){if(!['none','week','ban'].includes(body.suspension))throw new HttpError(400,'مدة غير صالحة.');meta.suspended=body.suspension!=='none';meta.suspension_kind=body.suspension;meta.suspended_until=body.suspension==='none'?null:new Date(Date.now()+(body.suspension==='week'?7:36500)*86400000).toISOString();ban=body.suspension==='none'?'none':body.suspension==='week'?'168h':'876000h'}
   // Store no passwords, access tokens, recovery links or private credentials in audit.
   const result=await db.auth.admin.updateUserById(id,{app_metadata:meta,...(ban?{ban_duration:ban}:{})});if(result.error)throw result.error
   const audit=await db.from('admin_audit_log').insert({actor_id:actor.id,operation:action,target_id:id})
   return json(res,200,{user:publicUser(result.data.user),warning:audit.error?'تم تحديث الحساب، لكن سجل التدقيق غير متاح. طبّق ترحيل 007.':null})
  }
  if(action==='user.recovery'){
   const r=await db.auth.admin.getUserById(uuid(body.id));if(r.error)throw r.error;const target=r.data.user
   if(!target.email)throw new HttpError(400,'هذا الحساب لا يملك بريداً إلكترونياً.')
   const sent=await db.auth.resetPasswordForEmail(target.email,{redirectTo:'https://projecta-jobs.vercel.app/'});if(sent.error)throw sent.error
   return saved(body.id)
  }
  if(action==='job.save'){
   const platform=await readPlatform(db);const record=adminJobRecord(body.job,platform.catalog)
   // New manual records use the current table schema; existing source provenance is retained.
   if(body.id){const id=uuid(body.id);const old=check(await db.from('job_offers').select('contact_info,source').eq('id',id).single());if(old.source==='manual'&&!isPlatformOffer(record))throw new HttpError(400,'إعلانات المنصة تتطلب عنواناً ووصفاً وراتباً ومحافظة ورقم هاتف عراقي.');let meta={};try{meta=JSON.parse(old.contact_info)||{};if(typeof meta!=='object'||Array.isArray(meta))meta={}}catch{};record.contact_info=JSON.stringify({...meta,...JSON.parse(record.contact_info)});delete record.source;delete record.status;const r=await db.from('job_offers').update(record).eq('id',id).select('id').single();check(r)}
   else {if(!isPlatformOffer(record))throw new HttpError(400,'إعلانات المنصة تتطلب عنواناً ووصفاً وراتباً ومحافظة ورقم هاتف عراقي.');if(!record.role_category||!record.location_city)throw new HttpError(400,'اختر التخصص والمحافظة للإعلان الجديد.');const created=check(await db.from('job_offers').insert({...record,publisher_id:actor.id}).select('id').single());return saved(created.id)}
   return saved(body.id)
  }
  if(action==='job.status'){
   if(!['active','pending','rejected','archived'].includes(body.status))throw new HttpError(400,'حالة غير صالحة.')
   check(await db.from('job_offers').update({status:body.status}).eq('id',uuid(body.id)).select('id').single());return saved(body.id)
  }
  if(action==='job.feature'){
   if(typeof body.featured!=='boolean')throw new HttpError(400,'قيمة غير صالحة.')
   const id=uuid(body.id),row=check(await db.from('job_offers').select('contact_info').eq('id',id).single());let meta={};try{meta=JSON.parse(row.contact_info)||{};if(typeof meta!=='object'||Array.isArray(meta))meta={}}catch{}
   check(await db.from('job_offers').update({contact_info:JSON.stringify({...meta,featured:body.featured})}).eq('id',id).select('id').single());return saved(body.id)
  }
  if(action==='job.delete'){if(body.confirmation!=='DELETE')throw new HttpError(400,'يرجى تأكيد الحذف.');check(await db.from('job_offers').delete().eq('id',uuid(body.id)).select('id').single());return saved(body.id)}
  if(action==='catalog.save'){
   const entry={id:text(body.entry?.id,100),label:text(body.entry?.label,100),kind:body.entry?.kind,position:body.entry?.position,active:body.entry?.active}
   if(!['role','location','tag'].includes(entry.kind)||!Number.isInteger(entry.position)||entry.position<0||entry.position>9999||typeof entry.active!=='boolean')throw new HttpError(400,'تصنيف غير صالح.')
   await adminMutation(db,actor,action,entry);return json(res,200,{ok:true})
  }
  if(action==='settings.save'){
   const s=body.settings;if(!s||typeof s.banner_enabled!=='boolean'||typeof s.maintenance!=='boolean')throw new HttpError(400,'إعدادات غير صالحة.')
   await adminMutation(db,actor,action,{banner_enabled:s.banner_enabled,maintenance:s.maintenance,banner_text:text(s.banner_text,1000,false)});return json(res,200,{ok:true})
  }
  if(action==='application.status'){if(!['submitted','reviewing','accepted','rejected'].includes(body.status))throw new HttpError(400,'حالة غير صالحة.');await adminMutation(db,actor,action,{id:uuid(body.id),status:body.status});return json(res,200,{ok:true})}
  throw new HttpError(400,'عملية غير مسموحة.')
 }catch(error){return errorResponse(res,error)}
}}
export default createAdminHandler()
