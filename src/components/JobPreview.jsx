import {MapPin,Phone,Wallet,Clock3} from 'lucide-react'
import {ar,number} from '../i18n'
import {normalizeIraqiPhone} from '../contacts'

export default function JobPreview({job,compact=false}){
 const phone=normalizeIraqiPhone(job.phone)
 const provinces=[...new Set((job.governorates||[job.city]).filter(Boolean))]
 return <section className={`job-preview ${compact?'is-compact':''}`} aria-label={compact?(job.type==='candidates'?'ملخص الملف المهني':'ملخص فرصة العمل'):(job.type==='candidates'?'تفاصيل الملف المهني':'تفاصيل فرصة العمل')}>
  <h3 dir="auto">{ar(job.title)||'عنوان الوظيفة غير مذكور'}</h3>
  <div className="preview-description">{!compact&&<span className="preview-label">{job.type==='candidates'?'نبذة مهنية':'وصف الوظيفة'}</span>}<p dir="auto">{job.description||'وصف الوظيفة غير مذكور'}</p></div>
  <dl className={`job-facts ${compact?'compact-facts':''}`}>
   <div><dt className={compact?'sr-only':undefined}>الراتب المتوقع</dt><dd>{compact&&<Wallet size={14} aria-hidden="true"/>}{ar(job.salary)||'غير مذكور'}</dd></div>
   <div><dt className={compact?'sr-only':undefined}>الموقع / المحافظة</dt><dd><MapPin size={14} aria-hidden="true"/>{ar(job.city)||'غير مذكور'}{compact&&provinces.length>1&&<span className="province-extra" title={provinces.map(ar).join('، ')}>+{number(provinces.length-1)}</span>}</dd></div>
   {compact?<div><dt className="sr-only">نوع الدوام</dt><dd><Clock3 size={14} aria-hidden="true"/>{ar(job.schedule)||'غير مذكور'}</dd></div>:<><div><dt>نوع الدوام</dt><dd>{ar(job.schedule)||'غير مذكور'}</dd></div><div><dt>رقم الهاتف للتواصل</dt><dd>{phone?<a href={`tel:${phone.local}`} dir="ltr"><Phone size={12} aria-hidden="true"/>{phone.local}</a>:'غير مذكور'}</dd></div>{provinces.length>1&&<div><dt>جميع المحافظات</dt><dd>{provinces.map(ar).join('، ')}</dd></div>}</>}
  </dl>
 </section>
}
