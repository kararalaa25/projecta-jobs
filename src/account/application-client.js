import {supabase} from '../supabase'
export async function applicationRequest(params,signal){
 const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('يرجى تسجيل الدخول مجدداً.')
 const response=await fetch('/api/applications?'+new URLSearchParams(params),{cache:'no-store',headers:{Authorization:`Bearer ${data.session.access_token}`},signal:signal||AbortSignal.timeout(15000)}),body=await response.json();if(!response.ok)throw Error(body.error||'تعذر تحميل الطلبات.');return body
}
