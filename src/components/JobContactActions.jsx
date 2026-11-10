import {Phone,Send,ArrowUpLeft,FileText} from 'lucide-react'
import {normalizeIraqiPhone,telegramHandle} from '../contacts'
import {quickApplyContact} from '../quick-apply.js'
import WhatsAppIcon from './WhatsAppIcon'


export default function JobContactActions({job,onRead,onApply}){
 const phone=normalizeIraqiPhone(job.phone)
 const whatsapp=normalizeIraqiPhone(job.whatsapp)?.whatsapp||phone?.whatsapp
 const telegram=telegramHandle(job.telegram)
 const quick=quickApplyContact(job)
 return <div className="job-actions">
  {quick&&<a className={`quick-apply quick-apply-${quick.channel}`} href={quick.href} target="_blank" rel="noopener noreferrer">{quick.channel==='whatsapp'?<WhatsAppIcon/>:<Send size={18} aria-hidden="true"/>}{quick.label}</a>}
  <div className="contact-buttons">
   {phone&&<a className="contact-icon call-button" href={`tel:${phone.local}`} aria-label="اتصال هاتفي" title="اتصال هاتفي"><Phone size={18} aria-hidden="true"/></a>}
   {whatsapp&&<a className="contact-icon whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="التواصل عبر واتساب" title="التواصل عبر واتساب"><WhatsAppIcon/></a>}
   {telegram&&<a className="contact-icon telegram" href={`https://t.me/${telegram}`} target="_blank" rel="noopener noreferrer" aria-label="التواصل عبر تليغرام" title="التواصل عبر تليغرام"><Send size={18} aria-hidden="true"/></a>}
   {onApply&&<button className="contact-icon apply-icon" onClick={onApply} aria-label="التقديم لهذه الفرصة" title="التقديم لهذه الفرصة"><FileText size={18} aria-hidden="true"/><span className="full-apply-label">طلب توظيف كامل</span></button>}
   {job.sourceUrl&&<a className="contact-icon source-icon" href={job.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="فتح المنشور الأصلي" title="فتح المنشور الأصلي"><ArrowUpLeft size={18} aria-hidden="true"/></a>}
  </div>
  {onRead&&<button className="read-full-post" onClick={onRead}><span>{job.type==='candidates'?'الملف كاملاً':'المنشور كاملاً'}</span><ArrowUpLeft size={15} aria-hidden="true"/></button>}
  {!phone&&!whatsapp&&!telegram&&job.live&&<span className="no-contact">لم تُذكر وسائل تواصل مباشرة</span>}
 </div>
}
