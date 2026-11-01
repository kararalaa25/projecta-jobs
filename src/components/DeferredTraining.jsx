import {lazy,useEffect,useRef,useState} from 'react'
import AsyncContent from './AsyncContent'
const TrainingSection=lazy(()=>import('../training/TrainingSection'))
function TrainingPlaceholder(){return <div className="training-placeholder" role="status" aria-label="جارٍ تحميل التدريب والورش"><span className="skeleton-line"/><span className="skeleton-line"/><div className="training-placeholder-grid">{[0,1,2].map(index=><div key={index} className="training-placeholder-card"><span className="skeleton-line"/><span className="skeleton-line"/></div>)}</div></div>}
export default function DeferredTraining(){
 const container=useRef(null),[visible,setVisible]=useState(false)
 useEffect(()=>{
  if(!('IntersectionObserver' in window)){setVisible(true);return}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'600px'})
  observer.observe(container.current)
  return()=>observer.disconnect()
 },[])
 return <div ref={container} className="deferred-training" id="training">{visible?<AsyncContent fallback={<TrainingPlaceholder/>}><TrainingSection/></AsyncContent>:<TrainingPlaceholder/>}</div>
}
