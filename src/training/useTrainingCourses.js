import {useEffect,useState} from 'react'
import usePublishedDirectory from '../usePublishedDirectory.js'
import {loadCourses,courseStorageKey} from './data.js'
function read(){try{return loadCourses(window.localStorage)}catch{return []}}
export default function useTrainingCourses(){
 const {items:published,error}=usePublishedDirectory('courses')
 const [courses,setCourses]=useState(read),[now,setNow]=useState(Date.now)
 useEffect(()=>{
  const refresh=()=>{setCourses(read());setNow(Date.now())}
  const storage=event=>{if(event.key===courseStorageKey||event.key===null)refresh()}
  const timer=setInterval(()=>setNow(Date.now()),60000)
  window.addEventListener('storage',storage);window.addEventListener('training-updated',refresh);window.addEventListener('focus',refresh)
  return()=>{clearInterval(timer);window.removeEventListener('storage',storage);window.removeEventListener('training-updated',refresh);window.removeEventListener('focus',refresh)}
 },[])
 return {courses:[...published,...courses],now,error}
}
