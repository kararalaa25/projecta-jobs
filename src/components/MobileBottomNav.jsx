import {House,Send,Plus,Users,ClipboardList} from 'lucide-react'
import './mobile-bottom-nav.css'

// Controlled dock: the active tab lives in the layout, so the dock only reports intent.
export default function MobileBottomNav({activeIndex,onSelect}){
 const items=[
  {label:'المنصة',name:'الرئيسية',Icon:House},
  {label:'التليجرام',name:'وظائف التليجرام',Icon:Send},
  {label:'نشر فرصة',name:'نشر فرصة عمل',Icon:Plus,className:'mobile-plus'},
  {label:'الكفاءات',name:'الباحثون عن عمل',Icon:Users},
  {label:'طلباتي ونشاطي',name:'طلباتي ونشاطي',Icon:ClipboardList,className:'mobile-activity-action'},
 ]
 return <nav className="mobile-nav liquid-nav" dir="rtl" data-active={activeIndex} aria-label="التنقل عبر الهاتف" style={{'--active-index':activeIndex}}>
  <svg className="mobile-nav-surface" viewBox="0 0 400 88" preserveAspectRatio="none" aria-hidden="true"><path d="M24 0H148C166 0 164 36 200 36S234 0 252 0H376Q400 0 400 24V40Q400 88 352 88H48Q0 88 0 40V24Q0 0 24 0Z"/></svg>
  <div className="liquid-nav-indicator" aria-hidden="true"><i/></div>
  {items.map(({label,name,Icon,className=''},index)=><button key={name} className={`${className} ${activeIndex===index?'active':''}`} aria-label={name} aria-current={activeIndex===index?'true':undefined} aria-haspopup={index===2?'dialog':undefined} onClick={()=>onSelect(index)}>{index===2?<span className="mobile-post-orb"><Icon size={30}/></span>:<Icon size={22}/>}{label&&<span>{label}</span>}</button>)}
 </nav>
}
