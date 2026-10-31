import {Phone,Send,ArrowUpLeft,FileText} from 'lucide-react'
import {normalizeIraqiPhone,telegramHandle} from '../contacts'

function WhatsAppIcon(){
 return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8a8.5 8.5 0 1 1 16.2-4Z"/><path d="m8.1 7.7 1.3-.3 1.1 2.3-.9 1.1a6.8 6.8 0 0 0 3.4 3.4l1.1-.9 2.3 1.1-.3 1.3c-.2.8-1.1 1.1-1.8 1-4.2-.5-7.1-3.5-7.4-7.1 0-.8.4-1.6 1.2-1.9Z"/></svg>
}

export default function JobContactActions({job,onRead,onApply}){
 const phone=normalizeIraqiPhone(job.phone)
 const whatsapp=normalizeIraqiPhone(job.whatsapp)?.whatsapp||phone?.whatsapp
 const telegram=telegramHandle(job.telegram)
 return <div className="job-actions">
  <div className="contact-buttons">
   {phone&&<a className="contact-icon call-button" href={`tel:${phone.local}`} aria-label="اتصال هاتفي" title="اتصال هاتفي"><Phone size={18} aria-hidden="true"/></a>}
   {whatsapp&&<a className="contact-icon whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="التواصل عبر واتساب" title="التواصل عبر واتساب"><WhatsAppIcon/></a>}
   {telegram&&<a className="contact-icon telegram" href={`https://t.me/${telegram}`} target="_blank" rel="noopener noreferrer" aria-label="التواصل عبر تليغرام" title="التواصل عبر تليغرام"><Send size={18} aria-hidden="true"/></a>}
   {onApply&&<button className="contact-icon apply-icon" onClick={onApply} aria-label="التقديم لهذه الفرصة" title="التقديم لهذه الفرصة"><FileText size={18} aria-hidden="true"/></button>}
   {job.sourceUrl&&<a className="contact-icon source-icon" href={job.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="فتح المنشور الأصلي" title="فتح المنشور الأصلي"><ArrowUpLeft size={18} aria-hidden="true"/></a>}
  </div>
  {onRead&&<button className="read-full-post" onClick={onRead}><span>{job.type==='candidates'?'الملف كاملاً':'المنشور كاملاً'}</span><ArrowUpLeft size={15} aria-hidden="true"/></button>}
  {!phone&&!whatsapp&&!telegram&&job.live&&<span className="no-contact">لم تُذكر وسائل تواصل مباشرة</span>}
 </div>
}
