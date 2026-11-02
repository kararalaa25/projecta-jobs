import {ClipboardList,BriefcaseBusiness} from 'lucide-react'
export default function ActivityCenter({signedIn,onSelect,onSignIn}){
 const choose=view=>signedIn?onSelect(view):onSignIn()
 return <section className="activity-center"><p>{signedIn?'تابع طلباتك، أو راجع المتقدمين إلى الوظائف التي نشرتها.':'سجّل الدخول لعرض طلباتك والوظائف التي نشرتها.'}</p><div className="activity-options"><button onClick={()=>choose('applications')}><ClipboardList size={28}/><span><strong>الوظائف التي قدمت عليها</strong><small>حالات الطلبات وآخر التحديثات</small></span></button><button onClick={()=>choose('posted')}><BriefcaseBusiness size={28}/><span><strong>الوظائف التي نشرتها والمتقدمون عليها</strong><small>إدارة المتقدمين ومراجعة السير الذاتية</small></span></button></div></section>
}
