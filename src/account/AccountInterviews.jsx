import {useEffect,useState} from 'react'
import {CalendarDays} from 'lucide-react'
import {supabase} from '../supabase'
import {exactDate} from '../dates'
export default function AccountInterviews({onExplore}){
 const [rows,setRows]=useState(null),[error,setError]=useState('')
 useEffect(()=>{const controller=new AbortController();(async()=>{try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error('يرجى تسجيل الدخول مجدداً.');const response=await fetch('/api/applications',{cache:'no-store',headers:{Authorization:`Bearer ${data.session.access_token}`},signal:controller.signal});const body=await response.json();if(!response.ok)throw Error(body.error||'تعذر تحميل الطلبات.');setRows(body.rows||[])}catch(failure){if(failure.name!=='AbortError')setError(failure.message)}})();return()=>controller.abort()},[])
 return <div className="account-interviews"><CalendarDays size={30}/><p className="account-note">لا توجد خدمة لتحديد مواعيد المقابلات داخل المنصة بعد. تظهر أدناه حالات طلباتك الفعلية؛ قبول الطلب لا يعني تحديد مقابلة.</p>{error?<p className="form-message" role="alert">{error}</p>:rows===null?<p role="status">جارٍ تحميل طلباتك…</p>:rows.length?<ul>{rows.map(row=><li key={row.id}><strong>{({submitted:'طلب مُرسل',reviewing:'قيد الدراسة',accepted:'طلب مقبول',rejected:'طلب غير مقبول'})[row.status]||'طلب توظيف'}</strong><time dateTime={row.created_at}>{exactDate(row.created_at)}</time><small>الإعلان {row.job_id.slice(0,8)}</small></li>)}</ul>:<p>لم تُرسل طلبات توظيف بعد.</p>}<button className="primary full" onClick={onExplore}>استكشف فرص العمل</button></div>
}
