import ResumeUpload from './ResumeUpload'
import {useState} from 'react'
import {accountRequest} from '../admin/client'
export default function ApplicationForm({job,onSuccess,onBusyChange}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[resume,setResume]=useState(null),[uploading,setUploading]=useState(false)
 async function submit(e){e.preventDefault();if(uploading)return;setBusy(true);onBusyChange?.(true);setError('');try{await accountRequest({job_id:job.id,...(resume?{resume_asset_id:resume.id}:{}),...Object.fromEntries(new FormData(e.currentTarget))});onSuccess()}catch(error){setError(error.message)}finally{setBusy(false);onBusyChange?.(false)}}
 return <form onSubmit={submit}><p className="modal-intro" dir="auto">{job.title}</p><label>نبذة عن خبرتك وملاءمتك للفرصة<textarea name="cover_letter" minLength={10} maxLength={4000} required rows={5}/></label><ResumeUpload value={resume} onChange={setResume} onBusyChange={value=>{setUploading(value);onBusyChange?.(value)}}/><p className="local-note">تُحفظ بيانات الطلب للمتابعة من إدارة المنصة. لا يعني الإرسال قبولك في الوظيفة.</p>{error&&<p className="form-message" role="alert">{error}</p>}<button className="primary full" disabled={busy||uploading}>{busy?'جارٍ الإرسال…':'إرسال طلب التوظيف'}</button></form>
}
