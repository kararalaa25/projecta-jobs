import { useEffect,useRef } from 'react'
import { X } from 'lucide-react'
export default function Modal({title,children,onClose}){
 const ref=useRef(null),close=useRef(onClose);close.current=onClose
 useEffect(()=>{const old=document.activeElement,el=ref.current;el.focus();const key=e=>{if(e.key==='Escape')close.current();if(e.key==='Tab'){const nodes=[...el.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href]')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===el)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',key);const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;old?.focus()}},[])
 return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close.current()}><section className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="إغلاق النافذة" onClick={onClose}><X/></button></div>{children}</section></div>
}
