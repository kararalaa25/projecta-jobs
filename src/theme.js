import {useEffect,useState} from 'react'

export const THEME_KEY='theme'
const DARK='dark',LIGHT='light'

function systemTheme(){
 return typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)')?.matches?DARK:LIGHT
}

/** Returns the manually saved choice, or null when the system should decide. */
export function readStoredTheme(){
 try{
  const value=localStorage.getItem(THEME_KEY)
  return value===DARK||value===LIGHT?value:null
 }catch{return null}
}

/** Applies the resolved theme to the root so token + contrast CSS react instantly. */
export function applyTheme(theme){
 const root=document.documentElement
 root.setAttribute('data-theme',theme)
 const meta=document.querySelector('meta[name="theme-color"]')
 if(meta)meta.setAttribute('content',theme===DARK?'#0b1420':'#0299b5')
}

/**
 * Theme state with manual localStorage persistence and a system-preference
 * fallback that stays live until the visitor makes a manual choice.
 */
export function useTheme(){
 const [theme,setTheme]=useState(()=>readStoredTheme()||systemTheme())

 useEffect(()=>{applyTheme(theme)},[theme])

 useEffect(()=>{
  if(readStoredTheme())return
  const media=window.matchMedia('(prefers-color-scheme: dark)')
  const onChange=()=>setTheme(media.matches?DARK:LIGHT)
  media.addEventListener?.('change',onChange)
  return()=>media.removeEventListener?.('change',onChange)
 },[theme])

 const toggleTheme=()=>setTheme(current=>{
  const next=current===DARK?LIGHT:DARK
  try{localStorage.setItem(THEME_KEY,next)}catch{}
  return next
 })

 return {theme,toggleTheme}
}
