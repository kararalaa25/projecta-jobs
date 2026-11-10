import {normalizeIraqiPhone,telegramHandle} from './contacts.js'
export function quickApplyContact(job){
 if(job.type!=='jobs'||job.live!==true||job.sample)return null
 const phone=normalizeIraqiPhone(job.whatsapp)||normalizeIraqiPhone(job.phone)
 const message=`مرحباً، أرغب بالتقديم على فرصة «${String(job.title||'').slice(0,140)}» المنشورة على Projecta Jobs.`
 if(phone)return {channel:'whatsapp',href:`https://wa.me/${phone.whatsapp}?text=${encodeURIComponent(message)}`,label:'التقديم السريع عبر واتساب'}
 const telegram=telegramHandle(job.telegram)
 return telegram?{channel:'telegram',href:`https://t.me/${telegram}?text=${encodeURIComponent(message)}`,label:'التقديم السريع عبر تليغرام'}:null
}
