import {useEffect,useRef} from 'react'
import {supabase} from './supabase'
import {subscribeTrustEvents} from './trust-events.js'
export default function useTrustSync(onAccount){
 const callback=useRef(onAccount);callback.current=onAccount
 useEffect(()=>subscribeTrustEvents(supabase,()=>{window.dispatchEvent(new Event('projecta-trust-updated'));callback.current?.()}),[])
}
