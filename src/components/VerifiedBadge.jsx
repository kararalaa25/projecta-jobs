import {BadgeCheck,Clock3,Shield} from 'lucide-react'
import {normalizeProfileTrust} from '../../config/profile-trust.js'
const labels={professional:'حساب مهني معتمد',doctor:'طبيب موثّق',dentist:'طبيب أسنان موثّق',pharmacist:'صيدلي موثّق',nurse:'ملف تمريض موثّق',medical_rep:'مندوب طبي موثّق',clinic_operations:'ملف مهني موثّق',clinic:'عيادة موثّقة',medical_center:'مركز طبي موثّق'}
export default function VerifiedBadge({verification,compact=false,subject='profile'}){
 const trust=normalizeProfileTrust(verification)
 if(trust.status!=='verified')return null
 const label=subject==='publisher'?`حساب الناشر: ${labels[trust.kind]}`:labels[trust.kind]
 return <span className={`verified-badge ${compact?'is-compact':''}`} role="img" aria-label={label} title={`${label} · اعتمدت إدارة المنصة هذا الحساب؛ لا تشمل الشارة جميع تفاصيل الإعلان.`}><BadgeCheck size={compact?17:18} aria-hidden="true"/>{!compact&&<span aria-hidden="true">{label}</span>}</span>
}
export function VerificationStatus({verification,context='profile',compact=false}){
 const trust=normalizeProfileTrust(verification)
 if(trust.status==='verified'&&!['sample','local','telegram'].includes(context))return <VerifiedBadge verification={trust} compact={compact}/>
 const label=context==='sample'?'ملف توضيحي':context==='local'?'ملف محلي غير موثّق':context==='telegram'?'حساب الجهة غير متحقق منه':({checking:'جارٍ التحقق من الاعتماد…',pending:'الاعتماد قيد المراجعة',rejected:'لم يُعتمد الملف بعد',unavailable:'حالة الاعتماد غير متاحة',unverified:'غير موثّق بعد'})[trust.status]
 const Icon=['pending','checking'].includes(trust.status)?Clock3:Shield
 return <span className={`verification-status status-${trust.status}`} title={context==='telegram'?'نقل الإعلان من تليغرام لا يُعد اعتماداً مهنياً لجهة النشر.':label}><Icon size={13} aria-hidden="true"/>{label}</span>
}
