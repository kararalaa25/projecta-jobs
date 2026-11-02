import {BriefcaseMedical,Pill,Users,Building2,Stethoscope,Layers3,Check} from 'lucide-react'
import {ar,number} from '../i18n'
const icons={Dentists:Stethoscope,Pharmacists:Pill,'Medical Reps':BriefcaseMedical,'Assistants & Techs':Users,'Receptionists / Admin':Building2}
export default function CategoryChip({value,selected,count,onChange}){
 const Icon=icons[value]||Layers3
 return <label className={`category-chip ${selected?'is-active':''}`}><input className="category-chip-input" type="radio" name="role-filter" aria-label={ar(value)} checked={selected} onChange={onChange}/><Icon size={17} aria-hidden="true"/><span className="category-chip-label">{ar(value)}</span><span className="category-chip-count" aria-hidden="true">{number(count)}</span>{selected&&<Check size={15} aria-hidden="true"/>}</label>
}
