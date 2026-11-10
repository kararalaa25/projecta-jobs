import {Clock3,Eye,Sparkles,CheckCircle2,Archive,XCircle} from 'lucide-react'
import {applicationStatus,applicationStateClass} from './application-status.js'
const icons={submitted:Clock3,pending:Clock3,reviewing:Eye,viewed:Eye,shortlisted:Sparkles,accepted:CheckCircle2,archived:Archive,rejected:XCircle}
export default function ApplicationStatusBadge({status}){
 const key=Object.hasOwn(applicationStatus,status)?status:'submitted',label=applicationStatus[key],Icon=icons[key]
 return <span className={`application-state status-${key} ${applicationStateClass[key]}`} role="status" aria-label={`حالة الطلب: ${label}`}><Icon size={14} aria-hidden="true"/><span>{label}</span></span>
}
