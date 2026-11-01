import {useEffect,useState} from 'react'
import {accountMatchingProfile,matchingStorageKey,normalizeMatchingProfile,readMatchingPreference} from './profile.js'
function read(key){try{return readMatchingPreference(window.localStorage,key)}catch{return {disabled:false,profile:null}}}
export default function useMatchingProfile(user,loading=false){
 const key=matchingStorageKey(user)
 const [state,setState]=useState(()=>({key,...read(key)}))
 useEffect(()=>{
  const refresh=()=>setState({key,...read(key)})
  refresh()
  const storage=event=>{if(event.key===key||event.key===null)refresh()}
  window.addEventListener('storage',storage)
  return()=>window.removeEventListener('storage',storage)
 },[key])
 const current=state.key===key?state:read(key)
 const profile=loading||current.disabled?null:current.profile||accountMatchingProfile(user)
 function save(value){
  const profile=normalizeMatchingProfile(value)
  if(!profile)throw Error('اختر تخصصاً مهنياً صالحاً للمطابقة.')
  try{localStorage.setItem(key,JSON.stringify({enabled:true,profile}))}catch{throw Error('تعذر حفظ تفضيلات المطابقة على هذا المتصفح.')}
  setState({key,disabled:false,profile})
 }
 function disable(){
  try{localStorage.setItem(key,JSON.stringify({enabled:false,profile:current.profile||accountMatchingProfile(user)}))}catch{throw Error('تعذر حفظ إعداد إيقاف المطابقة.')}
  setState({key,disabled:true,profile:current.profile||accountMatchingProfile(user)})
 }
 return {profile,draftProfile:current.profile||accountMatchingProfile(user),save,disable}
}
