import {specialtyClass} from '../job-ui.js'
import JobPreview from './JobPreview'
import {jobTimestamp,exactDate,validDate} from '../dates.js'
import {Bookmark,BriefcaseMedical,Pill,Users,Building2} from 'lucide-react'
import {ar,number} from '../i18n'
import JobContactActions from './JobContactActions'

export default function JobCard({job,saved,onSave,onRead,onApply}){
 const categories=[...new Set((job.roles||[job.role]).filter(Boolean))]
 const Icon=job.role==='Pharmacists'?Pill:job.role==='Receptionists / Admin'?Building2:job.role==='Assistants & Techs'?Users:BriefcaseMedical
 const kind=job.source==='telegram'?'وظائف التليجرام':job.sample?'ملف توضيحي':job.live?'وظائف المنصة':'محفوظ على جهازك'
 return <article className={`job-card ${job.type==='candidates'?'candidate-card':''}`}>
  <div className="card-top">
   <div className="company-logo">{job.type==='candidates'?<span className="candidate-initial" aria-hidden="true">{job.company?.replace(/^د\.\s*/,'').charAt(0)||'ط'}</span>:<Icon size={21} aria-hidden="true"/>}</div>
   <div className="card-identity"><div className="company-name" title={ar(job.company)}>{ar(job.company)}</div><span className="listing-kind">{kind}</span></div>
   <button className={`save-button ${saved?'is-saved':''}`} aria-label={`${saved?'إلغاء حفظ':'حفظ'} ${job.title}`} aria-pressed={saved} title={saved?'إلغاء الحفظ':'حفظ الفرصة'} onClick={onSave}><Bookmark size={19} fill={saved?'currentColor':'none'} aria-hidden="true"/></button>
  </div>
  <JobPreview job={job} compact/>
  <div className="role-badges">
   {categories.length?categories.slice(0,2).map(role=><span className={`role-badge ${specialtyClass(role)}`} key={role}>{ar(role)}</span>):<span className="role-badge neutral">التخصص غير محدد</span>}
   {categories.length>2&&<span className="role-badge neutral" title={categories.map(ar).join('، ')}>+{number(categories.length-2)}</span>}
   {job.featured&&<span className="role-badge featured-badge">فرصة مميزة ★</span>}
   {job.raw&&<span className="raw-badge">منشور غير موثّق</span>}
  </div>
  <div className="card-bottom"><time className="listing-time" dateTime={validDate(job.createdAt)?.toISOString()} title={job.createdAt?exactDate(job.createdAt):undefined}>{job.createdAt?`${job.type==='candidates'?'أُضيف':'نُشر'} ${jobTimestamp(job.createdAt)}`:job.sample?ar(job.time):'تاريخ النشر غير متاح'}</time></div>
  <div className="card-footer"><JobContactActions job={job} onRead={onRead} onApply={job.live&&job.source==='manual'&&job.official?onApply:undefined}/></div>
 </article>
}
