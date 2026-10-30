import {supabase} from '../supabase'
export async function adminRequest(section,body,params={}){
 const {data,error}=await supabase.auth.getSession()
 if(error||!data.session)throw Error('انتهت الجلسة. سجّل الدخول مجدداً.')
 const query=new URLSearchParams({section,...params})
 const response=await fetch(`/api/admin?${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const result=await response.json();if(!response.ok){const e=Error(result.error||'تعذر الاتصال بالخادم.');e.status=response.status;throw e}return result
}
export async function accountRequest(body){
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('يرجى تسجيل الدخول أولاً.')
 const response=await fetch('/api/applications',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)})
 const result=await response.json();if(!response.ok)throw Error(result.error||'تعذر الحفظ.');return result
}
