import {useEffect,useRef,useState} from 'react'
import {Phone,Send,ArrowUpLeft,Share2} from 'lucide-react'
import {primaryContact} from '../contacts'
import {jobShareHash,sharedJobId} from '../job-ui.js'
import WhatsAppIcon from './WhatsAppIcon'


export default function JobContactActions({job,onRead,onApply}){
 const contact=primaryContact(job)
 const jobId=job?.id
 const onReadRef=useRef(onRead),opened=useRef(false),timer=useRef(null)
 const [feedback,setFeedback]=useState('')
 useEffect(()=>{onReadRef.current=onRead},[onRead])
 useEffect(()=>{
  opened.current=false
  const openIfShared=()=>{
   if(opened.current||!jobId||typeof window==='undefined')return
   if(sharedJobId(window.location.hash)!==jobId)return
   opened.current=true
   onReadRef.current?.()
  }
  openIfShared()
  window.addEventListener('hashchange',openIfShared)
  return()=>window.removeEventListener('hashchange',openIfShared)
 },[jobId])
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
 function flash(message){
  setFeedback(message)
  if(timer.current)clearTimeout(timer.current)
  timer.current=setTimeout(()=>setFeedback(''),2400)
 }
 async function share(){
  const url=new URL(window.location.href)
  url.hash=jobShareHash(job)
  const data={title:job?.title||'فرصة عمل',url:url.toString()}
  if(navigator.share&&(!navigator.canShare||navigator.canShare(data))){
   try{await navigator.share(data);return}
   catch(error){if(error?.name==='AbortError')return}
  }
  try{await navigator.clipboard.writeText(data.url);flash('تم نسخ رابط الوظيفة')}
  catch{flash('تعذّر نسخ الرابط')}
 }
 const label=contact?.channel==='telegram'?'التواصل عبر تليغرام':contact?.channel==='whatsapp'?'التواصل عبر واتساب':'اتصال هاتفي'
 const Icon=contact?.channel==='telegram'?Send:contact?.channel==='whatsapp'?WhatsAppIcon:Phone
 return <div className="job-actions">
  {contact?<a className="primary small contact-primary" href={contact.href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}><Icon size={18} aria-hidden="true"/><span>تواصل</span></a>:<span className="no-contact">لم تُذكر وسائل تواصل مباشرة</span>}
  <div className="job-actions-secondary">
   <div className="contact-buttons"><button type="button" className="contact-icon share-button" onClick={share} aria-label="مشاركة رابط الوظيفة" title="مشاركة رابط الوظيفة"><Share2 size={18} aria-hidden="true"/></button></div>
   {onApply&&<button type="button" className="read-full-post" onClick={onApply}>طلب توظيف كامل</button>}
   {onRead&&<button type="button" className="read-full-post" onClick={onRead}><span>{job.type==='candidates'?'الملف كاملاً':'المنشور كاملاً'}</span><ArrowUpLeft size={15} aria-hidden="true"/></button>}
   {feedback&&<span className="share-feedback" role="status">{feedback}</span>}
  </div>
 </div>
}
