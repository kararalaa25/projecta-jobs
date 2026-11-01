import {supabase} from '../supabase'
export async function verificationRequest(body,signal){
 const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('يرجى تسجيل الدخول أولاً.')
 const response=await fetch('/api/verifications',{method:body?'POST':'GET',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const result=await response.json();if(!response.ok)throw Error(result.error||'تعذر تحديث الملف المهني.');return result
}
