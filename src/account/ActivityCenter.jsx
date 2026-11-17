import {ClipboardList,BriefcaseBusiness,LayoutGrid,Filter,Archive} from 'lucide-react'
import AccountApplications from './AccountApplications'
import {applicationStatus} from './application-status.js'

// The activity tab is a structured tracker: quick-filter pills, then the pipeline cards.
export default function ActivityCenter({signedIn,onSelect,onSignIn}){
 const choose=view=>signedIn?onSelect(view):onSignIn()
 return <section className="activity-center">
  <p className="activity-intro">{signedIn?'Follow your applications and the candidates on your postings in one place.':'Sign in to track your applications and the jobs you have posted.'}</p>
  {signedIn
   ?<div className="activity-tracker">
     <div className="activity-filters" role="tablist" aria-label="Filter applications">
      <button className="activity-filter active" data-filter="all" onClick={()=>onSelect('applications')}><LayoutGrid size={16}/> الكل</button>
      <button className="activity-filter" data-filter="reviewing" onClick={()=>onSelect('applications')}><Filter size={16}/> قيد المراجعة</button>
      <button className="activity-filter" data-filter="saved" onClick={()=>onSelect('saved')}><Archive size={16}/> المحفوظة</button>
     </div>
     <AccountApplications onExplore={()=>onSelect('jobs')} onSelect={onSelect}/>
    </div>
   :<div className="activity-options">
     <button onClick={()=>choose('applications')}><ClipboardList size={28}/><span><strong>الوظيفة التي قدمت عليها</strong><small> حالات Requests وآخر التحدّثات </small></span></button>
     <button onClick={()=>choose('posted')}><BriefcaseBusiness size={28}/><span><strong>الوظيفة التي نشرتها والمتقدمون عليها</strong><small>putation المتقدمين ومراجعة السير الذاتية</small></span></button>
    </div>}
 </section>
}
