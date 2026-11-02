import {lazy,useState} from 'react'
import {Sparkles,UserRound} from 'lucide-react'
import Modal from '../components/Modal'
import SpecialtyBadge from '../components/SpecialtyBadge'
import {ar} from '../i18n.js'
import AsyncContent from '../components/AsyncContent'
const MatchingForm=lazy(()=>import('./MatchingForm'))
export default function MatchingProfilePanel({profile,draftProfile,onSave,onDisable,filtering=false,onFilteringChange}){
 const [open,setOpen]=useState(false),[error,setError]=useState('')
 function disable(){try{onDisable();setError('')}catch(failure){setError(failure.message)}}
 return <><div className="matching-profile-panel"><span className="matching-panel-icon"><Sparkles size={20} aria-hidden="true"/></span><div><strong>{profile?'مطابقة الفرص مع ملفك':'فرص تناسب تخصصك'}</strong>{profile?<p><UserRound size={12} aria-hidden="true"/>{profile.name||'ملفي المهني'} <SpecialtyBadge role={profile.role}/>{profile.city&&<span>{ar(profile.city)}</span>}</p>:<p>حدّد تخصصك وموقعك ومهاراتك لرؤية الفرص الأقرب لك.</p>}</div>{profile&&<label className="matching-only"><input type="checkbox" checked={filtering} onChange={event=>{try{onFilteringChange(event.target.checked);setError('')}catch(failure){setError(failure.message)}}}/>الفرص المناسبة لملفي فقط</label>}<div className="matching-profile-actions"><button className="matching-setup-action" onClick={()=>setOpen(true)}>{profile?'تعديل المطابقة':'إعداد ملف المطابقة'}</button>{profile&&<button className="matching-disable" onClick={disable}>إيقاف المطابقة</button>}</div></div>{error&&<p className="form-message" role="alert">{error}</p>}{open&&<Modal title="ملف المطابقة المهنية" onClose={()=>setOpen(false)}><AsyncContent><MatchingForm profile={profile||draftProfile} onSave={value=>{onSave(value);setOpen(false)}}/></AsyncContent></Modal>}</>
}
