import CredentialBadges from '../components/CredentialBadges'
import {useEffect,useMemo,useState} from 'react'
import {Users,Search,MapPin,SlidersHorizontal,Plus,ArrowUpLeft,FileText,GraduationCap,Clock3,Phone,Trash2} from 'lucide-react'
import ProjectaLogo from '../components/ProjectaLogo'
import Modal from '../components/Modal'
import SpecialtyBadge from '../components/SpecialtyBadge'
import {VerificationStatus} from '../components/VerifiedBadge'
import WhatsAppIcon from '../components/WhatsAppIcon'
import TalentCard from './TalentCard'
import usePublishedDirectory from '../usePublishedDirectory.js'
import TalentForm from './TalentForm'
import TalentCvPreview from './TalentCvPreview'
import {talentRoles,talentCities,availabilityOptions,workOptions,demoTalent,talentMatches,talentSearchText,talentCity,talentContacts,legacyTalentProfiles} from './data.js'
import {loadTalentProfiles,deleteTalentProfile} from './storage.js'
import {ar,number} from '../i18n.js'
import './talent.css'

const emptyFilters={query:'',city:'',role:'',availability:'',workType:''}
function initialFilters(){
 const params=new URLSearchParams(window.location.search)
 return {query:(params.get('q')||'').slice(0,200),city:talentCity(params.get('city')||''),
  role:talentRoles.some(role=>role.id===params.get('specialty'))?params.get('specialty'):'',
  availability:availabilityOptions.some(option=>option.id===params.get('availability'))?params.get('availability'):'',
  workType:workOptions.some(option=>option.id===params.get('work'))?params.get('work'):''}
}
function ProfileDetails({profile,onPreview}){
 const contacts=talentContacts(profile)
 return <div className="talent-details"><p className="talent-detail-headline">{profile.headline||ar(profile.role)}</p><div className="talent-identity-tags"><SpecialtyBadge role={profile.role}/><VerificationStatus verification={profile.verification} context={profile.source==='demo'?'sample':profile.source==='platform'?'profile':'local'}/><CredentialBadges verification={profile.source==='platform'?profile.verification:null}/></div><div className="talent-detail-location"><MapPin size={16} aria-hidden="true"/>{ar(profile.city)}<Clock3 size={16} aria-hidden="true"/>{availabilityOptions.find(item=>item.id===profile.availability).label}</div><h3>المؤهلات المهنية المعلنة</h3><p>{profile.qualification||'لم تُضف مؤهلات بعد.'}</p><h3>نبذة سريرية ومهنية</h3><p>{profile.bio||'لم تُضف نبذة بعد.'}</p><h3>مجالات الخبرة</h3>{profile.skills.length?<ul className="talent-detail-skills">{profile.skills.map(skill=><li key={skill}>{skill}</li>)}</ul>:<p>لم تُضف مجالات خبرة بعد.</p>}<h3>أنواع الدوام المفضلة</h3><p>{profile.workTypes.map(type=>workOptions.find(item=>item.id===type).label).join(' · ')||'الدوام غير محدد'}</p><div className="talent-detail-actions">{(profile.source==='demo'||profile.cv)&&<button className="primary" onClick={()=>onPreview(profile)}><FileText size={17} aria-hidden="true"/> معاينة السيرة الذاتية</button>}{contacts.whatsapp&&<a className="talent-detail-contact" href={contacts.whatsapp} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={18}/> واتساب</a>}{contacts.phone&&<a className="talent-detail-contact" href={contacts.phone}><Phone size={17} aria-hidden="true"/> اتصال مباشر</a>}</div></div>
}

export default function TalentDirectory(){
 const {items:published,error:directoryError}=usePublishedDirectory('talent')
 const [profiles,setProfiles]=useState([]),[legacy,setLegacy]=useState([]),[loading,setLoading]=useState(true),[storageError,setStorageError]=useState(''),[notice,setNotice]=useState('')
 const [filters,setFilters]=useState(initialFilters),[showDemo,setShowDemo]=useState(()=>new URLSearchParams(window.location.search).get('demo')!=='0'),[sort,setSort]=useState('availability'),[modal,setModal]=useState(null),[busy,setBusy]=useState(false)
 const [refreshKey,setRefreshKey]=useState(0),[visibleCount,setVisibleCount]=useState(24)
 useEffect(()=>{const previous=document.title;document.title='دليل الكفاءات الطبية في العراق | Projecta';return()=>{document.title=previous}},[])
 useEffect(()=>{
  let alive=true
  async function load(){
   try{const data=await loadTalentProfiles();if(alive){setProfiles(data);setStorageError('')}}catch(error){if(alive)setStorageError(error.message)}finally{if(alive)setLoading(false)}
   if(alive){try{setLegacy(legacyTalentProfiles(window.localStorage))}catch{setLegacy([])}}
  }
  load();window.addEventListener('focus',load)
  return()=>{alive=false;window.removeEventListener('focus',load)}
 },[refreshKey])
 useEffect(()=>{
  const params=new URLSearchParams()
  for(const [key,param] of [['query','q'],['city','city'],['role','specialty'],['availability','availability'],['workType','work']])if(filters[key])params.set(param,filters[key])
  if(!showDemo)params.set('demo','0')
  const search=params.toString();window.history.replaceState({},'',window.location.pathname+(search?'?'+search:'')+window.location.hash)
 },[filters,showDemo])
 useEffect(()=>setVisibleCount(24),[filters,sort,showDemo])
 const allProfiles=useMemo(()=>[...published,...profiles,...legacy,...(showDemo?demoTalent:[])].map(profile=>({...profile,searchText:talentSearchText(profile)})),[published,profiles,legacy,showDemo])
 const filtered=useMemo(()=>allProfiles.filter(profile=>talentMatches(profile,filters)).sort((a,b)=>{
  if(sort==='experience')return (b.experience??-1)-(a.experience??-1)||a.name.localeCompare(b.name,'ar')
  if(sort==='name')return a.name.localeCompare(b.name,'ar')
  return Number(a.source==='demo')-Number(b.source==='demo')||['available','open','unavailable'].indexOf(a.availability)-['available','open','unavailable'].indexOf(b.availability)||(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)
 }),[allProfiles,filters,sort])
 const hasFilters=Object.values(filters).some(Boolean)
 function update(key,value){setFilters(current=>({...current,[key]:value}))}
 function saved(profile){setProfiles(current=>[profile,...current.filter(item=>item.id!==profile.id)]);setModal(null);setFilters(emptyFilters);setShowDemo(false);setNotice('تم حفظ الملف والسيرة الذاتية محلياً على هذا الجهاز.');setStorageError('')}
 async function remove(){
  if(busy)return
  setBusy(true)
  try{const id=modal.profile.id;await deleteTalentProfile(id);setProfiles(current=>current.filter(profile=>profile.id!==id));setModal(null);setNotice('تم حذف الملف وسيرته الذاتية من هذا الجهاز.')}
  catch(error){setNotice(error.message)}finally{setBusy(false)}
 }
 const viewProfile=profile=>setModal({type:'details',profile}),preview=profile=>setModal({type:'cv',profile})
 return <div className="talent-page">
  <a className="skip-link" href="#talent-results">انتقل إلى دليل الكفاءات</a>
  <header className="talent-header"><a href="/" aria-label="Projecta — الصفحة الرئيسية"><ProjectaLogo/></a><nav aria-label="التنقل في دليل الكفاءات"><a href="/">الرئيسية</a><a href="/#job-board">فرص العمل</a><a href="/talent" aria-current="page">دليل الكفاءات</a><a href="/training">التدريب</a></nav><button className="primary" onClick={()=>setModal({type:'edit',profile:null})}><Plus size={17} aria-hidden="true"/> أضف ملفك</button></header>
  <main>
   <section className="talent-hero"><div><span className="talent-eyebrow"><Users size={16} aria-hidden="true"/> دليل الكفاءات الطبية · العراق</span><h1>كفاءات ترتقي <span>بفريقك الطبي.</span></h1><p>استكشف الخبرات الطبية، تعرّف على المسارات السريرية، وابحث عن الشخص المناسب لعيادتك أو مؤسستك.</p><div className="talent-hero-actions"><a href="#talent-results" className="talent-explore">استكشف الكفاءات <ArrowUpLeft size={17} aria-hidden="true"/></a><span>تخصص واضح. خبرة منظمة. تواصل مباشر.</span></div></div><aside className="talent-hero-aside" aria-label="خصائص الدليل"><div><MapPin size={24} aria-hidden="true"/><strong>{number(talentCities.length)}</strong><span>محافظة عراقية</span></div><div><GraduationCap size={24} aria-hidden="true"/><strong>{number(talentRoles.length)}</strong><span>مسارات مهنية</span></div><div><FileText size={24} aria-hidden="true"/><strong>CV</strong><span>سيرة وخبرات سريرية</span></div></aside></section>
   <section className="talent-directory" aria-label="البحث في الكفاءات الطبية"><div className="talent-container">
    <p className="talent-local-banner"><span>دليل الكفاءات</span> تظهر الملفات المنشورة من المنصة هنا.  الملفات والسير الذاتية التي تضيفها محفوظة على هذا المتصفح فقط. الملفات التوضيحية معلّمة بوضوح، ولا تمثل متقدّمين فعليين.</p>
    {directoryError&&<p className="talent-local-note" role="status">{directoryError}</p>}<div className="talent-search-panel"><label className="talent-search"><Search size={20} aria-hidden="true"/><span className="sr-only">ابحث في الكفاءات الطبية</span><input type="search" value={filters.query} onChange={event=>update('query',event.target.value)} placeholder="ابحث بالاسم، التخصص، المهارة، أو المؤهل…" maxLength={200} aria-controls="talent-results"/></label><div className="talent-filter-grid"><label>المحافظة<select aria-label="المحافظة" value={filters.city} onChange={event=>update('city',event.target.value)}><option value="">كل المحافظات</option>{talentCities.map(city=><option key={city.id} value={city.id}>{city.ar}</option>)}</select></label><label>التخصص المهني<select aria-label="التخصص المهني" value={filters.role} onChange={event=>update('role',event.target.value)}><option value="">كل التخصصات</option>{talentRoles.map(role=><option key={role.id} value={role.id}>{role.ar}</option>)}</select></label><label>حالة التفرغ<select aria-label="حالة التفرغ" value={filters.availability} onChange={event=>update('availability',event.target.value)}><option value="">كل الحالات</option>{availabilityOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>نوع الدوام<select aria-label="نوع الدوام" value={filters.workType} onChange={event=>update('workType',event.target.value)}><option value="">كل أنواع الدوام</option>{workOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label></div><div className="talent-filter-footer"><label><input type="checkbox" checked={showDemo} onChange={event=>setShowDemo(event.target.checked)}/> إظهار الملفات التوضيحية</label><button onClick={()=>setFilters(emptyFilters)} disabled={!hasFilters}><SlidersHorizontal size={15} aria-hidden="true"/> مسح التصفية</button></div></div>
    {notice&&<div className="talent-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="إخفاء الرسالة">×</button></div>}
    {storageError&&<div className="talent-storage-error" role="alert"><span>{storageError}</span><button onClick={()=>setRefreshKey(value=>value+1)}>إعادة المحاولة</button></div>}
    <div className="talent-results-heading"><div><span>أشخاص. خبرات. فرص جديدة.</span><h2 id="talent-results-title">الكفاءات الطبية <small aria-live="polite">{number(filtered.length)} ملفاً {showDemo&&'· تشمل ملفات توضيحية'}</small></h2></div><label className="talent-sort">الترتيب<select aria-label="ترتيب الكفاءات" value={sort} onChange={event=>setSort(event.target.value)}><option value="availability">التفرغ أولاً</option><option value="experience">الأكثر خبرة</option><option value="name">الاسم</option></select></label></div>
    {loading&&<p className="talent-local-note" role="status">جارٍ قراءة ملفاتك المحلية…</p>}
    <div className="talent-grid" id="talent-results" aria-labelledby="talent-results-title">{filtered.slice(0,visibleCount).map(profile=><TalentCard key={profile.id} profile={profile} onPreview={preview} onDetails={viewProfile} onEdit={profile=>setModal({type:'edit',profile})} onDelete={profile=>setModal({type:'delete',profile})}/>)}{!filtered.length&&!loading&&<div className="talent-empty"><Users size={38} aria-hidden="true"/><h3>{hasFilters?'لا توجد كفاءات تطابق بحثك':'ابدأ بملفك المهني'}</h3><p>{hasFilters?'جرّب تخصصاً أو محافظة أخرى، أو امسح التصفية لعرض الخيارات المتاحة.':'أضف خبراتك وسيرتك الذاتية إلى هذا الجهاز، أو استكشف الملفات التوضيحية.'}</p><button className="primary" onClick={()=>hasFilters?setFilters(emptyFilters):setModal({type:'edit',profile:null})}>{hasFilters?'مسح التصفية':'أضف ملفك المهني'}</button>{!showDemo&&<button className="talent-empty-secondary" onClick={()=>setShowDemo(true)}>استعراض الملفات التوضيحية</button>}</div>}</div>
   {visibleCount<filtered.length&&<button className="load-more" onClick={()=>setVisibleCount(value=>value+24)}>عرض المزيد من الكفاءات</button>}</div></section>
  </main>
  <footer className="talent-footer"><ProjectaLogo/><p>خبرات واضحة. تواصل أقرب. رعاية أفضل.</p><a href="/#job-board">العودة إلى فرص العمل <ArrowUpLeft size={15} aria-hidden="true"/></a></footer>
  {modal&&<Modal title={modal.type==='edit'?(modal.profile?'تعديل الملف المهني':'أضف ملفك المهني'):modal.type==='cv'?'السيرة الذاتية':modal.type==='delete'?'حذف الملف المحلي':modal.profile.name} onClose={()=>{if(!busy)setModal(null)}}>{modal.type==='edit'?<TalentForm key={modal.profile?.id||'new'} profile={modal.profile} onSaved={saved}/>:modal.type==='cv'?<TalentCvPreview profile={modal.profile}/>:modal.type==='delete'?<div className="talent-delete"><Trash2 size={32} aria-hidden="true"/><p>سيُحذف ملف {modal.profile.name} وسيرته الذاتية من هذا المتصفح.</p><button className="primary full" disabled={busy} onClick={remove}>{busy?'جارٍ الحذف…':'حذف الملف والسيرة الذاتية'}</button><button className="load-more full" disabled={busy} onClick={()=>setModal(null)}>إبقاء الملف</button></div>:<ProfileDetails profile={modal.profile} onPreview={preview}/>}</Modal>}
 </div>
}
