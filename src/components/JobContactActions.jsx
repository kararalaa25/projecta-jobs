import {Phone,Send,ArrowUpLeft,FileText,Zap} from 'lucide-react'
import {normalizeIraqiPhone,telegramHandle} from '../contacts'
import WhatsAppIcon from './WhatsAppIcon'

export default function JobContactActions({job,onRead,onApply}){
 const phone = normalizeIraqiPhone(job.phone)
 const whatsapp = normalizeIraqiPhone(job.whatsapp)?.whatsapp || phone?.whatsapp
 const telegram = telegramHandle(job.telegram)

 const quickApplyText = `مرحباً، أود التقديم على فرصة العمل (${job.title || 'فرصة العمل'} في ${job.company || 'المؤسسة'}) المعلنة عبر منصة Projecta Jobs.`
 const whatsappQuickApply = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(quickApplyText)}` : null
 const telegramQuickApply = telegram ? `https://t.me/${telegram}` : null

 return (
  <div className="job-actions">
   {/* Mobile-first 1-tap Quick Apply bar (visible on screens < 768px) */}
   {job.type === 'jobs' && (whatsappQuickApply || telegramQuickApply || onApply) && (
    <div className="mobile-quick-apply-bar" role="group" aria-label="خيارات التقديم المباشر">
     {whatsappQuickApply ? (
      <a
       className="quick-apply-btn quick-apply-whatsapp"
       href={whatsappQuickApply}
       target="_blank"
       rel="noopener noreferrer"
       aria-label={`التقديم السريع عبر واتساب لفرصة: ${job.title}`}
       title="التقديم الفوري المباشر عبر واتساب"
      >
       <WhatsAppIcon size={17} aria-hidden="true"/>
       <span>التقديم السريع عبر واتساب</span>
      </a>
     ) : telegramQuickApply ? (
      <a
       className="quick-apply-btn quick-apply-telegram"
       href={telegramQuickApply}
       target="_blank"
       rel="noopener noreferrer"
       aria-label={`التقديم السريع عبر تليغرام لفرصة: ${job.title}`}
       title="التقديم الفوري المباشر عبر تليغرام"
      >
       <Send size={16} aria-hidden="true"/>
       <span>التقديم السريع عبر تليغرام</span>
      </a>
     ) : null}

     {onApply && (
      <button
       className="quick-apply-btn quick-apply-platform"
       onClick={onApply}
       aria-label={`التقديم الرسمي عبر المنصة لفرصة: ${job.title}`}
       title="إرسال طلب توظيف وسيرة ذاتية عبر منصة بروجكتا"
      >
       <FileText size={16} aria-hidden="true"/>
       <span>التقديم بالمنصة</span>
      </button>
     )}
    </div>
   )}

   {/* Desktop action icons & expanded view trigger */}
   <div className="contact-buttons">
    {phone && (
     <a className="contact-icon call-button" href={`tel:${phone.local}`} aria-label="اتصال هاتفي" title="اتصال هاتفي">
      <Phone size={18} aria-hidden="true"/>
     </a>
    )}
    {whatsapp && (
     <a className="contact-icon whatsapp" href={whatsappQuickApply || `https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="التواصل عبر واتساب" title="التواصل عبر واتساب">
      <WhatsAppIcon/>
     </a>
    )}
    {telegram && (
     <a className="contact-icon telegram" href={`https://t.me/${telegram}`} target="_blank" rel="noopener noreferrer" aria-label="التواصل عبر تليغرام" title="التواصل عبر تليغرام">
      <Send size={18} aria-hidden="true"/>
     </a>
    )}
    {onApply && (
     <button className="contact-icon apply-icon" onClick={onApply} aria-label="التقديم لهذه الفرصة" title="التقديم لهذه الفرصة">
      <FileText size={18} aria-hidden="true"/>
     </button>
    )}
    {job.sourceUrl && (
     <a className="contact-icon source-icon" href={job.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="فتح المنشور الأصلي" title="فتح المنشور الأصلي">
      <ArrowUpLeft size={18} aria-hidden="true"/>
     </a>
    )}
   </div>

   {onRead && (
    <button className="read-full-post" onClick={onRead}>
     <span>{job.type === 'candidates' ? 'الملف كاملاً' : 'المنشور كاملاً'}</span>
     <ArrowUpLeft size={15} aria-hidden="true"/>
    </button>
   )}

   {!phone && !whatsapp && !telegram && job.live && (
    <span className="no-contact">لم تُذكر وسائل تواصل مباشرة</span>
   )}
  </div>
 )
}
