import { Phone, MessageCircle, Send, ArrowUpRight } from 'lucide-react'
import { normalizeIraqiPhone, telegramHandle } from '../contacts'

export default function JobContactActions({ job, onRead }) {
  const phone = normalizeIraqiPhone(job.phone)
  const whatsapp = normalizeIraqiPhone(job.whatsapp)?.whatsapp || phone?.whatsapp
  const telegram = telegramHandle(job.telegram)
  return <div className="contact-buttons">
    {phone && <a className="call-button" href={`tel:${phone.local}`}><Phone size={14}/> Call</a>}
    {whatsapp && <a className="whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={14}/> WhatsApp</a>}
    {telegram && <a className="telegram" href={`https://t.me/${telegram}`} target="_blank" rel="noreferrer"><Send size={14}/> Telegram</a>}
    {job.live && <button className="telegram" onClick={onRead}>Read full post</button>}
    {job.sourceUrl && <a className="telegram" href={job.sourceUrl} target="_blank" rel="noreferrer">View source <ArrowUpRight size={14}/></a>}
  </div>
}
