import {CheckCircle2,CircleDot,Clock3,Sparkles,XCircle,Archive} from 'lucide-react'
import {applicationStatus,applicationStateClass} from './application-status.js'
import {exactDate} from '../dates.js'

const stageOrder=['submitted','reviewing','viewed','shortlisted','accepted','rejected','archived']
const stageMeta={
 submitted:{label:'Submitted',icon:Clock3},
 reviewing:{label:'Under review',icon:Clock3},
 viewed:{label:'Viewed / contacted',icon:Sparkles},
 shortlisted:{label:'Shortlisted',icon:Sparkles},
 accepted:{label:'Accepted',icon:CheckCircle2},
 rejected:{label:'Rejected',icon:XCircle},
 archived:{label:'Archived',icon:Archive},
}

export default function ApplicationTimeline({row,updatedAt}){
 const current=stageOrder.includes(row.status)?row.status:'submitted'
 const currentIndex=stageOrder.indexOf(current)
 const completed=stageOrder.slice(0,currentIndex+1).filter(s=>s!=='rejected'&&s!=='archived')
 const isTerminal=['rejected','archived'].includes(current)
 return <div className="app-timeline" dir="ltr" aria-label={`Pipeline for ${row.job?.title||'job'}`}>
  <ol className="app-timeline-steps">
   {stageOrder.map((stage,index)=>{
    const isDone=index<currentIndex&&!isTerminal
    const isCurrent=index===currentIndex
    const isFuture=index>currentIndex
    const Meta=stageMeta[stage]||{label:stage,icon:Clock3}
    const time=stage===current&&updatedAt?exactDate(updatedAt):null
    return <li key={stage} className={`app-step ${isDone?'is-done':''} ${isCurrent?'is-current':''} ${isFuture?'is-future':''} ${stage==='rejected'?'is-rejected':''} ${stage==='archived'?'is-archived':''}`}>
     <span className="app-step-icon" aria-hidden="true">{isDone?<CheckCircle2 size={16}/>:isCurrent?<Meta.icon size={16}/>:(stage==='rejected'?<XCircle size={14}/>:stage==='archived'?<Archive size={14}/>:<CircleDot size={14}/>)}</span>
     <span className="app-step-body">
      <b className="app-step-label">{applicationStatus[stage]||Meta.label}</b>
      {isCurrent&&time&&<time dateTime={updatedAt} className="app-step-time">{time}</time>}
     </span>
    </li>
   })}
  </ol>
  <p className="app-timeline-state">{applicationStatus[current]||'Under review'}</p>
 </div>
}