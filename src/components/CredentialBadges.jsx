import {Award,Landmark,ShieldCheck,Building2} from 'lucide-react'
import {normalizeProfileTrust} from '../../config/profile-trust.js'

const badges = {
 syndicate_membership: {
  label: 'عضوية نقابية موثّقة',
  tooltip: 'راجعت إدارة المنصة هذا المؤهل: عضوية نقابية موثقة',
  Icon: Landmark,
  type: 'syndicate'
 },
 certified_specialist: {
  label: 'اختصاص موثّق',
  tooltip: 'راجعت إدارة المنصة هذا المؤهل: اختصاص طبي موثّق',
  Icon: Award,
  type: 'syndicate'
 },
 facility_license: {
  label: 'مركز طبي / عيادة مرخصة',
  tooltip: 'راجعت إدارة المنصة ترخيص هذه المنشأة: ترخيص وزارة الصحة / نقابة الأطباء',
  Icon: ShieldCheck,
  type: 'facility'
 }
}

export default function CredentialBadges({verification, subject = 'profile'}){
 const trust = normalizeProfileTrust(verification)
 const isFacility = subject === 'facility' || subject === 'publisher' || trust.kind === 'clinic' || trust.kind === 'medical_center'
 
 // If employer/facility is verified but doesn't have explicit credentials array, synthesize facility_license badge
 const credentials = [...trust.credentials]
 if (trust.status === 'verified' && isFacility && !credentials.includes('facility_license')) {
  credentials.push('facility_license')
 }

 if (!credentials.length) return null

 return (
  <div className="credential-badges" role="group" aria-label="المؤهلات والتراخيص المتحقق منها">
   {credentials.map(key => {
    const badge = badges[key] || {
     label: key === 'facility_license' ? 'مركز طبي / عيادة مرخصة' : 'مؤهل معتمد',
     tooltip: isFacility ? 'ترخيص منشأة صحية معتمد من الجهات المختصة' : 'مؤهل مهني معتمد',
     Icon: isFacility ? Building2 : ShieldCheck,
     type: isFacility ? 'facility' : 'syndicate'
    }
    const {label, tooltip, Icon, type} = badge
    const badgeClass = `credential-badge ${type === 'facility' ? 'facility-badge' : 'syndicate-badge'}`

    return (
     <span
      className={badgeClass}
      key={key}
      title={tooltip}
      aria-label={label}
     >
      <Icon size={13} aria-hidden="true"/>
      <span>{label}</span>
     </span>
    )
   })}
  </div>
 )
}
