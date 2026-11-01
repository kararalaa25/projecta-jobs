import {useLayoutEffect,useId,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {X} from 'lucide-react'
import './information-modal.css'

export default function InformationModal({title,children,onClose,returnFocus}){
 const dialog=useRef(null),timer=useRef(null),callback=useRef(onClose)
 const [closing,setClosing]=useState(false),titleId=useId()
 callback.current=onClose
 useLayoutEffect(()=>{
  const element=dialog.current,previous=returnFocus||document.activeElement
  const overflow=document.body.style.overflow
  const position={left:window.scrollX,top:window.scrollY,behavior:'instant'}
  element.showModal()
  document.body.style.overflow='hidden'
  // Native dialog autofocus can scroll its owner document. Keep the feed in place.
  window.scrollTo(position)
  return()=>{
   clearTimeout(timer.current)
   element.close()
   document.body.style.overflow=overflow
   if(previous?.isConnected)previous.focus({preventScroll:true})
   window.scrollTo(position)
  }
 },[returnFocus])
 function close(){
  if(timer.current)return
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){callback.current();return}
  setClosing(true)
  timer.current=setTimeout(()=>callback.current(),180)
 }
 function outside(event){
  if(event.target!==event.currentTarget)return
  const box=event.currentTarget.getBoundingClientRect()
  if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close()
 }
 function trapFocus(event){
  if(event.key!=='Tab')return
  const nodes=[...dialog.current.querySelectorAll('a[href],button:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length)
  const first=nodes[0],last=nodes.at(-1)
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 }
 return createPortal(<dialog ref={dialog} className={`information-dialog ${closing?'is-closing':''}`} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();close()}} onPointerDown={outside} onKeyDown={trapFocus}>
  <div className="information-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="إغلاق النافذة" onClick={close} autoFocus><X size={22}/></button></div>
  <div className="information-body">{children}</div>
 </dialog>,document.body)
}
