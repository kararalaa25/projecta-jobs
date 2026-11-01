import {randomUUID} from 'node:crypto'
import {serverClient} from '../server/supabase.js'
import {hasConfirmedIdentity,isSuspended,isSuperAdmin} from '../config/access.js'
import {resumeFileSpec,RESUME_BUCKET} from '../config/resumes.js'
import {ownedResume,inspectResume,signedResumeDownload} from '../server/resumes.js'
import {readPlatform} from '../server/platform.js'
import {headers,json,sameOrigin,bearerToken,authenticate,readBody,uuid,HttpError,check,errorResponse} from '../server/http.js'
export function createResumesHandler(env=process.env,factory=serverClient){return async(req,res)=>{
 headers(res)
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'طريقة الطلب غير مسموحة.'})
 try{
  sameOrigin(req,env);bearerToken(req);const db=factory(env),user=await authenticate(db,req)
  if(!hasConfirmedIdentity(user)||isSuspended(user))throw new HttpError(403,'يجب تأكيد الحساب وألّا يكون معلّقاً.')
  if(req.method==='GET'){
   const id=uuid(new URL(req.url||'/','http://localhost').searchParams.get('id'))
   const asset=isSuperAdmin(user)?check(await db.from('resume_assets').select('id,user_id,object_path,filename,state').eq('id',id).maybeSingle()):await ownedResume(db,id,user.id)
   if(!asset)throw new HttpError(404,'السيرة الذاتية غير موجودة.')
   if(asset.state!=='ready')throw new HttpError(409,'هذا الملف غير متاح للتنزيل.')
   return json(res,200,await signedResumeDownload(db,asset))
  }
  const platform=await readPlatform(db);if(platform.settings.maintenance&&!isSuperAdmin(user))throw new HttpError(503,'المنصة قيد الصيانة حالياً.')
  const body=await readBody(req,4000)
  if(body.action==='init'){
   let spec;try{spec=resumeFileSpec(body.name,body.size,body.type)}catch(e){throw new HttpError(400,e.message)}
   const id=randomUUID(),path=`${user.id}/${id}.${spec.extension}`
   const reservation=await db.rpc('projecta_reserve_resume',{asset_id:id,owner_id:user.id,path,original_name:spec.filename,content_type:spec.mime,size_bytes:spec.size})
   if(reservation.error?.code==='P0001')throw new HttpError(429,'وصلت إلى الحد اليومي لرفع السير الذاتية. حاول لاحقاً.')
   check(reservation)
   const signed=check(await db.storage.from(RESUME_BUCKET).createSignedUploadUrl(path,{upsert:false}))
   return json(res,201,{id,path,token:signed.token,bucket:RESUME_BUCKET,contentType:spec.mime})
  }
  const asset=await ownedResume(db,uuid(body.id),user.id)
  if(body.action==='complete'){
   if(asset.state==='ready')return json(res,200,{id:asset.id,filename:asset.filename})
   if(asset.state!=='pending'||Date.parse(asset.expires_at)<Date.now())throw new HttpError(409,'انتهت مهلة الرفع. اختر الملف مجدداً.')
   const downloaded=await db.storage.from(RESUME_BUCKET).download(asset.object_path)
   if(downloaded.error)throw new HttpError(409,'لم يكتمل رفع الملف. أعد المحاولة.')
   let hash
   try{if(downloaded.data.size!==asset.byte_size)throw new HttpError(400,'حجم الملف لا يطابق طلب الرفع.');hash=await inspectResume(Buffer.from(await downloaded.data.arrayBuffer()),asset.object_path.split('.').at(-1))}
   catch(error){await db.storage.from(RESUME_BUCKET).remove([asset.object_path]);await db.from('resume_assets').update({state:'rejected'}).eq('id',asset.id);throw error}
   const finalized=check(await db.from('resume_assets').update({state:'ready',sha256:hash}).eq('id',asset.id).eq('state','pending').select('id').maybeSingle())
   if(!finalized&&(await ownedResume(db,asset.id,user.id)).state!=='ready')throw new HttpError(409,'تغيّرت حالة الملف. أعد المحاولة.')
   return json(res,200,{id:asset.id,filename:asset.filename})
  }
  if(body.action==='discard'){
   // License evidence shares the existing private PDF store. Retain documents
   // linked to a current profile, review, or review history for the owner.
   const profile=check(await db.from('profiles').select('medical_credentials').eq('user_id',user.id).maybeSingle()),credentials=profile?.medical_credentials||{}
   const evidence=[credentials.license_asset_id,credentials.verification_request?.snapshot?.license_asset_id,...(credentials.verification_history||[]).map(request=>request.snapshot?.license_asset_id)]
   if(evidence.includes(asset.id))throw new HttpError(409,'هذا الملف مرتبط ببيانات الترخيص أو طلب توثيق ولا يمكن حذفه.')
   const discarded=await db.rpc('projecta_discard_resume',{asset_id:asset.id,owner_id:user.id})
   if(discarded.error?.code==='P0001')throw new HttpError(409,'الملف مرتبط بطلب أو لم يعد متاحاً للحذف.')
   const path=check(discarded)
   check(await db.storage.from(RESUME_BUCKET).remove([path]));return json(res,200,{ok:true})
  }
  throw new HttpError(400,'عملية غير مسموحة.')
 }catch(error){return errorResponse(res,error)}
}}
export default createResumesHandler()
