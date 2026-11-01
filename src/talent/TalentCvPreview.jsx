import {useEffect,useState,lazy,Suspense} from 'react'
import {Download,FileText,GraduationCap,MapPin} from 'lucide-react'
import {loadTalentCv} from './storage.js'
import SpecialtyBadge from '../components/SpecialtyBadge'
import {ar} from '../i18n.js'

const PdfCanvasViewer=lazy(()=>import('./PdfCanvasViewer'))

export default function TalentCvPreview({profile}){
 const [document,setDocument]=useState(null),[error,setError]=useState('')
 useEffect(()=>{
  if(profile.source==='demo')return
  let active=true,url
  setDocument(null);setError('')
  loadTalentCv(profile.id).then(file=>{
   if(!active)return
   if(!file?.blob||file.blob.type!=='application/pdf')throw Error('السيرة الذاتية غير متاحة على هذا الجهاز.')
   url=URL.createObjectURL(file.blob);setDocument({url,name:file.name,blob:file.blob})
  }).catch(failure=>{if(active)setError(failure.message||'تعذر فتح السيرة الذاتية.')})
  return()=>{active=false;if(url)URL.revokeObjectURL(url)}
 },[profile.id,profile.source])
 if(profile.source==='demo')return <div className="talent-demo-cv"><p className="talent-local-note">سيرة توضيحية لعرض التصميم؛ ليست سيرة متقدّم فعلي.</p><div className="talent-cv-paper"><FileText size={30} aria-hidden="true"/><h3>{profile.name}</h3><p>{profile.headline}</p><SpecialtyBadge role={profile.role}/><p><MapPin size={14} aria-hidden="true"/> {ar(profile.city)}</p><h4>المؤهل المهني</h4><p><GraduationCap size={16} aria-hidden="true"/> {profile.qualification}</p><h4>الخبرات والاهتمامات</h4><ul>{profile.skills.map(skill=><li key={skill}>{skill}</li>)}</ul><h4>النبذة المهنية</h4><p>{profile.bio}</p></div></div>
 if(error)return <p className="form-message" role="alert">{error}</p>
 if(!document)return <p className="talent-local-note" role="status">جارٍ فتح السيرة الذاتية المحلية…</p>
 return <div className="talent-pdf-preview"><a className="talent-download" href={document.url} download={document.name}><Download size={17} aria-hidden="true"/> تنزيل السيرة الذاتية</a><Suspense fallback={<p className="talent-local-note" role="status">جارٍ تحميل عارض السيرة الذاتية…</p>}><PdfCanvasViewer blob={document.blob} name={profile.name}/></Suspense><p className="talent-local-note">تُعرض هذه السيرة الذاتية محلياً دون رفع الملف. يمكنك تنزيل النسخة الأصلية أعلاه.</p></div>
}
