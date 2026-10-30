import rules from './job-role-rules.json' with {type:'json'}
import catalog from './iraq.json' with {type:'json'}
export const normalizeRoleText=value=>String(value||'').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/_/g,' ').toLowerCase()
const patterns=Object.fromEntries(Object.entries(rules.patterns).map(([role,pattern])=>[role,new RegExp(pattern,'giu')]))
export function detectRoles(text){
 const value=normalizeRoleText(text),assistant=[...value.matchAll(patterns['Assistants & Techs'])],hasRep=patterns['Medical Reps'].test(value);patterns['Medical Reps'].lastIndex=0
 const found=[]
 for(const [role,pattern] of Object.entries(patterns)){
  pattern.lastIndex=0
  const hits=[...value.matchAll(pattern)].filter(match=>{
   const prefix=value.slice(Math.max(0,match.index-45),match.index)
   if(['Dentists','General Physicians'].includes(role)&&assistant.some(m=>m.index<=match.index&&match.index<m.index+m[0].length))return false
   if(['Dentists','General Physicians','Pharmacists'].includes(role)&&/(?:عياده|لعياده|خريج|خريجه|خريجي|شهاده|بكالوريوس|لزياره|زياره|التواصل مع|التعامل مع|للتعامل مع|مراجعه|تستهدف)\s*$/.test(prefix))return false
   if(hasRep&&['Dentists','General Physicians','Pharmacists'].includes(role)&&/(?:للعمل|للعمل ك|للعمل بصفه)\s*مندوب/.test(value))return false
   if(role==='Assistants & Techs'&&hasRep&&/^مختبر(?:ات)?$/.test(match[0]))return false
   return true
  })
  if(hits.length)found.push([hits[0].index,role])
 }
 return found.sort((a,b)=>a[0]-b[0]).map(([,role])=>role)
}
export function classifyJob(title,description=''){
 const titleRoles=detectRoles(title),roles=titleRoles.length?titleRoles:detectRoles(description)
 return {version:rules.version,roles,primary:roles[0]||null,source:titleRoles.length?'title':roles.length?'description':'unclassified',needsReview:roles.length!==1,targetAudience:roles.map(id=>catalog.roles.find(r=>r.id===id)?.ar||id)}
}
