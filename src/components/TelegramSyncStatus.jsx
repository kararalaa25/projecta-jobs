import {useEffect,useState,useRef} from 'react'
import {Clock3,RefreshCw,CheckCircle2,AlertTriangle,Signal} from 'lucide-react'
import {number} from '../i18n'
const format=new Intl.DateTimeFormat('ar-IQ',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Baghdad'})
const TIMEOUT_ERROR='انتهت مهلة الاتصال بحالة المزامنة. أعد المحاولة.'
const UNAVAILABLE_ERROR='تعذر الوصول إلى حالة المزامنة. أعد المحاولة.'

export default function TelegramSyncStatus({compact=false}){
 const [sync,setSync]=useState(null)
 const [spinning,setSpinning]=useState(false)
 const pendingRef=useRef(false)
 const controllerRef=useRef(new AbortController())
 const refreshRef=useRef(null)
 useEffect(()=>{
  const refresh=async({force=false}={})=>{
   if(pendingRef.current||(!force&&document.visibilityState==='hidden'))return
   pendingRef.current=true
   try{
    const response=await fetch('/api/telegram-status',{cache:'no-store',signal:AbortSignal.any([controllerRef.current.signal,AbortSignal.timeout(10000)])})
    if(!response.ok)throw Object.assign(Error('Status unavailable'),{name:'UnavailableError'})
    const value=await response.json()
    if(!controllerRef.current.signal.aborted)setSync(current=>({...current,...value}))
   }catch(error){
    if(controllerRef.current.signal.aborted)return
    const timeout=error?.name==='TimeoutError'||error?.name==='AbortError'
    setSync(previous=>({...previous,status:'unknown',error:timeout?TIMEOUT_ERROR:UNAVAILABLE_ERROR}))
   }finally{
    pendingRef.current=false
   }
  }
  refreshRef.current=refresh
  void refresh()
  const timer=setInterval(()=>{void refresh()},60000)
  document.addEventListener('visibilitychange',refresh)
  window.addEventListener('online',refresh)
  window.addEventListener('focus',refresh)
  return()=>{
   controllerRef.current.abort()
   clearInterval(timer)
   document.removeEventListener('visibilitychange',refresh)
   window.removeEventListener('online',refresh)
   window.removeEventListener('focus',refresh)
   refreshRef.current=null
  }
 },[])
 const checked=sync?.lastCheckedAt?new Date(sync.lastCheckedAt):null
 const valid=Boolean(checked&&Number.isFinite(checked.getTime()))
 const live=sync?.status==='ok'||sync?.status==='live'||sync?.status==='ready'
 const Icon=live?Signal:sync?.status==='checking'?RefreshCw:sync?.status==='unknown'?AlertTriangle:sync?.status==='delayed'?AlertTriangle:Clock3
 const relative=valid?`${number(sync?.minutesAgo ?? Math.max(1,Math.round((Date.now()-checked.getTime())/60000)))} دقيقة`:''
 async function manualRefresh(){
  if(spinning||pendingRef.current)return
  setSpinning(true)
  try{await refreshRef.current?.({force:true})}finally{setSpinning(false)}
 }
 return <div className={`telegram-sync-status ${sync?.status||'loading'} ${compact?'is-compact':''} ${spinning?'is-spinning':''}`} role="status" aria-live="polite" aria-atomic="true">
  <span className="sync-dot" aria-hidden="true"><i/></span>
  <Icon size={17} aria-hidden="true" className={spinning?'sync-icon-spin':''}/>
  <div>
   <span className="sync-last-check">
    {live?<>متزامن مع تيليجرام{valid?` · آخر تحديث قبل ${relative}`:''}</>:valid?<>آخر تحقق من القنوات: <time dateTime={checked.toISOString()}>{format.format(checked)}</time></>:sync?.status==='unknown'?'جارٍ إعادة التحقق من المزامنة تلقائياً…':'جارٍ التحقق من آخر مزامنة…'}
   </span>
   {!compact&&<span>فحص تلقائي كل {number(5)} دقائق · وقت الإعلان هو وقت نشره الأصلي.</span>}
   {sync?.status==='checking'&&<span>جارٍ فحص القنوات الآن…</span>}
   {sync?.status==='delayed'&&<span>تأخرت آخر مزامنة؛ تستمر إعادة المحاولة تلقائياً.</span>}
   {sync?.status==='unknown'&&<span>{sync.error||'ستتم إعادة المحاولة تلقائياً.'}</span>}
  </div>
  <button className="sync-refresh" type="button" onClick={manualRefresh} aria-label="تحديث المزامنة يدوياً" disabled={spinning}>
   <RefreshCw size={15} className={spinning?'sync-icon-spin':''}/>
   <span>{spinning?'جارٍ التحديث':'تحديث'}</span>
  </button>
 </div>
}
