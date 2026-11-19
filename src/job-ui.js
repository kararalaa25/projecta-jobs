import {ar,canonicalRole} from './i18n.js'

export function specialtyClass(role){
 return ({Dentists:'specialty-dentistry',Pharmacists:'specialty-pharmacy','Medical Reps':'specialty-reps','Assistants & Techs':'specialty-nursing','General Physicians':'specialty-gp','Receptionists / Admin':'specialty-operations'})[canonicalRole(role)]||'specialty-general'
}
export function normalizeSearch(value){
 return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim().replace(/\s+/g,' ')
}
export function jobSearchText(job){
 const roles=[job.role,...(job.roles||[])],locations=[job.city,...(job.governorates||[])]
 return normalizeSearch([job.title,job.company,job.description,...roles,...roles.map(ar),...locations,...locations.map(ar)].join(' '))
}
export function matchesSearch(text,query){
 return normalizeSearch(query).split(' ').every(word=>text.includes(word))
}
/** Hash-only deep link (no server route). Uses the same stable id JobCard and main.jsx use. */
export function jobShareHash(job){
 const id=String(job?.id||'').trim()
 return id?`job=${encodeURIComponent(id)}`:''
}
/** Reads an id back from `#job=…` (or the raw `job=…` form); null for unrelated hashes. */
export function sharedJobId(hash){
 const value=String(hash||'').replace(/^#/,'')
 if(!value.startsWith('job='))return null
 const encoded=value.slice(4)
 if(!encoded)return null
 try{return decodeURIComponent(encoded)||null}catch{return null}
}
