import {useState} from 'react'
import {accountRequest} from '../admin/client'
export default function ApplicationForm({job,onSuccess}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{await accountRequest({job_id:job.id,...Object.fromEntries(new FormData(e.currentTarget))});onSuccess()}catch(error){setError(error.message)}finally{setBusy(false)}}
 return <form onSubmit={submit}><p className="modal-intro" dir="auto">{job.title}</p><label>نبذة عن خبرتك وملاءمتك للفرصة<textarea name="cover_letter" minLength={10} maxLength={4000} required rows={5}/></label><label>رابط السيرة الذاتية — اختياري<input name="cv_url" type="url" dir="ltr" placeholder="https://…" maxLength={2000}/></label><p className="local-note">تُحفظ بيانات الطلب للمتابعة من إدارة المنصة. لا يعني الإرسال قبولك في الوظيفة.</p>{error&&<p className="form-message" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'جارٍ الإرسال…':'إرسال طلب التوظيف'}</button></form>
}
