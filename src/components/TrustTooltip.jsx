import {useId,useLayoutEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
export default function TrustTooltip({className,label,description,children}){
 const [open,setOpen]=useState(false),[position,setPosition]=useState(null),id=useId(),trigger=useRef(null),tooltip=useRef(null)
 useLayoutEffect(()=>{
  if(!open)return
  const place=()=>{
   const rect=trigger.current.getBoundingClientRect(),width=Math.min(280,window.innerWidth-24),height=tooltip.current.offsetHeight
   if(rect.bottom<0||rect.top>window.innerHeight){setOpen(false);return}
   const left=Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12))
   const top=rect.bottom+height<=window.innerHeight-12?rect.bottom:Math.max(12,rect.top-height)
   setPosition({left,top,width})
  }
  place()
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true)
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)}
 },[open])
 return <span className="credential-wrap" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}><button ref={trigger} type="button" className={className} aria-label={label} aria-expanded={open} aria-describedby={id} onClick={()=>setOpen(true)} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false)}}}>{children}</button>{createPortal(<span ref={tooltip} id={id} role="tooltip" className="credential-tooltip" hidden={!open} style={{...position,visibility:position?'visible':'hidden'}}>{description}</span>,document.body)}</span>
}
