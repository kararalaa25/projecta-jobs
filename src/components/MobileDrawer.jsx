import {useEffect,useRef} from 'react'
import {acquireOverlayLock} from '../overlay-lock.js'
import {createPortal} from 'react-dom'
import {X,Plus,ShieldCheck,Bookmark,ArrowUpLeft,Users,GraduationCap} from 'lucide-react'

export default function MobileDrawer({open,onClose,onAccount,onPost,onSaved,onInformation,isAdmin}){
 const ref=useRef(null),close=useRef(onClose)
 close.current=onClose
 useEffect(()=>{
  if(!open)return
  const previous=document.activeElement,el=ref.current,release=acquireOverlayLock({inertRoot:true})
  const frame=requestAnimationFrame(()=>el.focus())
  const key=e=>{
   if(e.key==='Escape')close.current()
   if(e.key==='Tab'){
    const nodes=[...el.querySelectorAll('a[href],button:not(:disabled)')],first=nodes[0],last=nodes.at(-1)
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===el||!el.contains(document.activeElement))){e.preventDefault();last?.focus()}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===el||!el.contains(document.activeElement))){e.preventDefault();first?.focus()}
   }
  }
  const media=window.matchMedia('(min-width: 851px)'),resize=()=>{if(media.matches)close.current()}
  document.addEventListener('keydown',key);media.addEventListener('change',resize)
  return()=>{cancelAnimationFrame(frame);release();document.removeEventListener('keydown',key);media.removeEventListener('change',resize);previous?.focus({preventScroll:true})}
 },[open])
 return createPortal(<div className={`drawer-overlay ${open?'is-open':''}`} onClick={e=>e.target===e.currentTarget&&onClose()} inert={!open} aria-hidden={!open}>
  <section id="mobile-menu" className="mobile-drawer" role="dialog" aria-modal={open?true:undefined} aria-labelledby="drawer-title" tabIndex={-1} ref={ref}>
   <div className="drawer-heading"><h2 id="drawer-title">مرحباً بك في بروجكتا</h2><button className="icon-button" aria-label="إغلاق القائمة" onClick={onClose}><X/></button></div>
   <p>خطوتك القادمة في الرعاية الصحية.</p>
   <nav aria-label="قائمة الهاتف">
    <a href="#job-board" onClick={onClose}>استكشف فرص العمل <ArrowUpLeft size={18}/></a>
    <a href="/talent" onClick={onClose}>دليل الكفاءات الطبية <Users size={18}/></a>
    <a href="/training" onClick={onClose}>التدريب والورش <GraduationCap size={18}/></a>
    <button aria-haspopup="dialog" onClick={()=>onInformation('features')}>المزايا</button><button aria-haspopup="dialog" onClick={()=>onInformation('about')}>عن بروجكتا</button><a href="#connect" onClick={onClose}>تواصل معنا</a>
    <button onClick={()=>{onClose();onSaved()}}>الإعلانات المحفوظة <Bookmark size={18}/></button>
    <button aria-haspopup="dialog" onClick={()=>{onClose();onAccount()}}>حسابي <ShieldCheck size={18}/></button>
    {isAdmin&&<a href="/admin">الإدارة <ShieldCheck size={18}/></a>}
   </nav>
   <button className="primary full" onClick={()=>{onClose();onPost()}}><Plus size={18}/> نشر فرصة عمل</button>
  </section>
 </div>,document.body)
}
