import {randomUUID} from 'node:crypto'
import {profileDraft,profileCompletion,validProfileKind,credentialUrl,credentialKeys,profileKinds,requiresSyndicateDocument,validEvidenceId} from '../config/account-profile.js'
import {profileTrust} from '../config/profile-trust.js'
import {isSuspended,hasConfirmedIdentity,isSuperAdmin} from '../config/access.js'
import {normalizeIraqiPhone,telegramHandle} from '../src/contacts.js'
import catalog from '../config/iraq.json' with {type:'json'}
import {HttpError,check,uuid,text} from './http.js'
const columns='user_id,display_name,specialty,governorate,profile_kind,medical_credentials,verification_status,verified_credentials,cv_asset_id,updated_at'
const record=profile=>profile?.medical_credentials||{}
export const requestOf=profile=>record(profile).verification_request||null
const editing=profile=>Date.parse(record(profile).editing?.until||'')>Date.now()
function busy(profile){if(editing(profile)||['submitting','pending','reviewing','withdrawing'].includes(requestOf(profile)?.status))throw new HttpError(409,'هناك طلب قيد المراجعة أو عملية حفظ جارية. اسحب الطلب المعلّق قبل تعديل الملف، وانتظر اكتمال المراجعة الجارية.')}
export function validateProfile(body,user,complete=false){
 const value={full_name:text(body.full_name||'',120,false),profession:text(body.profession||'',100,false),profile_kind:text(body.profile_kind||'dentist',40),governorate:text(body.governorate||'',100,false),phone:text(body.phone||'',30,false),license_number:text(body.license_number||'',150,false),license_url:text(body.license_url||'',2000,false),license_asset_id:text(body.license_asset_id||'',36,false),telegram_username:text(body.telegram_username||'',100,false)}
 if(value.profession&&!catalog.roles.some(role=>role.id===value.profession)||!validProfileKind(value))throw new HttpError(400,'اختر نوع حساب وتخصصاً متوافقين.')
 if(value.governorate&&!catalog.governorates.some(city=>city.id===value.governorate))throw new HttpError(400,'اختر محافظة صالحة.')
 if(value.phone&&!normalizeIraqiPhone(value.phone))throw new HttpError(400,'أدخل رقم هاتف عراقياً صالحاً.')
 if(value.license_url&&!credentialUrl(value.license_url))throw new HttpError(400,'مستند الترخيص يحتاج إلى رابط HTTPS صالح دون بيانات دخول.')
 if(value.license_asset_id&&!validEvidenceId(value.license_asset_id))throw new HttpError(400,'معرّف مستند الترخيص غير صالح.')
 if(value.telegram_username){const handle=telegramHandle(value.telegram_username);if(!handle)throw new HttpError(400,'اسم مستخدم تليجرام غير صالح.');value.telegram_username=handle}
 if(value.phone)value.phone=normalizeIraqiPhone(value.phone).local
 if(complete&&!profileCompletion({...user,user_metadata:value}).complete)throw new HttpError(400,'أكمل جميع متطلبات الملف وأكّد وسيلة الدخول قبل طلب التوثيق.')
 return value
}
// Upload ownership and ready state are checked on every save/submission/review;
// editable Auth metadata is never proof that a document was actually uploaded.
export async function licenseEvidence(db,user,value,required=requiresSyndicateDocument(value)){
 if(!value.license_asset_id){if(required)throw new HttpError(400,'ارفع بطاقة النقابة أو الترخيص بصيغة صورة أو PDF قبل طلب التوثيق.');return null}
 const asset=check(await db.from('resume_assets').select('id,user_id,state,filename,mime_type').eq('id',value.license_asset_id).eq('user_id',user.id).maybeSingle())
 if(!asset||asset.state!=='ready'||asset.mime_type!=='application/pdf')throw new HttpError(400,'مستند الترخيص غير متاح أو لم يكتمل فحصه. ارفع ملفك الشخصي بصيغة PDF أو صورة.')
 return asset
}
export async function getPrivateProfile(db,user,{create=true}={}){
 let row=check(await db.from('profiles').select(columns).eq('user_id',user.id).maybeSingle())
 if(row||!create)return row
 const draft=profileDraft(user),created=await db.from('profiles').insert({user_id:user.id,display_name:draft.full_name||'عضو بروجكتا',specialty:catalog.roles.some(role=>role.id===draft.profession)?draft.profession:'',governorate:catalog.governorates.some(city=>city.id===draft.governorate)?draft.governorate:null,profile_kind:profileKinds.some(([id])=>id===draft.profile_kind)?draft.profile_kind:'professional'}).select(columns).single()
 if(created.error?.code==='23505')row=check(await db.from('profiles').select(columns).eq('user_id',user.id).single());else row=check(created)
 return row
}
// Random revision tokens provide compare-and-swap even within one millisecond.
export async function changeProfile(db,old,credentials,fields={}){
 const medical_credentials={...credentials,revision:randomUUID()}
 let query=db.from('profiles').update({...fields,medical_credentials,updated_at:new Date().toISOString()}).eq('user_id',old.user_id)
 const revision=record(old).revision
 query=revision?query.eq('medical_credentials->>revision',revision):query.is('medical_credentials->>revision',null)
 const next=check(await query.select(columns).maybeSingle())
 if(!next)throw new HttpError(409,'تغيّر الملف أثناء العملية. أعد تحميل أحدث حالة وحاول مجدداً.')
 return next
}
export async function broadcastTrust(db){
 let channel
 try{channel=db.channel('projecta:trust');const status=await channel.send({type:'broadcast',event:'changed',payload:{version:Date.now()}});return status==='ok'?null:'تم الحفظ. سيُعاد التحقق تلقائياً إذا تعذر إشعار التحديث المباشر.'}catch{return 'تم الحفظ؛ تعذر الإشعار المباشر مؤقتاً.'}finally{if(channel)try{await db.removeChannel(channel)}catch{}}
}
const unverify=meta=>({...meta,medical_professional_verified:false,organization_verified:false,verification_status:'not_submitted',organization_verification_status:'unverified',verified_credentials:{}})
export async function saveProfile(db,user,body){
 const value=validateProfile(body,user),old=await getPrivateProfile(db,user);busy(old)
 await licenseEvidence(db,user,value,false)
 let cvId=old.cv_asset_id,cv
 if(body.cv_asset_id!==undefined){
  cvId=body.cv_asset_id===null?null:uuid(body.cv_asset_id)
  if(cvId){cv=check(await db.from('resume_assets').select('id,user_id,state,filename,byte_size,mime_type').eq('id',cvId).eq('user_id',user.id).single());if(cv.state!=='ready')throw new HttpError(409,'اكتمل رفع السيرة الذاتية وفحصها أولاً.')}
 }
 const edit={id:randomUUID(),until:new Date(Date.now()+60000).toISOString()}
 const locked=await changeProfile(db,old,{...record(old),editing:edit})
 let next,currentUser,material
 try{
  currentUser=check(await db.auth.admin.getUserById(user.id)).user
  if(isSuspended(currentUser))throw new HttpError(403,'هذا الحساب معلّق.')
  material=JSON.stringify(value)!==JSON.stringify(profileDraft(currentUser))
  next=check(await db.auth.admin.updateUserById(user.id,{user_metadata:{...currentUser.user_metadata,...value},...(material?{app_metadata:unverify(currentUser.app_metadata||{})}:{})})).user
 }
 catch(error){try{await changeProfile(db,locked,{...record(locked),editing:null})}catch{};throw error}
 const trust=profileTrust(next),verification_status=trust.status==='verified'?'verified':trust.status==='pending'?'pending':trust.status==='rejected'?'rejected':'unverified'
 const verified_credentials=Object.fromEntries(trust.credentials.map(key=>[key,true]))
 const saved=await changeProfile(db,locked,{...record(locked),editing:null,license_asset_id:value.license_asset_id||null},{display_name:value.full_name||'عضو بروجكتا',specialty:value.profession,governorate:value.governorate||null,profile_kind:value.profile_kind,cv_asset_id:cvId,verification_status,verified_credentials})
 return {user:next,profile:saved,cv,warning:await broadcastTrust(db)}
}
export async function submitVerification(db,user){
 if(!hasConfirmedIdentity(user)||isSuspended(user))throw new HttpError(403,'يجب تأكيد الحساب وألّا يكون معلّقاً.')
 const snapshot=validateProfile(profileDraft(user),user,true),old=await getPrivateProfile(db,user)
 await licenseEvidence(db,user,snapshot)
 const existing=requestOf(old)
 if(existing?.status!=='submitting')busy(old)
 if(editing(old))throw new HttpError(409,'انتظر اكتمال حفظ الملف.')
 if(old.verification_status==='verified')throw new HttpError(409,'هذا الملف معتمد بالفعل. حدّث بياناته أولاً عند الحاجة إلى مراجعة جديدة.')
 const request=existing?.status==='submitting'?existing:{id:randomUUID(),status:'submitting',submitted_at:new Date().toISOString(),snapshot}
 const saved=await changeProfile(db,old,{...record(old),verification_request:request},{verification_status:'pending'})
 // Submitting is durable but not approvable until Auth has dropped old approvals.
 const currentUser=check(await db.auth.admin.getUserById(user.id)).user
 if(isSuspended(currentUser)||!hasConfirmedIdentity(currentUser))throw new HttpError(403,'تعذر إرسال طلب من حساب معلّق أو غير مؤكد.')
 check(await db.auth.admin.updateUserById(user.id,{app_metadata:{...unverify(currentUser.app_metadata||{}),verification_status:'pending',organization_verification_status:['clinic','medical_center'].includes(request.snapshot.profile_kind)?'pending':'unverified'}}))
 const final=await changeProfile(db,saved,{...record(saved),verification_request:{...request,status:'pending'}})
 return {request:requestOf(final),warning:await broadcastTrust(db)}
}
export async function withdrawVerification(db,user){
 const old=await getPrivateProfile(db,user),request=requestOf(old)
 if(!['pending','withdrawing'].includes(request?.status))throw new HttpError(409,'يمكن سحب الطلبات المعلّقة فقط؛ المراجعة الجارية أو المكتملة لا يمكن سحبها.')
 const locked=await changeProfile(db,old,{...record(old),verification_request:{...request,status:'withdrawing'}})
 const currentUser=check(await db.auth.admin.getUserById(user.id)).user
 check(await db.auth.admin.updateUserById(user.id,{app_metadata:unverify(currentUser.app_metadata||{})}))
 const next=await changeProfile(db,locked,{...record(locked),verification_request:{...request,status:'withdrawn',withdrawn_at:new Date().toISOString()}},{verification_status:'unverified'})
 return {request:requestOf(next),warning:await broadcastTrust(db)}
}

export async function listVerifications(db,{page=1,status='pending'}={}){
 let query=db.from('profiles').select(columns,{count:'exact'}).not('medical_credentials->verification_request','is',null)
 if(status!=='all')query=query.eq('verification_status',status)
 const result=await query.order('updated_at',{ascending:false}).range((page-1)*30,page*30-1)
 const rows=check(result).filter(row=>requestOf(row)).map(row=>({user_id:row.user_id,request:requestOf(row),updated_at:row.updated_at,cv_asset_id:row.cv_asset_id}))
 return {rows,total:result.count,hasMore:page*30<result.count}
}
export async function verificationCount(db){const result=await db.from('profiles').select('user_id',{count:'exact',head:true}).not('medical_credentials->verification_request','is',null).eq('verification_status','pending');check(result);return result.count||0}
export async function reviewVerification(db,actor,body){
 if(!isSuperAdmin(actor))throw new HttpError(403,'هذه العملية للمشرف الأعلى فقط.')
 const userId=uuid(body.user_id),requestId=uuid(body.request_id)
 const target=check(await db.auth.admin.getUserById(userId)).user
 if(userId===actor.id)throw new HttpError(403,'لا يمكنك اعتماد طلبك بنفسك.')
 if(!hasConfirmedIdentity(target)||isSuspended(target))throw new HttpError(403,'لا يمكن اعتماد حساب غير مؤكد أو معلّق.')
 const old=await getPrivateProfile(db,target),request=requestOf(old)
 if(editing(old)||!request||request.id!==requestId)throw new HttpError(409,'تغيّر الطلب أو يجري حفظ الملف. أعد تحميله قبل المراجعة.')
 if(!['approve','reject'].includes(body.decision))throw new HttpError(400,'قرار غير صالح.')
 const credentials=body.credentials||[]
 const organization=['clinic','medical_center'].includes(request.snapshot.profile_kind)
 if(!Array.isArray(credentials)||credentials.some(key=>!credentialKeys.includes(key)||(organization?key!=='facility_license':key==='facility_license')))throw new HttpError(400,'إشارات المؤهلات لا تناسب نوع الحساب.')
 const note=text(body.note||'',1000,false)
 if(body.decision==='reject'&&note.length<8)throw new HttpError(400,'اذكر سبب الرفض بوضوح (ثمانية أحرف على الأقل).')
 if(body.decision==='approve'){await licenseEvidence(db,target,request.snapshot);if(requiresSyndicateDocument(request.snapshot)&&!credentials.includes('syndicate_membership'))throw new HttpError(400,'تحقق من العضوية النقابية وأضف شارتها قبل اعتماد الحساب الطبي.')}
 if(body.decision==='approve'&&body.evidence_reviewed!==true)throw new HttpError(400,'أكّد مراجعة مستند الترخيص قبل منح الشارة.')
 const decision={decision:body.decision,credentials:[...new Set(credentials)].sort(),note,reviewer_id:actor.id}
 let locked
 if(request.status==='reviewing'){
  if(JSON.stringify({...request.review,reviewer_id:actor.id})!==JSON.stringify(decision))throw new HttpError(409,'يوجد قرار قيد المزامنة. أعد محاولة القرار نفسه لإكماله.')
  locked=await changeProfile(db,old,{...record(old),verification_request:request})
 }else{
  if(request.status!=='pending')throw new HttpError(409,'تمت معالجة هذا الطلب بالفعل.')
  locked=await changeProfile(db,old,{...record(old),verification_request:{...request,status:'reviewing',review:decision}})
 }
 const currentTarget=check(await db.auth.admin.getUserById(userId)).user
 if(!hasConfirmedIdentity(currentTarget)||isSuspended(currentTarget))throw new HttpError(403,'لا يمكن اعتماد حساب غير مؤكد أو معلّق.')
 const approved=body.decision==='approve',flags=Object.fromEntries(credentials.map(key=>[key,true]))
 const meta={...unverify(currentTarget.app_metadata||{}),verification_status:approved?'approved':'rejected',profile_kind:request.snapshot.profile_kind,professional_specialty:request.snapshot.profession,
  medical_professional_verified:approved&&!organization,organization_verified:approved&&organization,organization_verification_status:organization?(approved?'approved':'rejected'):'unverified',verified_credentials:approved?flags:{},verified_request_id:request.id}
 // Retrying the same claimed decision is safe if Auth succeeded before a DB error.
 check(await db.auth.admin.updateUserById(userId,{app_metadata:meta}))
 const completed={...requestOf(locked),status:approved?'approved':'rejected',reviewed_at:new Date().toISOString()}
 await changeProfile(db,locked,{...record(locked),verification_request:completed,verification_history:[...(record(locked).verification_history||[]),completed].slice(-20)},
  {verification_status:approved?'verified':'rejected',verified_credentials:approved?flags:{}})
 const audit=await db.from('admin_audit_log').insert({actor_id:actor.id,operation:approved?'verification.approve':'verification.reject',target_id:request.id})
 return {request:completed,warning:await broadcastTrust(db)|| (audit.error?'تمت المراجعة؛ سجل التدقيق غير متاح مؤقتاً.':null)}
}

// Administrative role/ban writes share the same row lock protocol as reviews,
// so a stale Auth metadata merge cannot restore a revoked role or old approval.
export async function updateManagedAccount(db,target,patch,ban){
 const old=await getPrivateProfile(db,target)
 if(editing(old)||['submitting','reviewing','withdrawing'].includes(requestOf(old)?.status))throw new HttpError(409,'يجري تحديث الحساب أو مراجعة اعتماده. أعد المحاولة بعد اكتمال العملية.')
 const locked=await changeProfile(db,old,{...record(old),editing:{id:randomUUID(),until:new Date(Date.now()+60000).toISOString()}})
 let result
 try{const fresh=check(await db.auth.admin.getUserById(target.id)).user;result=await db.auth.admin.updateUserById(target.id,{app_metadata:{...fresh.app_metadata,...patch},...(ban?{ban_duration:ban}:{})});check(result)}
 finally{await changeProfile(db,locked,{...record(locked),editing:null})}
 return result
}
