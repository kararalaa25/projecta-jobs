import {useRef,useState} from 'react'
import {UploadCloud,FileCheck2} from 'lucide-react'
import {uploadResume} from '../resumes'
import {licenseFileSpec,licenseUploadFile} from './license-file.js'
import ResumeDownload from '../components/ResumeDownload'
export default function LicenseUpload({assetId,required,disabled,onChange,onBusyChange}){
 const input=useRef(null),inFlight=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stage,setStage]=useState('')
 async function select(event){
  const file=event.target.files?.[0];if(!file||disabled||inFlight.current)return
  setError('');try{licenseFileSpec(file)}catch(failure){setError(failure.message);event.target.value='';return}
  inFlight.current=true;setBusy(true);onBusyChange?.(true);setStage('جارٍ تجهيز المستند…')
  try{const prepared=await licenseUploadFile(file),asset=await uploadResume(prepared,setStage);onChange(asset.id)}catch(failure){setError(/[\u0600-\u06ff]/.test(failure.message||'')?failure.message:'تعذر قراءة المستند أو رفعه. اختر ملفاً صالحاً وأعد المحاولة.')}finally{inFlight.current=false;setBusy(false);onBusyChange?.(false);setStage('');if(input.current)input.current.value=''}
 }
 return <section className="license-upload" aria-label="مستند العضوية النقابية" aria-busy={busy}><strong>بطاقة النقابة أو الترخيص {required?'— مطلوبة':'— اختيارية'}</strong><p>بطاقة نقابة أطباء الأسنان أو الصيادلة أو الأطباء في العراق. صورة JPG/PNG أو PDF، حتى 5 ميغابايت.</p>{assetId&&<div className="license-upload-ready"><FileCheck2 size={18}/><span>مستند مرفوع للمراجعة</span><ResumeDownload id={assetId} label="فتح مستند الترخيص"/></div>}<button type="button" className="admin-outline" disabled={disabled||busy} onClick={()=>input.current?.click()}><UploadCloud size={18}/>{busy?stage:assetId?'استبدال المستند':'رفع بطاقة النقابة / الترخيص'}</button><input ref={input} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" aria-label="رفع بطاقة النقابة أو الترخيص" disabled={disabled||busy} onChange={select}/><small>يُحفظ المستند بشكل خاص للمراجعة. تُجهّز الصور بصيغة PDF قبل رفعها؛ لا يمنح الرفع شارة توثيق تلقائية.</small>{error&&<p className="form-message" role="alert">{error}</p>}</section>
}
