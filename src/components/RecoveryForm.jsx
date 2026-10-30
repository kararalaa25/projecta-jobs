import {useState} from 'react'
import {supabase} from '../supabase'
import {authError} from '../auth'
export default function RecoveryForm({onSuccess}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(e){e.preventDefault();const form=new FormData(e.currentTarget),password=form.get('password');if(password!==form.get('confirmation')){setError('كلمتا المرور غير متطابقتين.');return}setBusy(true);try{const {error}=await supabase.auth.updateUser({password});if(error)throw error;onSuccess()}catch(e){setError(authError(e))}finally{setBusy(false)}}
 return <form onSubmit={submit}><p className="modal-intro">اختر كلمة مرور جديدة لحسابك بعد فتح رابط الاستعادة الآمن.</p><label>كلمة المرور الجديدة<input name="password" type="password" dir="ltr" minLength={12} maxLength={128} autoComplete="new-password" required/></label><label>تأكيد كلمة المرور<input name="confirmation" type="password" dir="ltr" minLength={12} maxLength={128} autoComplete="new-password" required/></label>{error&&<p className="form-message" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ كلمة المرور'}</button></form>
}
