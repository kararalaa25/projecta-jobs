import ApplicantCard from './ApplicantCard'
import useTrustSync from '../useTrustSync'
import {useEffect,useState,useRef} from 'react'
import {applicationRequest} from './application-client'
import {exactDate} from '../dates'
import {applicationMutation} from './application-client'
import {applicationStatus} from '../../config/application-status.js'
import '../feed-enhancements.css'
export {applicationStatus} from '../../config/application-status.js'
export default function AccountApplications({publisher=false,onExplore}){
 const [selected,setSelected]=useState(null),[rows,setRows]=useState([]),[job,setJob]=useState(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 const [renewing,setRenewing]=useState(null)
 const viewKey=useRef('')
 useEffect(()=>{const controller=new AbortController(),key=`${publisher}:${selected}:${offset}`;if(viewKey.current!==key)setLoading(true);setError('');applicationRequest({view:publisher?selected?'applicants':'posted':'mine',offset:String(offset),...(selected?{job_id:selected}:{})},controller.signal).then(body=>{viewKey.current=key;setRows(body.rows);setJob(body.job||null);setMore(body.hasMore)}).catch(failure=>{if(!controller.signal.aborted)setError(failure.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[publisher,selected,offset,revision])
 useTrustSync(()=>setRevision(value=>value+1))
 useEffect(()=>{const refresh=()=>{if(document.visibilityState!=='hidden')setRevision(value=>value+1)};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[])
 async function updateStatus(row,status){
  await applicationMutation({action:'application.status',job_id:selected,application_id:row.id,status})
  setRows(current=>current.map(item=>item.id===row.id?{...item,status}:item))
 }
 async function renew(row){
  if(renewing)return
  setRenewing(row.id)
  try{await applicationMutation({action:'job.renew',job_id:row.id});setRevision(value=>value+1)}catch(failure){setError(failure.message)}finally{setRenewing(null)}
 }
 return <section className="account-application-dashboard">{selected&&<button className="dashboard-back" onClick={()=>{setSelected(null);setOffset(0)}}>العودة إلى الوظائف المعلنة</button>}{job&&<h3>{job.title} · {job.company}</h3>}{loading?<p role="status">جارٍ تحميل البيانات…</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</button></div>:!rows.length?<div className="empty-state"><h3>{publisher?selected?'لا توجد طلبات لهذه الوظيفة بعد':'لم تنشر وظائف بعد':'لم ترسل طلبات توظيف بعد'}</h3>{!publisher&&<button className="primary" onClick={onExplore}>استكشف فرص العمل</button>}</div>:<ul>{rows.map(row=><li key={row.id}>{publisher&&selected?<ApplicantCard row={row} jobId={selected} statusLabel={applicationStatus[row.status]||'قيد المراجعة'} onStatusChange={status=>updateStatus(row,status)}/>:publisher?<><h3>{row.title}</h3><p>{row.company}</p><time dateTime={row.created_at}>{exactDate(row.created_at)}</time><button className="primary" onClick={()=>{setSelected(row.id);setOffset(0)}}>عرض المتقدمين</button><div className="job-renewal"><span>{row.expires_at?`متاح حتى ${exactDate(row.expires_at)}`:'مدة ظهور الإعلان ٣٠ يوماً'}</span>{(row.status==='active'||row.archive_reason==='expired')&&<button disabled={Boolean(renewing)} onClick={()=>renew(row)}>{renewing===row.id?'جارٍ التجديد…':'تجديد الإعلان لمدة ٣٠ يوماً'}</button>}</div></>:<><h3>{row.job?.title||'إعلان غير متاح'}</h3><p>{row.job?.company||'جهة العمل'}</p><time dateTime={row.created_at}>{exactDate(row.created_at)}</time><span className={`application-state status-${row.status}`} role="status">{applicationStatus[row.status]||'قيد المراجعة'}</span></>}</li>)}</ul>}{!loading&&!error&&(offset>0||more)&&<nav aria-label="صفحات الطلبات"><button disabled={!offset} onClick={()=>setOffset(value=>Math.max(0,value-20))}>السابق</button><button disabled={!more} onClick={()=>setOffset(value=>value+20)}>التالي</button></nav>}</section>
}
