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
 return <nav className="mobile-nav liquid-nav" dir="rtl" data-active={activeIndex} aria-label="التنقل عبر الهاتف">
  {items.map(({label,name,Icon,className=''},index)=><button key={name} className={`${className} ${activeIndex===index?'active':''}`} aria-label={name} aria-current={activeIndex===index?'true':undefined} aria-haspopup={index===2?'dialog':undefined} onClick={()=>onSelect(index)}><Icon size={22} strokeWidth={1.75}/>{label&&<span>{label}</span>}</button>)}
 </nav>
}
