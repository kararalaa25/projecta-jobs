import VerifiedFilter from './components/VerifiedFilter'
import usePublishedDirectory from './usePublishedDirectory.js'
import {hasVerifiedCredentials} from '../config/profile-trust.js'
import {isJobFresh} from '../config/job-lifecycle.js'
import ActivityCenter from './account/ActivityCenter'
import MobileBottomNav from './components/MobileBottomNav'
import CategoryChip from './components/CategoryChip'
import React,{useEffect,useState,useMemo,useRef,lazy,Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import {HeartPulse,Plus,Search,MapPin,Bookmark,Users,BriefcaseBusiness,SlidersHorizontal,ChevronDown,House,LogOut,ShieldCheck,X,ArrowUpLeft,Send,UserRound,Menu} from 'lucide-react'
import {supabase} from './supabase'
import {startJobFeed} from './job-realtime.js'
import {belongsToFeed} from '../config/job-feeds.js'
import {roles,cities,ar,number,canonicalRole,canonicalCity,installCatalog} from './i18n'
import {isVerifiedProfessional,isSuperAdmin,authError} from './auth'
import Modal from './components/Modal'
import JobCard from './components/JobCard'
import {scoreSpecialtyFit,isSpecialtyRecommendation} from './matching_engine.ts'
import useMatchingProfile from './matching/useMatchingProfile'
import MatchingProfilePanel from './matching/MatchingProfilePanel'
import AccountMenu from './account/AccountMenu'
import useTrustSync from './useTrustSync'
import DeferredTraining from './components/DeferredTraining'
import AsyncContent from './components/AsyncContent'
import JobGridSkeleton from './components/JobGridSkeleton'
import './matching/matching.css'
import useJobTrust,{listingVerification} from './useJobTrust'
import {VerificationStatus} from './components/VerifiedBadge'
import CredentialBadges from './components/CredentialBadges'
import CareerHero from './components/CareerHero'
import {ProjectaPaths,ProjectaConnect} from './components/LandingSections'
import MobileDrawer from './components/MobileDrawer'
import InformationModal from './components/InformationModal'
import TelegramSyncStatus from './components/TelegramSyncStatus'
import {specialtyClass,jobSearchText,matchesSearch} from './job-ui.js'
import ProjectaLogo from './components/ProjectaLogo'
import JobPreview from './components/JobPreview'
import './style.css'
import './premium.css'
import './reference.css'
import './polish.css'
import './performance.css'
import './design-tokens.css'
import './ui-polish.css'
import './feed-enhancements.css'

const PostJobForm=lazy(()=>import('./components/PostJobForm'))
const AuthPanel=lazy(()=>import('./components/AuthPanel'))
const AccountProfile=lazy(()=>import('./account/AccountProfile'))
const AccountCv=lazy(()=>import('./account/AccountCv'))
const AccountApplications=lazy(()=>import('./account/AccountApplications'))
const AccountInterviews=lazy(()=>import('./account/AccountInterviews'))
const AccountSupport=lazy(()=>import('./account/AccountSupport'))
const ProjectaFeatures=lazy(()=>import('./components/InformationContent').then(module=>({default:module.ProjectaFeatures})))
const ProjectaAbout=lazy(()=>import('./components/InformationContent').then(module=>({default:module.ProjectaAbout})))
const RecoveryForm=lazy(()=>import('./components/RecoveryForm'))
const ApplicationForm=lazy(()=>import('./components/ApplicationForm'))
const AdminApp=lazy(()=>import('./admin/AdminApp'))
const TalentDirectory=lazy(()=>import('./talent/TalentDirectory'))
const TrainingHub=lazy(()=>import('./training/TrainingHub'))

const samples=[
 {id:'c1',type:'candidates',title:'طبيبة أسنان عامة',company:'د. نور أحمد',city:'Baghdad',role:'Dentists',salary:'١٬٥٠٠٬٠٠٠ د.ع. — الراتب المتوقع',schedule:'Full-time',description:'خبرة ثلاث سنوات في طب الأسنان الترميمي والوقائي. أبحث عن فريق طبي يتيح التطور المهني وتقديم رعاية متميزة.',logo:'ن',color:'pink',time:'نموذج توضيحي',sample:true},
 {id:'c2',type:'candidates',title:'مساعدة طبيب أسنان',company:'سارة علي',city:'Erbil',role:'Assistants & Techs',salary:'٧٠٠٬٠٠٠ د.ع. — الراتب المتوقع',schedule:'Full-time',description:'خبرة في المساعدة السريرية والتعقيم ورعاية المرضى. متاحة للانضمام إلى فريق طبي في أربيل.',logo:'س',color:'mint',time:'نموذج توضيحي',sample:true},
 {id:'c3',type:'candidates',title:'مندوب طبي',company:'عمر حسن',city:'Basra',role:'Medical Reps',salary:'١٬٢٠٠٬٠٠٠ د.ع. — الراتب المتوقع',schedule:'Full-time',description:'خبرة سنتين في التواصل مع المؤسسات الصحية وتطوير العلاقات المهنية في جنوب العراق.',logo:'ع',color:'peach',time:'نموذج توضيحي',sample:true},
]
function stored(key){try{const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:[]}catch{return []}}
function App(){
 const [tab,setTab]=useState('jobs'),[role,setRole]=useState('All roles'),[city,setCity]=useState('All cities'),[query,setQuery]=useState(''),[schedule,setSchedule]=useState('Any schedule'),[sort,setSort]=useState('newest'),[showFilters,setShowFilters]=useState(false),[onlySaved,setOnlySaved]=useState(false)
 const accountTrigger=useRef(null)
 function openAccount(trigger){accountTrigger.current=trigger||(document.activeElement?.closest('.mobile-drawer')?document.querySelector('.menu-toggle'):document.activeElement);setMenuOpen(false);setModal(user?'account':'auth')}
 function accountAction(option){if(option==='saved'){setModal(null);openSaved()}else if(option==='training')window.location.assign('/training');else setModal(option)}
 const informationTrigger=useRef(null)
 function openInformation(section,trigger){informationTrigger.current=trigger||document.querySelector('.menu-toggle');setMenuOpen(false);setModal(section)}
 useEffect(()=>{const openHash=()=>{const section=({'#features':'features','#projecta-about':'about','#our-message':'about'})[window.location.hash];if(section)openInformation(section)};openHash();window.addEventListener('hashchange',openHash);return()=>window.removeEventListener('hashchange',openHash)},[])
 const [menuOpen,setMenuOpen]=useState(false),[feedConnection,setFeedConnection]=useState('reconnecting')
 const [applicationBusy,setApplicationBusy]=useState(false)
 const [scrolled,setScrolled]=useState(()=>window.scrollY>24)
 useEffect(()=>{const update=()=>setScrolled(window.scrollY>24);window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update)},[])
 const [platform,setPlatform]=useState(null)
 useEffect(()=>{let alive=true;async function refresh(){try{const r=await fetch('/api/platform');if(!r.ok)return;const value=await r.json();if(alive){installCatalog(value.catalog);setPlatform(current=>JSON.stringify(current)===JSON.stringify(value)?current:value)}}catch{}}refresh();const timer=setInterval(refresh,30000);return()=>{alive=false;clearInterval(timer)}},[])
 const [saved,setSaved]=useState(()=>stored('projecta-saved')),[local,setLocal]=useState(()=>stored('projecta-listings')),[live,setLive]=useState([]),[feedStatuses,setFeedStatuses]=useState({jobs:'loading',telegram:'loading'}),[feedVersion,setFeedVersion]=useState(0),[user,setUser]=useState(null),[authLoading,setAuthLoading]=useState(true),[authFeedback,setAuthFeedback]=useState(''),[modal,setModal]=useState(null),[selectedJob,setSelectedJob]=useState(null),[message,setMessage]=useState(''),[postType,setPostType]=useState('jobs'),[posting,setPosting]=useState(false),[postError,setPostError]=useState(''),[visibleCount,setVisibleCount]=useState(24)
 useEffect(()=>{const url=new URL(window.location.href);const hash=new URLSearchParams(url.hash.slice(1));const error=url.searchParams.get('error')||hash.get('error');if(error){setAuthFeedback(authError({code:error},'google'));setModal('auth');for(const key of ['error','error_code','error_description']){url.searchParams.delete(key);hash.delete(key)}url.hash=hash.toString();window.history.replaceState({},'',url.pathname+url.search+url.hash)}},[])
 useEffect(()=>startJobFeed({
  client:supabase,
  onSnapshot:setLive,
  onUpsert:job=>setLive(current=>[job,...current.filter(item=>item.id!==job.id)]),
  onRemove:id=>setLive(current=>current.filter(item=>item.id!==id)),
  onLoad:status=>setFeedStatuses({jobs:status,telegram:status}),
  onConnection:setFeedConnection,
 }),[feedVersion])
 useEffect(()=>{if(!supabase){setAuthLoading(false);return}let alive=true;supabase.auth.getUser().then(({data})=>{if(alive){setUser(data?.user||null);setAuthLoading(false)}}).catch(()=>{if(alive)setAuthLoading(false)});const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(alive){if(event==='PASSWORD_RECOVERY')setModal('recovery');setUser(session?.user||null);setAuthLoading(false)}});return()=>{alive=false;data.subscription.unsubscribe()}},[])
 useEffect(()=>{setVisibleCount(24)},[tab,role,city,query,schedule,sort,onlySaved])
 useEffect(()=>{localStorage.setItem('projecta-saved',JSON.stringify(saved))},[saved])
 useEffect(()=>{localStorage.setItem('projecta-listings',JSON.stringify(local))},[local])
 useEffect(()=>{if(!authLoading&&window.location.pathname==='/post-job')openPost()},[authLoading,user])
 function openPost(){setPostError('');if(authLoading){setMessage('جارٍ التحقق من جلسة الدخول…');return}setModal(!user?'auth':!isVerifiedProfessional(user)?'eligibility':'post')}
 function selectTab(next){if(next!=='telegram'){if(role==='Unsorted')setRole('All roles');if(city==='City not specified')setCity('All cities');if(schedule==='Schedule not specified')setSchedule('Any schedule')}setTab(next)}
 function browseFeed(next,specialty){selectTab(next);if(specialty)setRole(specialty);setOnlySaved(false);requestAnimationFrame(()=>{document.getElementById('job-board')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});document.getElementById('results-heading')?.focus({preventScroll:true})})}
 function openSaved(){reset();browseFeed(tab==='candidates'?'jobs':tab);setOnlySaved(true)}
 function reset(){setVerifiedOnly(false);matching.setFiltering(false);setRole('All roles');setCity('All cities');setQuery('');setSchedule('Any schedule');setOnlySaved(false)}
 async function signOut(){const {error}=await supabase.auth.signOut();if(error){setMessage('تعذر تسجيل الخروج. حاول مجدداً.');return false}setUser(null);setModal(null);setMessage('تم تسجيل الخروج بأمان.');return true}
 async function post(e){
  e.preventDefault();if(!user||!isVerifiedProfessional(user)){openPost();return}setPosting(true);setPostError('');const form=Object.fromEntries(new FormData(e.currentTarget))
  try{
   const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('انتهت الجلسة. يرجى تسجيل الدخول مجدداً.')
   if(postType==='candidates'){
    setLocal(v=>[{...form,id:crypto.randomUUID(),type:'candidates',logo:form.company.slice(0,1),color:'mint',time:'الآن',createdAt:new Date().toISOString()},...v]);selectTab('candidates');setMessage('تم حفظ ملفك على هذا الجهاز. لم يُنشر على المنصة.')
   }else{
    const response=await fetch('/api/publish-job',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(form)})
    const body=await response.json();if(!response.ok)throw Error(body.error||'تعذر نشر الإعلان.')
    setFeedVersion(v=>v+1);selectTab('jobs');setMessage('تم نشر فرصة العمل بنجاح. قد يستغرق ظهورها بضع ثوانٍ.')
   }
   reset();setModal(null)
  }catch(error){setPostError(error.message?.match(/[\u0600-\u06ff]/)?error.message:'تعذر إتمام النشر. يرجى التحقق من الاتصال والمحاولة مجدداً.')}finally{setPosting(false)}
 }
 const feedStatus=onlySaved?(Object.values(feedStatuses).includes('loading')?'loading':Object.values(feedStatuses).includes('error')?'error':'ready'):feedStatuses[tab]||'ready',feedRoles=tab==='telegram'?[...roles,'Unsorted']:roles,feedCities=tab==='telegram'?[...cities,'City not specified']:cities,feedSchedules=tab==='telegram'?['Any schedule','Full-time','Part-time','Contract','Internship','Schedule not specified']:['Any schedule','Full-time','Part-time','Contract']
 const selectedFeedJobs=live.filter(j=>belongsToFeed(j,tab))
 const salaryValue=j=>Number(String(j.salary).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).match(/[\d,٬]+/)?.[0].replace(/[,٬]/g,'')||0)
 const matching=useMatchingProfile(user,authLoading)
 useTrustSync(()=>window.dispatchEvent(new Event('projecta-account-refresh')))
 useEffect(()=>{if(!user)return;let active=true,busy=false;const refresh=async()=>{if(busy||document.visibilityState==='hidden')return;busy=true;try{const {data,error}=await supabase.auth.getUser();if(active&&!error&&data?.user)setUser(data.user)}catch{}finally{busy=false}};const timer=setInterval(refresh,30000);window.addEventListener('projecta-account-refresh',refresh);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('projecta-account-refresh',refresh);window.removeEventListener('focus',refresh)}},[user?.id])
 const indexJob=useMemo(()=>{const cache=new WeakMap();return job=>{let indexed=cache.get(job);if(!indexed){indexed={...job,role:canonicalRole(job.role),city:canonicalCity(job.city),searchText:jobSearchText(job)};cache.set(job,indexed)}return indexed}},[platform])
 const [verifiedOnly,setVerifiedOnly]=useState(false),[freshnessNow,setFreshnessNow]=useState(Date.now)
 const [mobileFilters,setMobileFilters]=useState(()=>window.matchMedia('(max-width:767px)').matches)
 useEffect(()=>{
  const media=window.matchMedia('(max-width:767px)')
  const update=()=>{setMobileFilters(media.matches);setShowFilters(false)}
  media.addEventListener('change',update)
  return()=>media.removeEventListener('change',update)
 },[])

 const {items:publishedTalent,error:talentError}=usePublishedDirectory('talent')
 const candidates=useMemo(()=>publishedTalent.map(profile=>({...profile,type:'candidates',live:true,company:profile.name,title:profile.headline||ar(profile.role),description:profile.bio,roles:[profile.role],createdAt:profile.updatedAt,schedule:profile.workTypes.join(' · '),salary:'',telegram:null,whatsapp:profile.whatsappEnabled?profile.phone:null})),[publishedTalent])
 const indexedJobs=useMemo(()=>[...candidates,...local.map(job=>({...job,live:false,source:'local',verification:undefined})),...live,...samples].map(indexJob).filter(job=>job.type==='candidates'||isJobFresh(job,freshnessNow)),[candidates,local,live,indexJob,freshnessNow])
 const jobTrust=useJobTrust(indexedJobs)
 const verifyingCredentials=verifiedOnly&&indexedJobs.some(job=>listingVerification(job,jobTrust).status==='checking')
 useEffect(()=>{const timer=setInterval(()=>setFreshnessNow(Date.now()),60000);return()=>clearInterval(timer)},[])
 useEffect(()=>setVisibleCount(24),[verifiedOnly])
 useEffect(()=>setVisibleCount(24),[matching.profile,matching.filtering])
 const fits=useMemo(()=>new Map(matching.profile?indexedJobs.filter(job=>job.type==='jobs').map(job=>[job.id,scoreSpecialtyFit(matching.profile,job)]):[]),[indexedJobs,matching.profile])
 const filteredJobs=useMemo(()=>indexedJobs.filter(j=>(!verifiedOnly||hasVerifiedCredentials(listingVerification(j,jobTrust)))&&(role==='All roles'||j.role===role||j.roles?.includes(role))&&(city==='All cities'||j.city===city||j.governorates?.includes(city))&&(schedule==='Any schedule'||j.schedule===schedule)&&(!onlySaved||saved.includes(j.id))&&matchesSearch(j.searchText,query)&&(!matching.filtering||j.type!=='jobs'||isSpecialtyRecommendation(matching.profile,j,fits.get(j.id)))),[indexedJobs,verifiedOnly,jobTrust,role,city,schedule,onlySaved,saved,query,matching.filtering,matching.profile,fits])
 const categoryCounts=useMemo(()=>{
  const counts=new Map(feedRoles.map(value=>[value,0]))
  for(const job of indexedJobs){
   if(verifiedOnly&&!hasVerifiedCredentials(listingVerification(job,jobTrust))||!belongsToFeed(job,tab)||city!=='All cities'&&job.city!==city&&!job.governorates?.includes(city)||schedule!=='Any schedule'&&job.schedule!==schedule||onlySaved&&!saved.includes(job.id)||!matchesSearch(job.searchText,query)||matching.filtering&&job.type==='jobs'&&!isSpecialtyRecommendation(matching.profile,job,fits.get(job.id)))continue
   counts.set('All roles',(counts.get('All roles')||0)+1)
   for(const category of new Set([job.role,...(job.roles||[])]))if(counts.has(category))counts.set(category,counts.get(category)+1)
  }
  return counts
 },[indexedJobs,verifiedOnly,jobTrust,tab,city,schedule,onlySaved,saved,query,matching.filtering,matching.profile,fits,platform])
 const feedMatches=next=>number(filteredJobs.filter(j=>belongsToFeed(j,next)).length)
 const listings=filteredJobs.filter(j=>onlySaved||belongsToFeed(j,tab)).sort((a,b)=>sort==='match'&&matching.profile&&tab!=='candidates'?((fits.get(b.id)?.score??-1)-(fits.get(a.id)?.score??-1))||(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0):sort==='title'?a.title.localeCompare(b.title,'ar'):sort==='salary'?salaryValue(b)-salaryValue(a):Number(Boolean(b.featured))-Number(Boolean(a.featured))||(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0))

 const activeFilterCount=[role!=='All roles',city!=='All cities',schedule!=='Any schedule',onlySaved,verifiedOnly,matching.filtering,Boolean(query.trim())].filter(Boolean).length
 const filterControls=(<div className="filter-panel"><fieldset><legend>التخصص الطبي <ChevronDown size={14}/></legend>{feedRoles.map(v=><CategoryChip key={v} value={v} selected={role===v} count={categoryCounts.get(v)||0} onChange={()=>setRole(v)}/>)}</fieldset><fieldset><legend>نوع الدوام <ChevronDown size={14}/></legend>{feedSchedules.map(v=><label className="filter-option" key={v}><input type="radio" name="schedule-filter" checked={schedule===v} onChange={()=>setSchedule(v)}/><span>{ar(v)}</span></label>)}</fieldset><fieldset><legend>الموقع <MapPin size={14}/></legend><select aria-label="المحافظة في قائمة التصفية" value={city} onChange={e=>setCity(e.target.value)}>{feedCities.map(v=><option key={v} value={v}>{ar(v)}</option>)}</select></fieldset><fieldset><legend>تفضيلاتك <Bookmark size={14}/></legend><label className="filter-option"><input type="checkbox" checked={onlySaved} onChange={e=>setOnlySaved(e.target.checked)}/><span>المحفوظة فقط</span><span className="count">{number(saved.length)}</span></label></fieldset></div>)
 if(platform?.settings?.maintenance&&!isSuperAdmin(user))return <div className="maintenance-page"><a href="/" className="brand"><ProjectaLogo/></a><h1>نعتني بتجربتك المهنية</h1><p>المنصة قيد الصيانة حالياً. نعود إليك قريباً.</p><a href="/admin">دخول الإدارة</a></div>
 return <>
 {platform?.settings?.banner_enabled&&platform.settings.banner_text&&<div className="platform-banner" role="status">{platform.settings.banner_text}</div>}
 <a className="skip-link" href="#job-board">انتقل إلى فرص العمل</a>
 <header className={`header reference-header ${scrolled?'is-scrolled':''}`}><a className="brand" href="/" aria-label="Proȷecta — الصفحة الرئيسية"><ProjectaLogo/></a><nav className="desktop-nav" aria-label="التنقل الرئيسي"><a href="/talent">دليل الكفاءات</a><a href="/training">التدريب</a><a href="#features" aria-haspopup="dialog" onClick={e=>{e.preventDefault();openInformation('features',e.currentTarget)}}>المزايا</a><a href="#projecta-about" aria-haspopup="dialog" onClick={e=>{e.preventDefault();openInformation('about',e.currentTarget)}}>عن بروجكتا</a><a href="#connect">تواصل معنا</a></nav><div className="header-actions">{isSuperAdmin(user)&&<a className="admin-entry" href="/admin" aria-label="لوحة الإدارة" title="لوحة الإدارة"><ShieldCheck size={15}/> الإدارة</a>}{user&&<button className="login" aria-label="حسابي" title="حسابي" aria-haspopup="dialog" aria-expanded={modal==='account'} onClick={event=>openAccount(event.currentTarget)}>حسابي <UserRound size={16}/></button>}<button className="primary small" onClick={openPost}>{user?'نشر فرصة عمل':'ابدأ الآن'}</button></div><button className="menu-toggle" aria-label="فتح قائمة التنقل" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={()=>setMenuOpen(true)}><Menu size={24}/></button></header>
 <MobileDrawer onInformation={openInformation} open={menuOpen} onClose={()=>setMenuOpen(false)} onAccount={()=>openAccount()} onPost={openPost} onSaved={()=>{reset();setOnlySaved(true);requestAnimationFrame(()=>document.getElementById('job-board')?.scrollIntoView())}} isAdmin={isSuperAdmin(user)}/>
 <main className="marketplace reference-page"><CareerHero onBrowse={browseFeed}/><section className="reference-board" id="opportunities" aria-label="لوحة فرص العمل"><div className="board-intro"><h2>ابحث عن المكان الذي يناسبك.</h2></div><form className="search-bar" onSubmit={e=>{e.preventDefault();document.getElementById('results-heading')?.scrollIntoView({block:'start'})}}><label className="search-field"><Search size={18}/><input type="search" aria-describedby="search-help" aria-controls="job-results" aria-label="البحث في الإعلانات" placeholder="المسمّى الوظيفي أو المؤسسة أو كلمة مفتاحية" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="search-field city-field"><MapPin size={18}/><select aria-label="تصفية حسب المحافظة" value={city} onChange={e=>setCity(e.target.value)}>{feedCities.map(v=><option key={v} value={v}>{ar(v)}</option>)}</select></label><button className="primary search-submit"><Search size={16}/> بحث</button></form><p className="search-help" id="search-help">تظهر النتائج فور الكتابة في وظائف المنصة ووظائف التليجرام. بدّل بين القسمين لاستعراض المطابقات.</p>
 <div className="listing-tabs" id="job-board"><div className="tabs" role="tablist" aria-label="نوع الإعلانات"><button role="tab" aria-selected={tab==='jobs'} className={tab==='jobs'?'selected':''} onClick={()=>selectTab('jobs')}><BriefcaseBusiness size={17}/> وظائف المنصة{query.trim()&&<span className="count">{feedMatches('jobs')}</span>}</button><button role="tab" aria-selected={tab==='telegram'} className={tab==='telegram'?'selected':''} onClick={()=>selectTab('telegram')}><Send size={17}/> وظائف التليجرام{query.trim()&&<span className="count">{feedMatches('telegram')}</span>}</button><button role="tab" aria-selected={tab==='candidates'} className={tab==='candidates'?'selected':''} onClick={()=>selectTab('candidates')}><Users size={17}/> الباحثون عن عمل</button></div><span className="verified-note"><ShieldCheck size={15}/> نربط الكفاءات بالفرص في القطاع الصحي العراقي</span></div>
 {tab==='telegram'&&<div className="feed-source-info"><p>منشورات من المجتمع الطبي؛ تحقّق من التفاصيل مع جهة الإعلان.</p><TelegramSyncStatus compact/></div>}
 <div className="board-layout">{!mobileFilters&&<aside className="filter-sidebar" aria-label="تصفية الإعلانات"><div className="filter-heading"><h2>التصفية</h2><button onClick={reset} disabled={!activeFilterCount}>مسح الكل</button></div>{filterControls}</aside>}
 <section className="results" aria-label="إعلانات القطاع الصحي"><div className="results-heading"><div><h2 id="results-heading" tabIndex={-1}>{onlySaved?'إعلاناتك المحفوظة':role!=='All roles'?ar(role):tab==='jobs'?'وظائف المنصة':tab==='telegram'?'وظائف التليجرام':'تعرّف إلى كفاءاتنا'} <span role="status" aria-live="polite" aria-atomic="true">{number(listings.length)} {tab==='candidates'?'ملفاً مهنياً':'إعلاناً'}</span></h2></div><label className="sort-control"><span className="sr-only">ترتيب الإعلانات</span><select value={sort} onChange={e=>setSort(e.target.value)}>{matching.profile&&<option value="match">الأكثر توافقاً مع ملفي</option>}<option value="newest">الأحدث أولاً</option><option value="title">المسمّى الوظيفي</option><option value="salary">الأعلى راتباً</option></select></label><button className="filter-button" aria-label="إظهار خيارات التصفية" aria-expanded={showFilters} aria-haspopup="dialog" onClick={()=>setShowFilters(true)}><SlidersHorizontal size={18} aria-hidden="true"/><span className="filter-button-label">التصفية</span>{activeFilterCount>0&&<span className="filter-active-count">{number(activeFilterCount)}</span>}</button></div><div className="feed-quick-filters"><VerifiedFilter checked={verifiedOnly} onChange={setVerifiedOnly}/>{activeFilterCount>0&&<button className="feed-reset" onClick={reset}>مسح التصفية</button>}</div>
 {tab!=='candidates'&&<div className="feed-toolbar"><p className={`feed-connection ${feedConnection}`} role="status">{feedConnection==='live'?'● مباشر':'◌ تحديث تلقائي'}</p><div className="feed-status feed-status-compact" role="status"><span className={feedStatus==='ready'?'sr-only':''}>{feedStatus==='loading'?'جارٍ تحميل الفرص…':feedStatus==='error'?'تعذر تحميل الفرص. أعد المحاولة.':'تم تحميل الفرص.'}</span>{feedStatus!=='loading'&&<button onClick={()=>setFeedVersion(v=>v+1)} aria-label="تحديث فرص العمل">{feedStatus==='error'?'إعادة المحاولة':'تحديث'}</button>}</div></div>}{message&&<div className="notice" role="status">{message}<button aria-label="إغلاق التنبيه" onClick={()=>setMessage('')}><X size={16}/></button></div>}
 {tab==='candidates'&&talentError&&<p role="status" className="notice">{talentError}</p>}{tab!=='candidates'&&<MatchingProfilePanel profile={matching.profile} draftProfile={matching.draftProfile} filtering={matching.filtering} onFilteringChange={value=>{matching.setFiltering(value);if(value)setSort('match')}} onSave={value=>{matching.save(value);setRole('All roles');setCity('All cities');setSchedule('Any schedule');setSort('match');setVisibleCount(24)}} onDisable={()=>{matching.disable();if(sort==='match')setSort('newest')}}/>}<div className="job-grid" id="job-results" aria-busy={feedStatus==='loading'||verifyingCredentials}>{verifyingCredentials&&<p role="status">جارٍ التحقق من المؤهلات المعتمدة…</p>}{!listings.length&&tab!=='candidates'&&feedStatus==='loading'&&<JobGridSkeleton/>}{listings.slice(0,visibleCount).map(j=><JobCard key={j.id} job={j} fit={fits.get(j.id)||null} verification={listingVerification(j,jobTrust)} saved={saved.includes(j.id)} onApply={()=>{setSelectedJob(j);if(!user){setMessage('سجّل الدخول لإرسال طلب التوظيف.');setModal('auth')}else setModal('application')}} onSave={()=>setSaved(v=>v.includes(j.id)?v.filter(x=>x!==j.id):[...v,j.id])} onRead={()=>{setSelectedJob(j);setModal('details')}}/>)}{!listings.length&&!verifyingCredentials&&(tab==='candidates'||feedStatus!=='loading')&&<div className="empty-state"><div className="empty-state-icon" aria-hidden="true">{onlySaved?<Bookmark size={32}/>:<Search size={32}/>}</div><h3>{onlySaved?(saved.length?'لا توجد محفوظات تطابق بحثك':'فرصك المفضلة تبدأ من هنا'):query||verifiedOnly||matching.filtering||role!=='All roles'||city!=='All cities'||schedule!=='Any schedule'?'لم نعثر على نتائج مطابقة':tab==='jobs'?'لا توجد فرص مباشرة منشورة حالياً':'لا توجد إعلانات حالياً'}</h3><p>{onlySaved?(saved.length?'جرّب مسح عوامل التصفية لرؤية إعلاناتك المحفوظة.':'اضغط على علامة الحفظ في أي إعلان لتجده هنا لاحقاً، على هذا الجهاز.'):matching.filtering?'لا توجد فرص توافق ملفك وعوامل التصفية الحالية. عدّل معاييرك أو امسح التصفية لعرض كل الفرص.':query?'جرّب كلمة أقصر أو محافظة أخرى. يمكنك أيضاً مسح عوامل التصفية والبدء من جديد.':tab==='jobs'?'تظهر فرص العيادات والمستخدمين هنا. يمكنك الآن استكشاف المنشورات المستوردة في وظائف التليجرام.':'تتجدد الفرص باستمرار. جرّب توسيع نطاق البحث أو العودة لاحقاً.'}</p><button className="primary" onClick={reset}>{onlySaved&&!saved.length?'استكشف جميع الفرص':'مسح عوامل التصفية'}</button>{tab==='jobs'&&!onlySaved&&<button className="telegram-switch" onClick={()=>{reset();selectTab('telegram')}}><Send size={16}/> استعراض وظائف التليجرام</button>}</div>}</div>{visibleCount<listings.length&&<button className="load-more" onClick={()=>setVisibleCount(v=>v+24)}>عرض المزيد من الإعلانات</button>}</section></div></section><ProjectaPaths onBrowse={browseFeed} onPost={openPost} onAccount={()=>openAccount()}/><DeferredTraining/><ProjectaConnect onAccount={()=>openAccount()} onSaved={openSaved} onBrowse={browseFeed}/></main>
 <footer><a className="brand" href="/" aria-label="Proȷecta — الصفحة الرئيسية"><ProjectaLogo/></a><nav className="footer-links" aria-label="روابط بروجكتا"><a href="#projecta-about" aria-haspopup="dialog" onClick={e=>{e.preventDefault();openInformation('about',e.currentTarget)}}>عن بروجكتا</a><a href="#our-message" aria-haspopup="dialog" onClick={e=>{e.preventDefault();openInformation('about',e.currentTarget)}}>رسالتنا</a><a href="#connect">تواصل معنا</a></nav><span>© {number(new Date().getFullYear())} Projecta · جميع الحقوق محفوظة</span><a href="https://dental-profile-hub-nea2.vercel.app/" target="_blank" rel="noopener noreferrer">منصة إدارة العيادات <ArrowUpLeft size={14}/></a></footer><MobileBottomNav tab={tab} onlySaved={onlySaved} modal={modal} onBrowse={browseFeed} onPost={openPost} onActivity={()=>setModal('activity')}/>
 {mobileFilters&&showFilters&&<Modal title="تصفية الفرص" className="filter-sheet" onClose={()=>setShowFilters(false)}><p className="filter-sheet-help">اختر ما يناسبك؛ يتحدث عدد النتائج فوراً.</p><div className="filter-sheet-body">{filterControls}</div><div className="filter-sheet-actions"><button className="filter-clear" disabled={!activeFilterCount} onClick={reset}>مسح الكل</button><button className="primary" onClick={()=>{setShowFilters(false);requestAnimationFrame(()=>document.getElementById('results-heading')?.focus({preventScroll:true}))}}>تطبيق · عرض {number(listings.length)} نتيجة</button></div></Modal>}
 {modal==='account'&&user&&<AccountMenu user={user} returnFocus={accountTrigger.current} onClose={()=>setModal(null)} onSelect={accountAction} onSignOut={async()=>{if(!await signOut())throw Error('تعذر تسجيل الخروج. حاول مجدداً.')}}/>}
 {modal==='profile'&&user&&<Modal title="ملفك الشخصي والتوثيق" onClose={()=>setModal(null)}><AsyncContent><AccountProfile key={user.id} user={user} onUserUpdate={setUser}/></AsyncContent></Modal>}
 {modal==='cv'&&user&&<Modal title="إنشاء سيرة ذاتية / رفع" onClose={()=>setModal(null)}><AsyncContent><AccountCv key={user.id} user={user} onUserUpdate={setUser}/></AsyncContent></Modal>}
 {modal==='activity'&&<Modal className="activity-sheet" title="طلباتي ونشاطي" onClose={()=>setModal(null)}><ActivityCenter signedIn={Boolean(user)} onSelect={setModal} onSignIn={()=>setModal('auth')}/></Modal>}
 {(modal==='applications'||modal==='posted')&&user&&<Modal className="application-management-modal" title={modal==='posted'?'الوظائف المعلنة والطلبات':'طلباتي المقدمة'} onClose={()=>setModal(null)}><AsyncContent><AccountApplications publisher={modal==='posted'} onExplore={()=>{setModal(null);browseFeed('jobs')}}/></AsyncContent></Modal>}
 {modal==='interviews'&&user&&<Modal title="مقابلاتي وطلبات التوظيف" onClose={()=>setModal(null)}><AsyncContent><AccountInterviews onExplore={()=>{setModal(null);browseFeed('jobs')}}/></AsyncContent></Modal>}
 {modal==='support'&&<Modal title="الدعم والمساعدة" onClose={()=>setModal(null)}><AsyncContent><AccountSupport onContact={()=>{setModal(null);requestAnimationFrame(()=>document.getElementById('connect')?.scrollIntoView({behavior:'smooth'}))}}/></AsyncContent></Modal>}
 {(modal==='features'||modal==='about')&&<InformationModal key={modal} title={modal==='features'?'مزايا بروجكتا':'عن بروجكتا'} onClose={()=>setModal(null)} returnFocus={informationTrigger.current}><AsyncContent>{modal==='features'?<ProjectaFeatures compact/>:<ProjectaAbout compact/>}</AsyncContent></InformationModal>}
 {modal==='recovery'&&user&&<Modal title="استعادة كلمة المرور" onClose={()=>setModal(null)}><AsyncContent><RecoveryForm onSuccess={()=>{setModal(null);setMessage('تم تحديث كلمة المرور بنجاح.')}}/></AsyncContent></Modal>}
 {modal==='application'&&selectedJob&&user&&<Modal title="طلب توظيف" onClose={()=>!applicationBusy&&setModal(null)}><AsyncContent><ApplicationForm job={selectedJob} user={user} onBusyChange={setApplicationBusy} onSuccess={()=>{setModal(null);setMessage('تم إرسال طلب التوظيف بنجاح.')}}/></AsyncContent></Modal>}
 {modal==='auth'&&<Modal title={user?'حسابك المهني':'مرحباً بك في بروجكتا'} onClose={()=>setModal(null)}><AsyncContent><AuthPanel initialMessage={authFeedback} user={user} onSuccess={next=>{setUser(next);setAuthFeedback('');setModal(null);setMessage('تم تأكيد حسابك وتسجيل الدخول بنجاح.')}} onSignOut={signOut}/></AsyncContent></Modal>}
 {modal==='eligibility'&&<Modal title="اعتماد الحساب المهني" onClose={()=>setModal(null)}><p className="modal-intro">نشر فرص العمل متاح للمهنيين الطبيين المعتمدين فقط. تم تسجيل دخولك، لكن حسابك يحتاج إلى اعتماد مهني من إدارة بروجكتا قبل النشر.</p><p className="local-note">لا يمنح اختيار تخصص أو تأكيد البريد صلاحية الاعتماد المهني تلقائياً.</p><button className="primary full" onClick={()=>setModal('profile')}>العودة إلى ملفي</button></Modal>}
 {modal==='post'&&user&&isVerifiedProfessional(user)&&<Modal title="إضافة فرصة مهنية" onClose={()=>!posting&&setModal(null)}><AsyncContent><PostJobForm postType={postType} setPostType={setPostType} posting={posting} postError={postError} onSubmit={post}/></AsyncContent></Modal>}
 {modal==='details'&&selectedJob&&<Modal title={selectedJob.type==='candidates'?'الملف المهني الكامل':selectedJob.raw?'منشور من المجتمع الطبي':'تفاصيل فرصة العمل'} onClose={()=>setModal(null)}>{selectedJob.source==='telegram'&&<p className="local-note">نُقل هذا المنشور من تليغرام ولم تُتحقق تفاصيله بعد. يرجى التأكد من المعلومات قبل التواصل.</p>}<div className="detail-trust"><VerificationStatus verification={listingVerification(selectedJob,jobTrust)} context={selectedJob.sample?'sample':!selectedJob.live?'local':selectedJob.source==='telegram'?'telegram':'profile'}/><CredentialBadges verification={listingVerification(selectedJob,jobTrust)}/></div><JobPreview job={selectedJob}/>{selectedJob.sourceUrl&&<a className="primary full" href={selectedJob.sourceUrl} target="_blank" rel="noopener noreferrer">فتح المنشور الأصلي في تليغرام <ArrowUpLeft size={16}/></a>}</Modal>}
 </>
}
const path=window.location.pathname.replace(/\/+$/,'')||'/'
createRoot(document.getElementById('root')).render(path==='/training'?<Suspense fallback={<p className="admin-loading" role="status">جارٍ تحميل التدريب والورش…</p>}><TrainingHub/></Suspense>:path==='/talent'?<Suspense fallback={<p className="admin-loading" role="status">جارٍ تحميل دليل الكفاءات…</p>}><TalentDirectory/></Suspense>:/^\/admin(?:\/|$)/.test(path)?<Suspense fallback={<p className="admin-loading" role="status">جارٍ تحميل لوحة الإدارة…</p>}><AdminApp/></Suspense>:<App/>)
