import {jobTimestamp,exactDate,validDate} from '../dates.js'
import {Bookmark,MapPin,BriefcaseMedical,Pill,Users,Building2} from 'lucide-react'
import {ar,number} from '../i18n'
import JobContactActions from './JobContactActions'
export default function JobCard({job,saved,onSave,onRead,onApply}){
 const categories=[...new Set((job.roles||[job.role]).filter(Boolean))]
 const provinces=[...new Set((job.governorates||[job.city]).filter(Boolean))]
 const Icon=job.role==='Pharmacists'?Pill:job.role==='Receptionists / Admin'?Building2:job.role==='Assistants & Techs'?Users:BriefcaseMedical
 return <article className="job-card">
  <div className="card-top"><div className="company-logo"><Icon size={22}/></div><div className="card-top-actions">{job.featured&&<span className="role-badge featured-badge">فرصة مميزة ★</span>}{job.raw&&<span className="raw-badge">منشور غير موثّق</span>}<button className={`save-button ${saved?'is-saved':''}`} aria-label={`${saved?'إلغاء حفظ':'حفظ'} ${job.title}`} aria-pressed={saved} onClick={onSave}><Bookmark size={19} fill={saved?'currentColor':'none'}/></button></div></div>
  <div className="company-name">{ar(job.company)}</div><h3 dir="auto">{ar(job.title)}</h3>
  <div className="role-badges">{categories.length?categories.slice(0,2).map(role=><span className="role-badge" key={role}>{ar(role)}</span>):<span className="role-badge neutral">التخصص غير محدد</span>}{categories.length>2&&<span className="role-badge neutral" title={categories.map(ar).join('، ')}>+{number(categories.length-2)}</span>}</div>
  <div className="job-meta"><span><MapPin size={14}/>{ar(job.city)}</span>{provinces.length>1&&<span className="province-extra" title={provinces.map(ar).join('، ')}>+{number(provinces.length-1)} محافظات</span>}<span className="meta-divider"/><span>{ar(job.schedule)}</span></div>
  <p className="description" dir="auto">{job.description}</p><div className="card-bottom"><span className="salary">{ar(job.salary)}</span><time className="listing-time" dateTime={validDate(job.createdAt)?.toISOString()} title={job.createdAt?exactDate(job.createdAt):undefined}>{job.createdAt?jobTimestamp(job.createdAt):job.sample?ar(job.time):'تاريخ النشر غير متاح'}</time></div>
  <div className="card-footer"><span className="listing-kind">{job.sample?'ملف توضيحي':job.live?'من المجتمع الطبي':'محفوظ على جهازك'}</span><JobContactActions job={job} onRead={onRead}/>{job.live&&<button className="apply-button" onClick={onApply}>التقديم لهذه الفرصة</button>}</div>
 </article>
}
