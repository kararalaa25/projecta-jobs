import {useEffect,useState} from 'react'
import {normalizeProfileTrust,unverifiedProfile} from '../config/profile-trust.js'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const eligibleForTrust=job=>job.live===true&&job.source==='manual'&&!job.sample&&UUID.test(job.id)
export function listingVerification(job,summaries){
 if(job.type==='candidates'&&job.source==='platform'&&job.live===true&&!job.sample)return normalizeProfileTrust(job.verification)
 if(!eligibleForTrust(job))return unverifiedProfile()
 return normalizeProfileTrust(summaries[job.id]||{status:'checking'})
}
export default function useJobTrust(jobs){
 const key=[...new Set(jobs.filter(eligibleForTrust).map(job=>job.id))].sort().join(',')
 const [summaries,setSummaries]=useState({})
 useEffect(()=>{
  if(!key){setSummaries({});return}
  const ids=key.split(','),controller=new AbortController()
  let active=true,loading=false
  setSummaries({})
  async function refresh(){
   if(loading)return
   loading=true
   try{
    for(let start=0;start<ids.length&&active;start+=24){
     const batch=ids.slice(start,start+24),next={}
     for(const id of batch)next[id]={status:'unavailable',kind:'professional',credentials:[]}
     try{
      const response=await fetch(`/api/profile-trust?ids=${batch.join(',')}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])})
      if(!response.ok)throw Error('Trust unavailable')
      const body=await response.json()
      if(!Array.isArray(body.jobs))throw Error('Invalid trust response')
      for(const row of body.jobs)if(batch.includes(row.id))next[row.id]=normalizeProfileTrust(row.verification)
     }catch{if(!active)return}
     if(active)setSummaries(current=>({...current,...next}))
    }
   }finally{loading=false}
  }
  const onVisible=()=>{if(document.visibilityState==='visible')refresh()}
  refresh()
  const timer=setInterval(onVisible,60000)
  window.addEventListener('projecta-trust-updated',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',onVisible)
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('projecta-trust-updated',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',onVisible)}
 },[key])
 return summaries
}
