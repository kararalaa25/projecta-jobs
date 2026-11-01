import {hasConfirmedIdentity,isSuspended} from './access.js'

const kinds=new Set(['professional','doctor','dentist','pharmacist','nurse','medical_rep','clinic_operations','clinic','medical_center'])
const states=new Set(['verified','pending','unverified','rejected','unavailable','checking'])
const credentials=new Set(['syndicate_membership','certified_specialist','facility_license'])
const roleKinds={'Dentists':'dentist','Pharmacists':'pharmacist','Assistants & Techs':'professional','Medical Reps':'medical_rep','General Physicians':'doctor','Receptionists / Admin':'clinic_operations'}
export const unverifiedProfile=()=>({status:'unverified',kind:'professional',credentials:[]})

// Read only administrator-controlled claims. Publishing rights, email ownership,
// user_metadata and submitted license numbers are not credential verification.
export function profileTrust(user){
 const meta=user?.app_metadata||{}
 const kind=kinds.has(meta.profile_kind)?meta.profile_kind:roleKinds[meta.professional_specialty]||'professional'
 const organization=kind==='clinic'||kind==='medical_center'
 const review=organization?meta.organization_verification_status||meta.verification_status:meta.verification_status
 const approved=organization?meta.organization_verified===true:meta.medical_professional_verified===true
 const eligible=hasConfirmedIdentity(user)&&!isSuspended(user)
 const verified=eligible&&approved&&!['pending','rejected'].includes(review)
 const status=verified?'verified':eligible&&review==='pending'?'pending':review==='rejected'?'rejected':'unverified'
 const claims=meta.verified_credentials||{}
 const accepted=verified?[...credentials].filter(key=>claims[key]===true&&(organization?key==='facility_license':key!=='facility_license')):[]
 return {status,kind,credentials:accepted}
}

// This normalizer accepts only the small trust summary returned by our server.
// Never pass arbitrary listing contact_info or local-storage claims to it.
export function normalizeProfileTrust(value){
 const status=states.has(value?.status)?value.status:'unverified'
 const kind=kinds.has(value?.kind)?value.kind:'professional'
 const organization=kind==='clinic'||kind==='medical_center'
 return {status,kind,credentials:status==='verified'&&Array.isArray(value?.credentials)
  ?[...new Set(value.credentials)].filter(key=>credentials.has(key)&&(organization?key==='facility_license':key!=='facility_license')):[]}
}
export function publicProfileTrust(user){
 const trust=profileTrust(user)
 // Other members' application/rejection states and license details stay private.
 return trust.status==='verified'?trust:{...unverifiedProfile(),kind:trust.kind}
}
