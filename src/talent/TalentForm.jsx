import {useState} from 'react'
import {Upload,FileText} from 'lucide-react'
import {talentRoles,talentCities,availabilityOptions,workOptions,validateTalent} from './data.js'
import {saveTalentProfile} from './storage.js'
export default function TalentForm({profile,onSaved}){
 const [file,setFile]=useState(null),[removeCv,setRemoveCv]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(event){
  event.preventDefault();if(busy)return
  const form=new FormData(event.currentTarget)
  setError('');setBusy(true)
  try{
   const value=validateTalent({...Object.fromEntries(form),id:profile?.id||crypto.randomUUID(),workTypes:form.getAll('workTypes'),whatsappEnabled:form.get('whatsappEnabled')==='on',skills:String(form.get('skills')||'').split(/[\n،,]/).map(value=>value.trim()).filter(Boolean),cv:profile?.cv||null})
   const saved=await saveTalentProfile(value,file,{removeCv})
   onSaved(saved)
  }catch(failure){setError(failure.message||'تعذر حفظ الملف المحلي. حاول مجدداً.')}finally{setBusy(false)}
 }
 return <form className="talent-profile-form" onSubmit={submit}>
  <p className="talent-local-note">يُحفظ هذا الملف وسيرتك الذاتية على هذا المتصفح فقط، ولا يُنشران على المنصة.</p>
  <label>الاسم الكامل<input name="name" required maxLength={120} autoComplete="name" defaultValue={profile?.name||''}/></label>
  <label>العنوان المهني<input name="headline" maxLength={140} placeholder="مثال: طبيبة أسنان عامة" defaultValue={profile?.headline||''}/></label>
  <div className="form-row"><label>التخصص<select aria-label="التخصص" name="role" defaultValue={profile?.role||'Dentists'}>{talentRoles.map(role=><option key={role.id} value={role.id}>{role.ar}</option>)}</select></label><label>المحافظة<select aria-label="المحافظة" name="city" defaultValue={profile?.city||'Baghdad'}>{talentCities.map(city=><option key={city.id} value={city.id}>{city.ar}</option>)}</select></label></div>
  <div className="form-row"><label>سنوات الخبرة<input name="experience" type="number" min="0" max="60" step="0.5" defaultValue={profile?.experience??''}/></label><label>حالة التفرغ<select aria-label="حالة التفرغ" name="availability" defaultValue={profile?.availability||'available'}>{availabilityOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label></div>
  <label>المؤهل الدراسي / المهني<input name="qualification" maxLength={180} placeholder="مثال: بكالوريوس صيدلة" defaultValue={profile?.qualification||''}/></label>
  <label>نبذة مهنية<textarea name="bio" rows={3} maxLength={1200} defaultValue={profile?.bio||''} placeholder="عرّف بخبرتك والمسار المهني الذي تبحث عنه."/></label>
  <label>مجالات الخبرة<textarea name="skills" rows={3} maxLength={520} defaultValue={profile?.skills?.join('\n')||''} placeholder="مجال واحد في كل سطر — حتى 8 مجالات"/></label>
  <fieldset className="talent-form-options"><legend>أنواع الدوام المفضلة</legend>{workOptions.map(option=><label key={option.id}><input type="checkbox" name="workTypes" value={option.id} defaultChecked={profile?profile.workTypes.includes(option.id):option.id==='Full-time'}/>{option.label}</label>)}</fieldset>
  <label>رقم الهاتف<input name="phone" type="tel" dir="ltr" autoComplete="tel" required defaultValue={profile?.phone||''} placeholder="07701234567"/></label>
  <label className="talent-inline-check"><input type="checkbox" name="whatsappEnabled" defaultChecked={profile?.whatsappEnabled||false}/> إتاحة التواصل على واتساب عبر الرقم نفسه</label>
  <label className="talent-upload"><Upload size={21} aria-hidden="true"/><strong>إرفاق سيرة ذاتية PDF</strong><span>حتى 5 ميغابايت · محفوظة على جهازك</span><input name="cv" type="file" accept=".pdf,application/pdf" onChange={event=>{setFile(event.target.files?.[0]||null);setRemoveCv(false)}}/></label>
  {(file||profile?.cv)&&<div className="talent-file-choice"><FileText size={16} aria-hidden="true"/><span>{file?.name||profile.cv.name}</span>{!file&&<label><input type="checkbox" checked={removeCv} onChange={event=>setRemoveCv(event.target.checked)}/> إزالة الملف المرفق</label>}</div>}
  {error&&<p className="form-message" role="alert">{error}</p>}
  <button className="primary full" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ الملف على هذا الجهاز'}</button>
 </form>
}
