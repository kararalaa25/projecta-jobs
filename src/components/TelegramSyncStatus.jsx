import {useEffect,useState} from 'react'
import {Clock3,RefreshCw} from 'lucide-react'
import {number} from '../i18n'
const format=new Intl.DateTimeFormat('ar-IQ',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Baghdad'})

export default function TelegramSyncStatus({compact=false}){
 const [sync,setSync]=useState(null)
 useEffect(()=>{
  const controller=new AbortController();let pending=false
  async function refresh(){
   if(pending||document.visibilityState==='hidden')return
   pending=true
   try{
    const response=await fetch('/api/telegram-status',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
    if(!response.ok)throw Error('Status unavailable')
    const value=await response.json()
    if(!controller.signal.aborted)setSync(value)
   }catch{if(!controller.signal.aborted)setSync(previous=>({...previous,status:'unknown'}))}
   finally{pending=false}
  }
  void refresh();const timer=setInterval(refresh,60000)
  document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);window.addEventListener('focus',refresh)
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh)}
 },[])
 const checked=sync?.lastCheckedAt?new Date(sync.lastCheckedAt):null
 const valid=checked&&Number.isFinite(checked.getTime())
 const Icon=sync?.status==='checking'?RefreshCw:Clock3
 return <div className={`telegram-sync-status ${sync?.status||'loading'} ${compact?'is-compact':''}`} role="status" aria-live="polite" aria-atomic="true">
  <Icon size={17} aria-hidden="true"/>
  <div><span className="sync-last-check">{valid?<>آخر تحقق من القنوات: <time dateTime={checked.toISOString()}>{format.format(checked)}</time></>:sync?.status==='unknown'?'جارٍ إعادة التحقق من حالة المزامنة تلقائياً…':'جارٍ التحقق من آخر مزامنة…'}</span>
   {!compact&&<span>فحص تلقائي كل {number(5)} دقائق · وقت الإعلان هو وقت نشره الأصلي.</span>}
   {sync?.status==='checking'&&<span>جارٍ فحص القنوات الآن…</span>}
   {sync?.status==='delayed'&&<span>تأخرت آخر مزامنة؛ تستمر إعادة المحاولة تلقائياً.</span>}
   {sync?.status==='unknown'&&valid&&<span>تعذر تأكيد آخر تحقق. ستتم إعادة المحاولة تلقائياً.</span>}
  </div>
 </div>
}
