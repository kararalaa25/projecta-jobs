import {useEffect,useId,useRef} from 'react'
import {createPortal} from 'react-dom'
import {acquireOverlayLock} from '../overlay-lock.js'
import {X} from 'lucide-react'
export default function Modal({title,children,onClose}){
 const ref=useRef(null),close=useRef(onClose),titleId=useId();close.current=onClose
 useEffect(()=>{
  const old=document.activeElement,el=ref.current,release=acquireOverlayLock({inertRoot:true})
  el.focus({preventScroll:true})
  const key=event=>{
   if(event.key==='Escape'){event.preventDefault();close.current()}
   if(event.key==='Tab'){
    const nodes=[...el.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length)
    const first=nodes[0],last=nodes.at(-1),outside=!el.contains(document.activeElement)
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===el||outside)){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===el||outside)){event.preventDefault();first?.focus()}
   }
  }
  document.addEventListener('keydown',key)
  return()=>{document.removeEventListener('keydown',key);release();if(old?.isConnected)old.focus({preventScroll:true})}
 },[])
 return createPortal(<div className="overlay" onMouseDown={event=>event.target===event.currentTarget&&close.current()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}><div className="modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="إغلاق النافذة" onClick={onClose}><X/></button></div>{children}</section></div>,document.body)
}
