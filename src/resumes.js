import {supabase} from './supabase'
export async function resumeRequest(body,id){
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('يرجى تسجيل الدخول أولاً.')
 const response=await fetch(`/api/resumes${id?'?id='+encodeURIComponent(id):''}`,{method:body?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const result=await response.json();if(!response.ok)throw Error(result.error||'تعذر معالجة السيرة الذاتية.');return result
}
export async function uploadResume(file,onStage){
 const reservation=await resumeRequest({action:'init',name:file.name,size:file.size,type:file.type})
 onStage('جارٍ رفع الملف بأمان…')
 const {error}=await supabase.storage.from(reservation.bucket).uploadToSignedUrl(reservation.path,reservation.token,file,{contentType:reservation.contentType,upsert:false})
 if(error)throw Error('تعذر رفع الملف. تحقق من الاتصال وأعد المحاولة.')
 onStage('جارٍ التحقق من الملف…')
 return resumeRequest({action:'complete',id:reservation.id})
}
