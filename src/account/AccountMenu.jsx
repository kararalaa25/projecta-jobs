import {useLayoutEffect,useState} from 'react'
import {UserRound,FilePlus2,Bookmark,CalendarDays,GraduationCap,LifeBuoy,LogOut,ChevronLeft} from 'lucide-react'
import InformationModal from '../components/InformationModal'
import VerifiedBadge from '../components/VerifiedBadge'
import {profileTrust} from '../../config/profile-trust.js'
import {profileCompletion} from '../../config/account-profile.js'
import {number} from '../i18n.js'
import './account.css'
export default function AccountMenu({user,onClose,onSelect,onSignOut,returnFocus}){
 const [position,setPosition]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useLayoutEffect(()=>{
  const update=()=>{const box=returnFocus?.getBoundingClientRect();if(innerWidth<=600||!box){setPosition({});return}setPosition({top:Math.min(box.bottom+10,Math.max(12,innerHeight-650)),left:Math.max(16,Math.min(box.left,innerWidth-396))})}
  update();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)
 },[returnFocus])
 const completion=profileCompletion(user),name=user.user_metadata?.full_name||user.user_metadata?.name||'عضو بروجكتا'
 const items=[['profile','الملف الشخصي',UserRound,`اكتمال الملف ${number(completion.percentage)}٪`],['cv','إنشاء سيرة ذاتية',FilePlus2,'إنشاء ملف سريري أو رفع سيرتك'],['saved','الوظائف المحفوظة',Bookmark],['interviews','مقابلاتي',CalendarDays],['training','برامج التدريب',GraduationCap],['support','الدعم',LifeBuoy]]
 async function signOut(){if(busy)return;setBusy(true);try{await onSignOut()}catch(failure){setError(failure.message)}finally{setBusy(false)}}
 return <InformationModal title="حسابك في بروجكتا" className="account-menu" style={position} onClose={onClose} returnFocus={returnFocus}><div className="account-greeting"><span className="account-avatar" aria-hidden="true">{name.trim().charAt(0)}</span><div><small>أهلاً بك،</small><strong>{name}</strong><VerifiedBadge verification={profileTrust(user)}/></div></div><div className="account-completion"><div><span>اكتمال ملفك المهني</span><b>{number(completion.percentage)}٪</b></div><div className="account-progress" role="progressbar" aria-label="اكتمال الملف المهني" aria-valuenow={completion.percentage} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${completion.percentage}%`}}/></div><small>اكتمال البيانات لا يمنح شارة التوثيق تلقائياً.</small></div><nav aria-label="خيارات حساب المستخدم">{items.map(([id,label,Icon,description])=><button key={id} disabled={busy} onClick={()=>onSelect(id)}><Icon size={20} aria-hidden="true"/><span>{label}{description&&<small>{description}</small>}</span><ChevronLeft size={15} aria-hidden="true"/></button>)}</nav><button className="account-signout" disabled={busy} onClick={signOut}><LogOut size={19} aria-hidden="true"/>{busy?'جارٍ تسجيل الخروج…':'تسجيل الخروج'}</button>{error&&<p role="alert" className="form-message">{error}</p>}</InformationModal>
}
