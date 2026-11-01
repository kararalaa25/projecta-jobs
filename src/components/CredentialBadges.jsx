import {Award,Landmark,ShieldCheck} from 'lucide-react'
import {normalizeProfileTrust} from '../../config/profile-trust.js'
const badges={syndicate_membership:{label:'عضوية نقابية موثّقة',Icon:Landmark},certified_specialist:{label:'اختصاص موثّق',Icon:Award},facility_license:{label:'ترخيص منشأة موثّق',Icon:ShieldCheck}}
export default function CredentialBadges({verification}){
 const {credentials}=normalizeProfileTrust(verification)
 if(!credentials.length)return null
 return <div className="credential-badges" role="group" aria-label="المؤهلات المتحقق منها">{credentials.map(key=>{const {label,Icon}=badges[key];return <span className="credential-badge" key={key} title={`راجعت إدارة المنصة هذا المؤهل: ${label}`}><Icon size={13} aria-hidden="true"/>{label}</span>})}</div>
}
