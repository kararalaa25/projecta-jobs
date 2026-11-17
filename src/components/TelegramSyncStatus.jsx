import {useEffect,useState,useRef} from 'react'
import {Clock3,RefreshCw,CheckCircle2,AlertTriangle,Signal} from 'lucide-react'
import {number} from '../i18n'
const format=new Intl.DateTimeFormat('ar-IQ',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Baghdad'})

export default function TelegramSyncStatus({compact=false}){
 const [sync,setSync]=useState(null)
 const [spinning,setSpinning]=useState(false)
 const pendingRef=useRef(false)
 const controllerRef=useRef(new AbortController())
 const tickRef=useRef(0)
 useEffect(()=>{
  const controller=controllerRef.current
  async function refresh(){
   if(pendingRef.current||document.visibilityState==='hidden')return
   pendingRef.current=true
   try{
    const response=await fetch('/api/telegram-status',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
    if(!response.ok)throw Error('Status unavailable')
    const value=await response.json()
    if(!controller.signal.aborted)setSync(value)
   }catch{if(!controller.signal.aborted)setSync(previous=>({...previous,status:'unknown'}))}
   finally{pendingRef.current=false}
  }
  void refresh()
  const timer=setInterval(refresh,60000)
  document.addEventListener('visibilitychange',refresh)
  window.addEventListener('online',refresh)
  window.addEventListener('focus',refresh)
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh)}
 },[])
 const checked=sync?.lastCheckedAt?new Date(sync.lastCheckedAt):null
 const valid=checked&&Number.isFinite(checked.getTime())
 const live=sync?.status==='live'||sync?.status==='ready'
 const Icon=sync?.status==='checking'?RefreshCw:live?Signal:sync?.status==='delayed'?AlertTriangle:sync?.status==='unknown'?AlertTriangle:Clock3
 const relative=valid?`${number(sync?.minutesAgo ?? Math.max(1,Math.round((Date.now()-checked.getTime())/60000)))} دقيقة`:''
 async function manualRefresh(){
  if(spinning||pendingRef.current)return
  setSpinning(true)
  controllerRef.current.abort()
  controllerRef.current=new AbortController()
  pendingRef.current=false
  try{await fetch('/api/telegram-status',{cache:'no-store',signal:AbortSignal.any([controllerRef.current.signal,AbortSignal.timeout(10000)])})}catch{}
  setSync(null)
  setSpinning(false)
 }
 return <div className={`telegram-sync-status ${sync?.status||'loading'} ${compact?'is-compact':''} ${spinning?'is-spinning':''}`} role="status" aria-live="polite" aria-atomic="true">
  <span className="sync-dot" aria-hidden="true"><i/></span>
  <Icon size={17} aria-hidden="true" className={spinning?'sync-icon-spin':''}/>
  <div>
   <span className="sync-last-check">
    {live?<>متزامن مع تيليجرام · آخر تحديث قبل {relative}</>:valid?<>آخر تحقق من القنوات: <time dateTime={checked.toISOString()}>{format.format(checked)}</time></>:sync?.status==='unknown'?'جارٍ إعادة التحقق من المزامنة تلقائياً…':'جارٍ التحقق من آخر مزامنة…'}
   </span>
   {!compact&&<span>فحص تلقائي كل {number(5)} دقائق · وقت الإعلان هو وقت نشره الأصلي.</span>}
   {sync?.status==='checking'&&<span>جارٍ فحص القنوات الآن…</span>}
   {sync?.status==='delayed'&&<span>تأخرت آخر مزامنة؛ تستمر إعادة المحاولة تلقائياً.</span>}
   {sync?.status==='unknown'&&valid&&<span>تعذر تأكيد آخر تحقق. ستتم إعادة المحاولة تلقائياً.</span>}
  </div>
  <button className="sync-refresh" onClick={manualRefresh} aria-label="تحديث المزامنة يدوياً" disabled={spinning||pendingRef.current}>
   <RefreshCw size={15} className={spinning?'sync-icon-spin':''}/>
   <span>{spinning?'جارٍ التحديث':'تحديث'}</span>
  </button>
 </div>
}