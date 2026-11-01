import ProfileIdentity from './ProfileIdentity'
import {profileTrust} from '../../config/profile-trust.js'
import ResumeUpload from './ResumeUpload'
import {useState,useRef} from 'react'
import {accountRequest} from '../admin/client'
export default function ApplicationForm({job,user,onSuccess,onBusyChange}){
 const submitting=useRef(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[resume,setResume]=useState(null),[uploading,setUploading]=useState(false)
 async function submit(e){e.preventDefault();if(submitting.current||uploading)return;submitting.current=true;setBusy(true);onBusyChange?.(true);setError('');try{await accountRequest({job_id:job.id,...(resume?{resume_asset_id:resume.id}:{}),...Object.fromEntries(new FormData(e.currentTarget))});onSuccess()}catch(error){setError(error.message)}finally{submitting.current=false;setBusy(false);onBusyChange?.(false)}}
 return <form onSubmit={submit}>{user&&<ProfileIdentity name={user.user_metadata?.full_name||user.user_metadata?.name} verification={profileTrust(user)} specialty={user.app_metadata?.professional_specialty||user.user_metadata?.profession}/>}<p className="modal-intro" dir="auto">{job.title}</p><label>نبذة عن خبرتك وملاءمتك للفرصة<textarea name="cover_letter" disabled={busy||uploading} minLength={10} maxLength={4000} required rows={5}/></label><ResumeUpload disabled={busy} value={resume} onChange={setResume} onBusyChange={value=>{setUploading(value);onBusyChange?.(value)}}/><p className="local-note">تُحفظ بيانات الطلب للمتابعة من إدارة المنصة. لا يعني الإرسال قبولك في الوظيفة.</p>{error&&<p className="form-message" role="alert">{error}</p>}<button className="primary full" disabled={busy||uploading}>{busy?'جارٍ الإرسال…':'إرسال طلب التوظيف'}</button></form>
}
