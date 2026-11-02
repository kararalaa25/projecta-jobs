import {useState} from 'react'
import {Send} from 'lucide-react'
import {supabase} from '../supabase'
export default function TelegramNotifyButton({audience='applicant',label:customLabel}){
 const [busy,setBusy]=useState(false),[link,setLink]=useState(''),[error,setError]=useState('')
 const label=customLabel||(audience==='publisher'?'تفعيل إشعارات المتقدمين للوظيفة':'تفعيل إشعارات المواعيد على التليجرام')
 async function prepare(){setBusy(true);setError('');try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error('يرجى تسجيل الدخول أولاً.')
 const response=await fetch('/api/telegram/link',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`},signal:AbortSignal.timeout(15000)}),body=await response.json();if(!response.ok)throw Error(body.error||'تعذر تجهيز رابط التليجرام.')
 const url=new URL(body.url);if(url.origin!=='https://t.me'||url.pathname!=='/ProjectaJobsBot')throw Error('رابط غير صالح.');setLink(url.href);window.location.assign(url.href)
 }catch(failure){setError(failure.message)}finally{setBusy(false)}}
 return <div className="telegram-notify"><button type="button" className="telegram-notify-button" disabled={busy} onClick={prepare}><Send size={20} aria-hidden="true"/>{busy?'جارٍ تجهيز الرابط…':label}</button>{link&&<a className="telegram-notify-button" href={link} target="_blank" rel="noopener noreferrer">فتح ProjectaJobsBot وإكمال الربط</a>}{error&&<p role="alert" className="form-message">{error}</p>}</div>
}
