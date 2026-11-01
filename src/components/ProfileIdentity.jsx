import {Building2,UserRound} from 'lucide-react'
import {VerificationStatus} from './VerifiedBadge'
import CredentialBadges from './CredentialBadges'
import SpecialtyBadge from './SpecialtyBadge'
export default function ProfileIdentity({name,verification,specialty}){
 const displayName=typeof name==='string'&&name.trim()?name.trim().slice(0,200):'ملفك المهني'
 const Icon=['clinic','medical_center'].includes(verification?.kind)?Building2:UserRound
 return <header className="profile-identity"><div className="profile-avatar" aria-hidden="true"><Icon size={25}/></div><div className="profile-identity-copy"><h3>{displayName}</h3><VerificationStatus verification={verification}/>{specialty&&<div className="profile-specialty"><span>التخصص</span><SpecialtyBadge role={specialty}/></div>}<CredentialBadges verification={verification}/></div></header>
}
