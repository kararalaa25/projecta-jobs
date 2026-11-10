import ApplicationStatusBadge from './ApplicationStatusBadge'
import {employerApplicationStatuses,applicationStatus} from '../../config/application-status.js'
import VerifiedBadge from '../components/VerifiedBadge'
import CredentialBadges from '../components/CredentialBadges'
import {useState} from 'react'
import {Phone,Copy,Send,FileText} from 'lucide-react'
import {ar} from '../i18n'
import {exactDate} from '../dates'
import ApplicantCv from './ApplicantCv'
export default function ApplicantCard({row,jobId,statusLabel,onStatusChange}){
 const [statusBusy,setStatusBusy]=useState(false),[statusError,setStatusError]=useState('')
 async function changeStatus(status){if(statusBusy)return;setStatusBusy(true);setStatusError('');try{await onStatusChange(status)}catch(error){setStatusError(error.message)}finally{setStatusBusy(false)}}
 const [preview,setPreview]=useState(false),[copy,setCopy]=useState('')
 async function copyPhone(){try{await navigator.clipboard.writeText(row.phone);setCopy('تم نسخ الرقم')}catch{setCopy('تعذر النسخ التلقائي. يمكنك تحديد الرقم ونسخه.')}}
 return <article className="rich-applicant-card"><header><div><h3>{row.name}</h3><VerifiedBadge verification={row.verification}/><CredentialBadges verification={row.verification}/><p>{ar(row.specialty)||'التخصص غير مضاف'}</p><time dateTime={row.created_at}>{exactDate(row.created_at)}</time></div><ApplicationStatusBadge status={row.status}/></header>{onStatusChange&&<label className="application-status-control">تحديث حالة الطلب<select value={row.status} disabled={statusBusy} onChange={event=>changeStatus(event.target.value)} aria-label={`حالة طلب ${row.name}`}>{![...employerApplicationStatuses].includes(row.status)&&<option value={row.status}>{applicationStatus[row.status]||'قيد المراجعة'}</option>}{employerApplicationStatuses.map(status=><option key={status} value={status}>{applicationStatus[status]}</option>)}</select></label>}{statusError&&<p role="alert">{statusError}</p>}<div className="applicant-contact-grid">{row.phone?<div><a href={`tel:${row.phone}`}><Phone size={19}/><bdi>{row.phone}</bdi></a><button onClick={copyPhone} aria-label={`نسخ رقم ${row.name}`}><Copy size={19}/></button></div>:<p>رقم الهاتف غير مضاف</p>}{row.telegram?<a href={`https://t.me/${row.telegram}`} target="_blank" rel="noopener noreferrer"><Send size={19}/><bdi>@{row.telegram}</bdi></a>:<p>حساب تليجرام غير مضاف</p>}{row.email&&<a href={`mailto:${row.email}`} dir="ltr">{row.email}</a>}</div>{copy&&<p role="status">{copy}</p>}<section className="applicant-note"><h4>تفاصيل الطلب</h4><p dir="auto">{row.cover_letter||'لم تُضف تفاصيل.'}</p></section>{row.hasCv?<><button className="primary" aria-expanded={preview} onClick={()=>{if(!preview&&onStatusChange&&['submitted','reviewing'].includes(row.status))void changeStatus('viewed');setPreview(value=>!value)}}><FileText size={19}/>{preview?'إخفاء السيرة الذاتية':'معاينة السيرة الذاتية وتحميلها'}</button>{preview&&<ApplicantCv jobId={jobId} applicationId={row.id} name={row.name}/>}</>:<p>السيرة الذاتية غير مرفقة</p>}</article>
}
