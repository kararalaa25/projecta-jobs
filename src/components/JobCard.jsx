import SpecialtyBadge from './SpecialtyBadge'
import SpecialtyFitBadge from '../matching/SpecialtyFitBadge'
import VerifiedBadge,{VerificationStatus} from './VerifiedBadge'
import CredentialBadges from './CredentialBadges'
import {normalizeProfileTrust,unverifiedProfile} from '../../config/profile-trust.js'
import JobPreview from './JobPreview'
import {jobTimestamp,exactDate,validDate,isJobExpired} from '../dates.js'
import {Bookmark,BriefcaseMedical,Pill,Users,Building2,Clock3} from 'lucide-react'
import {ar,number} from '../i18n'
import JobContactActions from './JobContactActions'

export default function JobCard({job,saved,onSave,onRead,onApply,verification,fit}){
 const context=job.sample?'sample':!job.live?'local':job.source==='telegram'?'telegram':'profile'
 const trust=context==='profile'?normalizeProfileTrust(verification):unverifiedProfile()
 const categories=[...new Set((job.roles||[job.role]).filter(Boolean))]
 const Icon=job.role==='Pharmacists'?Pill:job.role==='Receptionists / Admin'?Building2:job.role==='Assistants & Techs'?Users:BriefcaseMedical
 const kind=job.type==='candidates'?(job.sample?'ملف توضيحي':job.live?'ملف مهني':'ملف محلي'):job.source==='telegram'?'وظائف التليجرام':job.sample?'ملف توضيحي':job.live?'وظائف المنصة':'محفوظ على جهازك'
 const expired=isJobExpired(job)

 return <article className={`job-card ${job.type==='candidates'?'candidate-card':''} ${expired?'is-expired':''}`}>
  <div className="card-top">
   <div className="company-logo">{job.type==='candidates'?<span className="candidate-initial" aria-hidden="true">{job.company?.replace(/^د\.\s*/,'').charAt(0)||'ط'}</span>:<Icon size={21} aria-hidden="true"/>}</div>
   <div className="card-identity">
    <div className="identity-name">
     <div className="company-name" title={ar(job.company)}>{ar(job.company)}</div>
     <VerifiedBadge verification={trust} compact subject={job.type==='candidates'?'profile':'publisher'}/>
    </div>
    <span className="listing-kind">{kind}</span>
   </div>
   <button className={`save-button ${saved?'is-saved':''}`} aria-label={`${saved?'إلغاء حفظ':'حفظ'} ${job.title}`} aria-pressed={saved} title={saved?'إلغاء الحفظ':'حفظ الفرصة'} onClick={onSave}><Bookmark size={19} fill={saved?'currentColor':'none'} aria-hidden="true"/></button>
  </div>
  <div className="card-trust">
   {trust.status!=='verified'&&<VerificationStatus verification={trust} context={context}/>}
   <CredentialBadges verification={trust} subject={job.type==='candidates'?'profile':'facility'}/>
  </div>
  <JobPreview job={job} compact/>
  <div className="role-badges">
   {categories.length?categories.slice(0,2).map(role=><SpecialtyBadge key={role} role={role}/>):<span className="role-badge neutral">التخصص غير محدد</span>}
   {categories.length>2&&<span className="role-badge neutral" title={categories.map(ar).join('، ')}>+{number(categories.length-2)}</span>}
   {job.featured&&<span className="role-badge featured-badge">فرصة مميزة ★</span>}
   {job.raw&&<span className="raw-badge">منشور غير موثّق</span>}
   {expired&&<span className="role-badge expired-badge" title="مضى أكثر من 30 يوماً على النشر دون تجديد من صاحب العمل"><Clock3 size={11} aria-hidden="true"/> منتهية الصلاحية</span>}
  </div>
  {job.type==='jobs'&&<SpecialtyFitBadge fit={fit}/>}
  <div className="card-bottom">
   <time className="listing-time" dateTime={validDate(job.createdAt)?.toISOString()} title={job.createdAt?exactDate(job.createdAt):undefined}>
    {job.createdAt?`${job.type==='candidates'?'أُضيف':'نُشر'} ${jobTimestamp(job.createdAt)}`:job.sample?ar(job.time):'تاريخ النشر غير متاح'}
   </time>
  </div>
  <div className="card-footer"><JobContactActions job={job} onRead={onRead} onApply={job.live&&job.source==='manual'&&job.official?onApply:undefined}/></div>
 </article>
}
