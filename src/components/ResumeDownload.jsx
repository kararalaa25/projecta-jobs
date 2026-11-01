import {useState} from 'react'
import {resumeRequest} from '../resumes'
export default function ResumeDownload({id,label='تنزيل السيرة الذاتية'}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function download(){setBusy(true);setError('');try{const {url}=await resumeRequest(null,id);const link=document.createElement('a');link.href=url;link.rel='noopener noreferrer';link.download='';link.click()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <><button type="button" className="admin-outline" onClick={download} disabled={busy}>{busy?'جارٍ تجهيز التنزيل…':label}</button>{error&&<p role="alert">{error}</p>}</>
}
