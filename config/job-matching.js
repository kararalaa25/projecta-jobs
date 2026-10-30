import catalog from './iraq.json' with {type:'json'}
import {normalizeRoleText} from './job-targeting.js'

const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
// Unicode letter boundaries work for Arabic, unlike JavaScript's ASCII \b.
export function matchGovernorates(text){
 const value=normalizeRoleText(String(text||'')),found=[]
 for(const governorate of catalog.governorates){
  const positions=[]
  for(const alias of governorate.aliases){
   const match=new RegExp('(?<![\\p{L}\\p{N}_])(?:و?ب|و?في|و)?'+escape(normalizeRoleText(alias))+'(?![\\p{L}\\p{N}_])','u').exec(value)
   if(match){const explicit=/(?:الموقع|العنوان|المحافظه|مكان العمل|العمل في)\s*[:/\-]?\s*$/.test(value.slice(Math.max(0,match.index-25),match.index));positions.push([explicit?0:1,match.index])}
  }
  if(positions.length){positions.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);found.push({id:governorate.id,rank:positions[0]})}
 }
 return found.sort((a,b)=>a.rank[0]-b.rank[0]||a.rank[1]-b.rank[1]).map(g=>g.id)
}

export function matchEmploymentType(text){
 const value=normalizeRoleText(String(text||''))
 const full=/(?:دوام\s*كامل|full[\s-]*time)/.test(value),part=/(?:دوام\s*جزئي|part[\s-]*time)/.test(value)
 return full===part?null:part?'Part-time':'Full-time'
}
