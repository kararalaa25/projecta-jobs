import {specialtyClass} from '../job-ui.js'
import {ar} from '../i18n.js'
export default function SpecialtyBadge({role}){
 return <span className={`role-badge specialty-badge ${specialtyClass(role)}`}>{role?ar(role):'التخصص غير محدد'}</span>
}
