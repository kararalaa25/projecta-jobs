import {MapPin,Clock3,GraduationCap,BriefcaseMedical,FileText,Phone,ArrowUpLeft,Pencil,Trash2} from 'lucide-react'
import CredentialBadges from '../components/CredentialBadges'
import SpecialtyBadge from '../components/SpecialtyBadge'
import {VerificationStatus} from '../components/VerifiedBadge'
import WhatsAppIcon from '../components/WhatsAppIcon'
import {specialtyClass} from '../job-ui.js'
import {ar,number} from '../i18n.js'
import {availabilityOptions,workOptions,talentContacts} from './data.js'

export default function TalentCard({profile,onPreview,onDetails,onEdit,onDelete}){
 const contacts=talentContacts(profile),demo=profile.source==='demo'
 const availability=availabilityOptions.find(option=>option.id===profile.availability)
 const cvAvailable=demo||Boolean(profile.cv)
 return <article className={`talent-card ${specialtyClass(profile.role)}`} aria-label={`الملف المهني: ${profile.name}`}>
  <div className="talent-card-top"><div className="talent-avatar" aria-hidden="true">{profile.name.replace(/^د\.\s*/,'').split(/\s+/).slice(0,2).map(part=>part.charAt(0)).join('')}</div><div className="talent-name"><h2>{profile.name}</h2><p>{profile.headline||ar(profile.role)}</p></div><span className={`talent-availability availability-${profile.availability}`}><span aria-hidden="true"/>{availability.label}</span></div>
  <div className="talent-identity-tags"><SpecialtyBadge role={profile.role}/><VerificationStatus verification={profile.verification} context={demo?'sample':profile.source==='platform'?'profile':'local'}/><CredentialBadges verification={profile.source==='platform'?profile.verification:null}/></div>
  <div className="talent-meta"><span><MapPin size={14} aria-hidden="true"/>{ar(profile.city)}</span><span><BriefcaseMedical size={14} aria-hidden="true"/>{profile.experience===null?'الخبرة غير مذكورة':`${number(profile.experience)} سنوات خبرة`}</span></div>
  <p className="talent-qualification"><GraduationCap size={17} aria-hidden="true"/><span>{profile.qualification||'المؤهل غير مضاف'}<small>مؤهل معلن من صاحب الملف</small></span></p>
  <div className="talent-expertise"><h3>مجالات الخبرة</h3>{profile.skills.length?<ul>{profile.skills.slice(0,3).map(skill=><li key={skill}>{skill}</li>)}{profile.skills.length>3&&<li>+{number(profile.skills.length-3)}</li>}</ul>:<p>لم تُضف مجالات خبرة بعد.</p>}</div>
  <div className="talent-work-types" aria-label="أنواع الدوام المفضلة"><Clock3 size={14} aria-hidden="true"/>{profile.workTypes.length?profile.workTypes.map(type=><span key={type}>{workOptions.find(option=>option.id===type).label}</span>):<span>الدوام غير محدد</span>}</div>
  <div className="talent-cv-summary"><FileText size={16} aria-hidden="true"/><span title={profile.cv?.name}>{demo?'نموذج سيرة ذاتية توضيحية':profile.cv?.name||'السيرة الذاتية غير مرفقة'}</span></div>
  <div className="talent-card-actions"><button className="talent-preview-button" disabled={!cvAvailable} onClick={()=>onPreview(profile)}><FileText size={16} aria-hidden="true"/>{demo?'معاينة النموذج':'معاينة السيرة'}</button><div className="talent-contact-actions" aria-label={`التواصل المباشر مع ${profile.name}`}>
   {contacts.whatsapp?<a className="talent-contact whatsapp-contact" href={contacts.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`واتساب ${profile.name}`} title="تواصل مباشر عبر واتساب"><WhatsAppIcon size={19}/></a>:<button className="talent-contact" disabled aria-label={`واتساب غير متاح: ${profile.name}`} title="واتساب غير مضاف لهذا الملف"><WhatsAppIcon size={19}/></button>}
   {contacts.phone?<a className="talent-contact phone-contact" href={contacts.phone} aria-label={`اتصال هاتفي مع ${profile.name}`} title="اتصال مباشر"><Phone size={18} aria-hidden="true"/></a>:<button className="talent-contact" disabled aria-label={`الاتصال غير متاح: ${profile.name}`} title="بيانات توضيحية؛ لا يوجد رقم اتصال فعلي"><Phone size={18} aria-hidden="true"/></button>}
  </div></div>
  <div className="talent-card-footer"><button onClick={()=>onDetails(profile)}>عرض الملف السريري <ArrowUpLeft size={14} aria-hidden="true"/></button>{profile.source==='local'&&<div><button onClick={()=>onEdit(profile)} aria-label={`تعديل ملف ${profile.name}`} title="تعديل الملف المحلي"><Pencil size={15} aria-hidden="true"/></button><button onClick={()=>onDelete(profile)} aria-label={`حذف ملف ${profile.name}`} title="حذف الملف المحلي"><Trash2 size={15} aria-hidden="true"/></button></div>}</div>
 </article>
}
