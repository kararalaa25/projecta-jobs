import TrustTooltip from './TrustTooltip'
import {Award,Landmark,ShieldCheck} from 'lucide-react'
import {normalizeProfileTrust} from '../../config/profile-trust.js'
const badges={syndicate_membership:{label:'عضوية نقابية موثّقة',Icon:Landmark},certified_specialist:{label:'اختصاص موثّق',Icon:Award},facility_license:{label:'مركز طبي / عيادة مرخصة',Icon:ShieldCheck}}
function Credential({credential}){
 const {label,Icon}=badges[credential]
 const description=credential==='facility_license'?'راجعت إدارة المنصة مستند ترخيص المنشأة. الشارة تخص الترخيص ولا تضمن جميع تفاصيل الإعلان.':`راجعت إدارة المنصة هذا المؤهل: ${label}`
 return <TrustTooltip className={`credential-badge credential-${credential}`} label={label} description={description}><Icon size={15} aria-hidden="true"/>{label}</TrustTooltip>
}
export default function CredentialBadges({verification}){
 const {credentials}=normalizeProfileTrust(verification)
 if(!credentials.length)return null
 return <div className="credential-badges" role="group" aria-label="المؤهلات المتحقق منها">{credentials.map(key=><Credential key={key} credential={key}/>)}</div>
}
