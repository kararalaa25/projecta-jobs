import {MapPin,Phone} from 'lucide-react'
import {ar} from '../i18n'
import {normalizeIraqiPhone} from '../contacts'
export default function JobPreview({job,compact=false}){
 const phone=normalizeIraqiPhone(job.phone)
 return <section className={`job-preview ${compact?'is-compact':''}`} aria-label={job.type==='candidates'?'ملخص الملف المهني':'ملخص فرصة العمل'}><h3 dir="auto">{ar(job.title)||'عنوان الوظيفة غير مذكور'}</h3><div className="preview-description"><span className="preview-label">{job.type==='candidates'?'نبذة مهنية':'وصف الوظيفة'}</span><p dir="auto">{job.description||'وصف الوظيفة غير مذكور'}</p></div><dl className="job-facts"><div><dt>الراتب المتوقع</dt><dd>{ar(job.salary)||'غير مذكور'}</dd></div><div><dt>الموقع / المحافظة</dt><dd><MapPin size={13}/>{ar(job.city)||'غير مذكور'}</dd></div><div><dt>رقم الهاتف للتواصل</dt><dd>{phone?<a href={`tel:${phone.local}`} dir="ltr"><Phone size={12}/>{phone.local}</a>:'غير مذكور'}</dd></div></dl></section>
}
