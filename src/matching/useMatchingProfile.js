import {useEffect,useState,useMemo} from 'react'
import {accountMatchingProfile,matchingStorageKey,normalizeMatchingProfile,readMatchingPreference} from './profile.js'
function read(key){try{return readMatchingPreference(window.localStorage,key)}catch{return {disabled:false,filtering:false,profile:null}}}
export default function useMatchingProfile(user,loading=false){
 const key=matchingStorageKey(user)
 const [state,setState]=useState(()=>({key,...read(key)}))
 useEffect(()=>{
  const refresh=()=>setState({key,...read(key)})
  refresh()
  const storage=event=>{if(event.key===key||event.key===null)refresh()}
  window.addEventListener('storage',storage);window.addEventListener('projecta-matching-updated',refresh)
  return()=>{window.removeEventListener('storage',storage);window.removeEventListener('projecta-matching-updated',refresh)}
 },[key])
 const current=state.key===key?state:read(key)
 const accountValue=JSON.stringify(accountMatchingProfile(user))
 const accountProfile=useMemo(()=>JSON.parse(accountValue),[accountValue])
 const profile=loading||current.disabled?null:current.profile||accountProfile
 function save(value){
  const profile=normalizeMatchingProfile(value)
  if(!profile)throw Error('اختر تخصصاً مهنياً صالحاً للمطابقة.')
  try{localStorage.setItem(key,JSON.stringify({enabled:true,filtering:true,profile}))}catch{throw Error('تعذر حفظ تفضيلات المطابقة على هذا المتصفح.')}
  setState({key,disabled:false,filtering:true,profile});window.dispatchEvent(new Event('projecta-matching-updated'))
 }
 function disable(){
  try{localStorage.setItem(key,JSON.stringify({enabled:false,profile:current.profile||accountMatchingProfile(user)}))}catch{throw Error('تعذر حفظ إعداد إيقاف المطابقة.')}
  setState({key,disabled:true,filtering:false,profile:current.profile||accountProfile});window.dispatchEvent(new Event('projecta-matching-updated'))
 }
 function setFiltering(filtering){
  if(!profile){if(filtering)throw Error('فعّل ملف المطابقة أولاً.');return}
  const draft=profile
  try{localStorage.setItem(key,JSON.stringify({enabled:true,filtering:filtering===true,profile:draft}))}catch{throw Error('تعذر حفظ إعداد التصفية.')}
  setState({key,disabled:false,filtering:filtering===true,profile:draft});window.dispatchEvent(new Event('projecta-matching-updated'))
 }
 return {profile,filtering:Boolean(profile&&current.filtering),draftProfile:current.profile||accountProfile,save,disable,setFiltering}
}
