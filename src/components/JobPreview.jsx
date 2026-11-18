import {MapPin,Phone,Wallet,Clock3} from 'lucide-react'
import {ar,number} from '../i18n'
import {normalizeIraqiPhone} from '../contacts'

const metaIcon={size:16,strokeWidth:1.75,'aria-hidden':true}

export default function JobPreview({job,compact=false,hideTitle=false}){
 const phone=normalizeIraqiPhone(job.phone)
 const provinces=[...new Set((job.governorates||[job.city]).filter(Boolean))]
 const location=<div><dt className={compact?'sr-only':undefined}>الموقع / المحافظة</dt><dd><MapPin {...metaIcon}/>{ar(job.city)||'غير مذكور'}{compact&&provinces.length>1&&<span className="province-extra" title={provinces.map(ar).join('، ')}>+{number(provinces.length-1)}</span>}</dd></div>
 const schedule=<div><dt className={compact?'sr-only':undefined}>نوع الدوام</dt><dd>{compact&&<Clock3 {...metaIcon}/>}{ar(job.schedule)||'غير مذكور'}</dd></div>
 const salary=<div><dt className={compact?'sr-only':undefined}>الراتب المتوقع</dt><dd>{compact&&<Wallet {...metaIcon}/>}{ar(job.salary)||'غير مذكور'}</dd></div>
 return <section className={`job-preview ${compact?'is-compact':''}`} aria-label={compact?(job.type==='candidates'?'ملخص الملف المهني':'ملخص فرصة العمل'):(job.type==='candidates'?'تفاصيل الملف المهني':'تفاصيل فرصة العمل')}>
  {!hideTitle&&<h3 dir="auto">{ar(job.title)||'عنوان الوظيفة غير مذكور'}</h3>}
  <dl className={`job-facts ${compact?'compact-facts':''}`}>
   {compact?<>{location}{schedule}{salary}</>:<>{salary}{location}{schedule}<div><dt>رقم الهاتف للتواصل</dt><dd>{phone?<a href={`tel:${phone.local}`} dir="ltr"><Phone {...metaIcon}/>{phone.local}</a>:'غير مذكور'}</dd></div>{provinces.length>1&&<div><dt>جميع المحافظات</dt><dd>{provinces.map(ar).join('، ')}</dd></div>}</>}
  </dl>
  <div className="preview-description">{!compact&&<span className="preview-label">{job.type==='candidates'?'نبذة مهنية':'وصف الوظيفة'}</span>}<p dir="auto">{job.description||'وصف الوظيفة غير مذكور'}</p></div>
 </section>
}
