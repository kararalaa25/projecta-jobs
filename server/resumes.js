import {createHash} from 'node:crypto'
import yauzl from 'yauzl'
import {RESUME_BUCKET,MAX_RESUME_BYTES} from '../config/resumes.js'
import {check,HttpError} from './http.js'
export async function inspectResume(bytes,extension){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_RESUME_BYTES)throw new HttpError(400,'حجم السيرة الذاتية غير صالح.')
 if(extension==='pdf'){
  if(bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(Math.max(0,bytes.length-2048)).includes(Buffer.from('%%EOF')))throw new HttpError(400,'ملف PDF غير صالح.')
 }else if(extension==='docx'){
  await new Promise((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
   if(error)return reject(new HttpError(400,'ملف DOCX غير صالح.'))
   let count=0,total=0;const names=new Set();let done=false
   const fail=()=>{if(done)return;done=true;zip.close();reject(new HttpError(400,'ملف DOCX غير صالح أو مشفّر أو يتجاوز حدود الفحص.'))}
   zip.on('error',fail);zip.on('entry',entry=>{
    count++;total+=entry.uncompressedSize
    if(count>256||total>20*1024*1024||entry.generalPurposeBitFlag&1||/vbaProject\.bin$/i.test(entry.fileName)||entry.fileName.split('/').includes('..')||names.has(entry.fileName))return fail()
    names.add(entry.fileName);zip.readEntry()
   });zip.on('end',()=>{if(done)return;if(!names.has('[Content_Types].xml')||!names.has('word/document.xml'))return fail();done=true;resolve()});zip.readEntry()
  }))
 }else throw new HttpError(400,'صيغة غير مدعومة.')
 return createHash('sha256').update(bytes).digest('hex')
}
export async function ownedResume(db,id,userId){
 const {data,error}=await db.from('resume_assets').select('id,user_id,object_path,filename,mime_type,byte_size,state,expires_at').eq('id',id).eq('user_id',userId).maybeSingle()
 if(error)throw error
 if(!data)throw new HttpError(404,'السيرة الذاتية غير موجودة أو لا تملك صلاحية الوصول إليها.')
 return data
}
export async function attachResume(db,id,userId){
 const asset=await ownedResume(db,id,userId)
 if(asset.state!=='ready')throw new HttpError(409,'اكتمل رفع الملف وفحصه أولاً قبل إرسال الطلب.')
 return asset.id
}
export async function signedResumeDownload(db,asset){
 const data=check(await db.storage.from(RESUME_BUCKET).createSignedUrl(asset.object_path,60,{download:asset.filename}))
 return {url:data.signedUrl,expiresIn:60,filename:asset.filename}
}
