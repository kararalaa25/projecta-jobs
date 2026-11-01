import catalog from '../../config/iraq.json' with {type:'json'}
import {canonicalMatchRole,normalizeMatchText} from '../matching_engine.ts'
export const matchingShifts=[['Full-time','دوام كامل'],['Part-time','دوام جزئي'],['Shift','شفت / مناوبة'],['Day','صباحي'],['Evening','مسائي'],['Night','ليلي']]
export function normalizeMatchingProfile(value){
 if(!value||typeof value!=='object')return null
 const role=canonicalMatchRole(value.role||value.specialty)
 if(!role)return null
 const key=normalizeMatchText(value.city||value.location)
 const city=catalog.governorates.find(item=>[item.id,item.ar,...item.aliases].some(alias=>normalizeMatchText(alias)===key))?.id||''
 return {name:typeof value.name==='string'?value.name.trim().slice(0,120):'ملفي المهني',role,city,
  workTypes:[...new Set(Array.isArray(value.workTypes)?value.workTypes:[])].filter(type=>matchingShifts.some(([id])=>id===type)),
  skills:[...new Set((Array.isArray(value.skills)?value.skills:[]).filter(item=>typeof item==='string').map(item=>item.trim().slice(0,100)).filter(Boolean))].slice(0,30)}
}
export function accountMatchingProfile(user){
 if(!user)return null
 const meta=user.user_metadata||{},preferences=meta.matching_profile||{}
 return normalizeMatchingProfile({name:meta.full_name||meta.name,role:preferences.role||user.app_metadata?.professional_specialty||meta.profession,
  city:preferences.city||meta.governorate||meta.city,workTypes:preferences.workTypes||meta.work_types,skills:preferences.skills||meta.skills})
}
export const matchingStorageKey=user=>`projecta-specialty-fit-v1:${user?.id?'account:'+user.id:'device'}`
export function readMatchingPreference(storage,key){
 try{const value=JSON.parse(storage.getItem(key)||'null');return {disabled:value?.enabled===false,filtering:value?.filtering===true,profile:normalizeMatchingProfile(value?.profile)}}catch{return {disabled:false,filtering:false,profile:null}}
}
