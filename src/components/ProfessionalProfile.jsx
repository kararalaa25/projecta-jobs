import {useState} from 'react'
import ProfileIdentity from './ProfileIdentity'
import {profileTrust} from '../../config/profile-trust.js'
import {isSuperAdmin} from '../../config/access.js'
import {roles} from '../i18n.js'
import {accountRequest} from '../admin/client'
export default function ProfessionalProfile({user}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[submitted,setSubmitted]=useState(false)
 const originalTrust=profileTrust(user)
 const trust=submitted?{...originalTrust,status:'pending',credentials:[]}:originalTrust
 const specialty=roles.includes(user.app_metadata?.professional_specialty)?user.app_metadata.professional_specialty:null
 async function submit(e){e.preventDefault();setBusy(true);setMessage('');try{await accountRequest({action:'license.submit',...Object.fromEntries(new FormData(e.currentTarget))});setMessage('تم إرسال بياناتك المهنية للمراجعة. ستُفعّل صلاحية النشر بعد اعتماد الإدارة.');setOpen(false);setSubmitted(!isSuperAdmin(user));if(isSuperAdmin(user))setMessage('تم تحديث بيانات الترخيص المهني.')}catch(error){setMessage(error.message)}finally{setBusy(false)}}
 return <div className="professional-profile"><ProfileIdentity name={user.user_metadata?.full_name||user.user_metadata?.name} verification={trust} specialty={specialty}/><p className="trust-explanation">{trust.status==='verified'?'اعتماد مهني من إدارة المنصة. تُعرض العضوية النقابية وشهادة الاختصاص عند التحقق من كل منهما بشكل مستقل.':trust.status==='pending'?'طلبك قيد المراجعة. تظهر شارة الاعتماد بعد موافقة الإدارة.':'تأكيد البريد أو الهاتف لا يُعد اعتماداً مهنياً. يمكنك تقديم ترخيصك للمراجعة أدناه.'}</p><button className="load-more full" onClick={()=>setOpen(!open)}>{open?'إغلاق':'تقديم / تحديث الترخيص المهني'}</button>{open&&<form onSubmit={submit}><p className="local-note">ستراجع الإدارة هذه البيانات. تقديم طلب جديد يعيد حالة الاعتماد إلى قيد المراجعة.</p>{[['full_name','الاسم الكامل'],['profession','المهنة / التخصص'],['license_number','رقم الترخيص المهني']].map(([name,label])=><label key={name}>{label}<input name={name} required maxLength={150} defaultValue={user.user_metadata?.[name]||''}/></label>)}<label>رابط مستند الترخيص — اختياري<input name="license_url" type="url" dir="ltr" maxLength={2000} placeholder="https://…" defaultValue={user.user_metadata?.license_url||''}/></label><p className="local-note">استخدم رابط مستند مخصصاً للمراجعة؛ لا تُدرج كلمات مرور أو بيانات مرضى.</p><button className="primary full" disabled={busy}>{busy?'جارٍ الإرسال…':'إرسال للمراجعة'}</button></form>}{message&&<p className="form-message" role="status">{message}</p>}</div>
}
