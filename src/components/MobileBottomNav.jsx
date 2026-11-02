import {useEffect,useState} from 'react'
import {House,Send,Plus,Users,ClipboardList} from 'lucide-react'
import './mobile-bottom-nav.css'

export default function MobileBottomNav({tab,onlySaved,modal,onBrowse,onPost,onActivity}){
 const feedIndex={jobs:0,telegram:1,candidates:3}[tab]??0
 const [active,setActive]=useState(onlySaved?4:feedIndex)
 useEffect(()=>{
  if(['activity','applications','posted'].includes(modal))setActive(4)
  else if(!modal)setActive(onlySaved?4:feedIndex)
 },[feedIndex,onlySaved,modal])
 const items=[
  {label:'المنصة',name:'الرئيسية',Icon:House,action:()=>onBrowse('jobs')},
  {label:'التليجرام',name:'وظائف التليجرام',Icon:Send,action:()=>onBrowse('telegram')},
  {name:'نشر فرصة عمل',Icon:Plus,action:onPost,className:'mobile-plus'},
  {label:'الكفاءات',name:'الباحثون عن عمل',Icon:Users,action:()=>onBrowse('candidates')},
  {label:'طلباتي ونشاطي',name:'طلباتي ونشاطي',Icon:ClipboardList,action:onActivity,className:'mobile-activity-action'},
 ]
 return <nav className="mobile-nav liquid-nav" dir="rtl" aria-label="التنقل عبر الهاتف" style={{'--active-index':active}}>
  <div className="liquid-nav-indicator" aria-hidden="true"><i/></div>
  {items.map(({label,name,Icon,action,className=''},index)=><button key={name} className={`${className} ${active===index?'active':''}`} aria-label={name} aria-current={active===index?'true':undefined} aria-haspopup={index===2||index===4?'dialog':undefined} onClick={()=>{setActive(index);action()}}><Icon size={index===2?28:22}/>{label&&<span>{label}</span>}</button>)}
 </nav>
}
