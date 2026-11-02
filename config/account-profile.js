import catalog from './iraq.json' with {type:'json'}
import {hasConfirmedIdentity} from './access.js'
import {normalizeIraqiPhone,telegramHandle} from '../src/contacts.js'
export const profileKinds=[['dentist','طبيب أسنان'],['pharmacist','صيدلي'],['doctor','طبيب عام'],['nurse','تمريض / دعم سريري'],['medical_rep','مندوب طبي'],['clinic_operations','إدارة عيادة'],['clinic','عيادة'],['medical_center','مركز طبي']]
export const kindRoles={dentist:'Dentists',pharmacist:'Pharmacists',doctor:'General Physicians',nurse:'Assistants & Techs',medical_rep:'Medical Reps',clinic_operations:'Receptionists / Admin'}
export const credentialKeys=['syndicate_membership','certified_specialist','facility_license']
export function credentialUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}}
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):''
export const requiresSyndicateDocument=profile=>!['clinic','medical_center'].includes(profile.profile_kind)&&(['dentist','pharmacist','doctor'].includes(profile.profile_kind)||['Dentists','Pharmacists','General Physicians'].includes(profile.profession))
export const validEvidenceId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function profileDraft(user){
 const meta=user?.user_metadata||{},role=meta.profession||user?.app_metadata?.professional_specialty||''
 return {full_name:clean(meta.full_name||meta.name,120),profession:role,profile_kind:meta.profile_kind||Object.keys(kindRoles).find(kind=>kindRoles[kind]===role)||'dentist',governorate:meta.governorate||meta.city||'',phone:clean(meta.phone||user?.phone,30),license_number:clean(meta.license_number,150),license_url:clean(meta.license_url,2000),license_asset_id:clean(meta.license_asset_id,36),telegram_username:telegramHandle(meta.telegram_username||meta.telegram)||''}
}
export function validProfileKind(profile){return profileKinds.some(([id])=>id===profile.profile_kind)&&(!profile.profession||!kindRoles[profile.profile_kind]||kindRoles[profile.profile_kind]===profile.profession)}
export function profileCompletion(user){
 const draft=profileDraft(user),core=requiresSyndicateDocument(draft),facility=['clinic','medical_center'].includes(draft.profile_kind),checks=[
 ['name','الاسم الكامل',Boolean(draft.full_name)],['identity','تأكيد البريد أو الهاتف',hasConfirmedIdentity(user)],
 ['specialty','التخصص ونوع الحساب',catalog.roles.some(role=>role.id===draft.profession)&&validProfileKind(draft)],
 ['governorate','المحافظة',catalog.governorates.some(city=>city.id===draft.governorate)],
 ['phone','رقم تواصل عراقي',Boolean(normalizeIraqiPhone(draft.phone))],...((core||facility)?[['license','رقم الترخيص المهني',Boolean(draft.license_number)],['evidence',core?'بطاقة النقابة المرفوعة':'مستند ترخيص المنشأة',core?validEvidenceId(draft.license_asset_id):validEvidenceId(draft.license_asset_id)||Boolean(credentialUrl(draft.license_url))]]:[])]
 return {percentage:Math.round(checks.filter(([, ,ok])=>ok).length/checks.length*100),complete:checks.every(([, ,ok])=>ok),checks:checks.map(([key,label,complete])=>({key,label,complete}))}
}
