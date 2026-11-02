import {lazy,Suspense,useEffect,useState} from 'react'
import {Download,RefreshCw} from 'lucide-react'
import {applicationRequest} from './application-client'
import '../talent/talent.css'
const PdfViewer=lazy(()=>import('../talent/PdfCanvasViewer'))
export default function ApplicantCv({jobId,applicationId,name}){
 const [file,setFile]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{const controller=new AbortController();let objectUrl;setFile(null);setError('')
 ;(async()=>{try{const info=await applicationRequest({view:'cv',job_id:jobId,application_id:applicationId},controller.signal),response=await fetch(info.url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('تعذر تحميل السيرة الذاتية.');const blob=await response.blob();if(blob.size>5*1024*1024)throw Error('الملف أكبر من الحد المسموح.');if(controller.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setFile({blob,url:objectUrl,name:info.filename||'cv',pdf:info.mimeType==='application/pdf'||/\.pdf$/i.test(info.filename||'')})}catch(failure){if(!controller.signal.aborted)setError(failure.message||'تعذر فتح السيرة الذاتية.')}})()
 return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)}
 },[jobId,applicationId,revision])
 return <section className="applicant-cv" aria-label={`السيرة الذاتية: ${name}`}>{error?<div role="alert"><p>{error}</p><button onClick={()=>setRevision(value=>value+1)}><RefreshCw size={17}/> إعادة المحاولة</button></div>:!file?<p role="status">جارٍ تحميل السيرة الذاتية بأمان…</p>:<><a className="primary cv-download" href={file.url} download={file.name}><Download size={20}/> تحميل السيرة الذاتية</a>{file.pdf?<Suspense fallback={<p role="status">جارٍ تجهيز المعاينة…</p>}><PdfViewer blob={file.blob} name={name}/></Suspense>:<p>المعاينة المباشرة متاحة لملفات PDF. حمّل هذا الملف لفتحه بصيغته الأصلية.</p>}</>}</section>
}
