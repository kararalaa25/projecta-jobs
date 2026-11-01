import {useEffect,useState} from 'react'
import useTrustSync from './useTrustSync'
// Read only reviewed public records. Local drafts are never uploaded implicitly.
export default function usePublishedDirectory(kind){
 useTrustSync()
 const [items,setItems]=useState([]),[error,setError]=useState('')
 useEffect(()=>{
  const controller=new AbortController();let active=true,busy=false
  async function refresh(){
   if(busy||document.visibilityState==='hidden')return
   busy=true
   try{
    const rows=[]
    for(let offset=0;offset<=2400;offset+=24){
     const response=await fetch(`/api/directory?kind=${kind}&offset=${offset}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
     if(!response.ok)throw Error('Directory unavailable')
     const body=await response.json();if(!Array.isArray(body.items))throw Error('Invalid directory')
     rows.push(...body.items);if(!body.hasMore)break
    }
    if(active){setItems(rows);setError('')}
   }catch(failure){if(active&&failure.name!=='AbortError'){setItems([]);setError('تعذر تحميل المحتوى المنشور حالياً. ملفات هذا الجهاز ما زالت متاحة.')}}finally{busy=false}
  }
  refresh();const timer=setInterval(refresh,60000)
  window.addEventListener('projecta-trust-updated',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh)
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('projecta-trust-updated',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh)}
 },[kind])
 return {items,error}
}
