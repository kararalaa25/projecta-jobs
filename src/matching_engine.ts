import catalog from '../config/iraq.json' with {type:'json'}

export interface PractitionerProfile {
 role?: string; specialty?: string; city?: string; location?: string;
 governorates?: readonly string[]; workTypes?: readonly string[];
 shiftPreferences?: readonly string[]; skills?: readonly string[];
}
export interface JobRequirements extends PractitionerProfile {
 roles?: readonly string[]; schedule?: string; shifts?: readonly string[];
 requiredSkills?: readonly string[]; title?: string; description?: string;
}
export type MatchStatus='match'|'partial'|'mismatch'|'unknown'
export interface FitDimension {key:'specialty'|'location'|'shift'|'skills';label:string;weight:number;points:number;status:MatchStatus;detail:string}
export interface SpecialtyFit {
 score:number|null;coverage:number;level:'high'|'medium'|'low'|'insufficient';
 specialty:string|null;matchedSkills:string[];missingSkills:string[];dimensions:FitDimension[];
}
interface Skill {id:string;label:string;aliases:readonly string[];role?:string}
export const MATCH_WEIGHTS=Object.freeze({specialty:45,location:20,shift:15,skills:20})
export const MEDICAL_SKILLS:readonly Skill[]=[
 {id:'orthodontics',label:'تقويم الأسنان',aliases:['orthodontics','orthodontic','تقويم الاسنان'],role:'Dentists'},
 {id:'crown-prep',label:'تحضير التيجان',aliases:['crown prep','crown preparation','تحضير التيجان','تحضير تيجان','تحضير التاج'],role:'Dentists'},
 {id:'endodontics',label:'علاج الجذور',aliases:['endodontics','root canal','علاج الجذور','علاج جذور'],role:'Dentists'},
 {id:'restorative',label:'ترميم الأسنان',aliases:['restorative dentistry','restorative','ترميم الاسنان','حشوات الاسنان'],role:'Dentists'},
 {id:'dental-assisting',label:'المساعدة السريرية',aliases:['dental assisting','مساعدة سريرية','المساعدة السريرية'],role:'Assistants & Techs'},
 {id:'infection-control',label:'مكافحة العدوى',aliases:['infection control','مكافحة العدوى','التعقيم']},
 {id:'patient-care',label:'رعاية المرضى',aliases:['patient care','رعاية المرضى','التواصل مع المرضى']},
 {id:'counseling',label:'الإرشاد الدوائي',aliases:['medication counseling','drug counseling','الارشاد الدوائي'],role:'Pharmacists'},
 {id:'dispensing',label:'صرف الأدوية',aliases:['dispensing','صرف الادوية'],role:'Pharmacists'},
 {id:'prescriptions',label:'مراجعة الوصفات',aliases:['prescription review','مراجعة الوصفات'],role:'Pharmacists'},
 {id:'inventory',label:'إدارة المخزون',aliases:['inventory management','ادارة المخزون']},
 {id:'wound-care',label:'العناية بالجروح',aliases:['wound care','العناية بالجروح'],role:'Assistants & Techs'},
 {id:'iv-therapy',label:'العلاج الوريدي',aliases:['iv therapy','intravenous therapy','العلاج الوريدي'],role:'Assistants & Techs'},
 {id:'bls',label:'دعم الحياة الأساسي',aliases:['bls','basic life support','دعم الحياة الاساسي','الانعاش القلبي الرئوي']},
 {id:'medical-sales',label:'التمثيل الطبي',aliases:['medical sales','medical representation','التمثيل الطبي','مندوب علمي'],role:'Medical Reps'},
 {id:'scientific-communication',label:'التواصل العلمي',aliases:['scientific communication','التواصل العلمي'],role:'Medical Reps'},
 {id:'territory',label:'إدارة الزيارات',aliases:['territory management','ادارة الزيارات'],role:'Medical Reps'},
 {id:'primary-care',label:'الرعاية الأولية',aliases:['primary care','الرعاية الاولية'],role:'General Physicians'},
 {id:'appointments',label:'إدارة المواعيد',aliases:['appointment management','ادارة المواعيد','تنظيم المواعيد'],role:'Receptionists / Admin'},
]
export function normalizeMatchText(value:unknown):string {
 return typeof value==='string'?value.normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase().replace(/[_–-]/g,' ').replace(/\s+/g,' ').trim():''
}
const strings=(value:unknown):string[]=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string').slice(0,60):typeof value==='string'?[value]:[]
const pattern=(alias:string)=>{
 const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 const prefix=/^[\u0600-\u06ff]/u.test(alias)?'(?:[وف])?(?:ب|ل)?(?:ال)?':''
 return new RegExp(`(^|[^\\p{L}\\p{N}])${prefix}${escaped}(?=$|[^\\p{L}\\p{N}])`,'u')
}
function evidenceText(value:string):string {
 return value.slice(0,20000).split(/\r?\n/).map(normalizeMatchText).join('\n')
}
function mentioned(text:string,alias:string,skipNegated=false):boolean {
 const expression=pattern(normalizeMatchText(alias))
 for(const match of text.matchAll(new RegExp(expression.source,'gu'))){
  if(!skipNegated)return true
  const before=text.slice(Math.max(0,match.index-65),match.index),after=text.slice(match.index+match[0].length,match.index+match[0].length+30)
  const negated=/(?:لا يشترط|لا يتطلب|لا يلزم|بدون خبرة|no experience|not required)[^.!؟\n]*$/u.test(before)||/^\s*(?:is\s+)?not required/u.test(after)
  if(!negated)return true
 }
 return false
}

const roleAliases:Record<string,readonly string[]>={
 'Assistants & Techs':['nursing','nurse','dental assistants','lab techs','dental assistant','ممرض','ممرضة','تمريض','مساعد طبيب اسنان','مساعدة طبيب اسنان'],
 Dentists:['dentistry','dentist','طبيب اسنان','طبيبة اسنان','اطباء الاسنان'],
 Pharmacists:['pharmacy','pharmacist','صيدلة','صيدلي','صيدلاني','صيدلانية'],
 'Medical Reps':['medical representatives','medical rep','مندوب طبي','مندوب علمي','التمثيل الطبي'],
 'General Physicians':['general practitioners','general practitioner','general physician','طبيب عام','طبيبة عامة','طب عام'],
 'Receptionists / Admin':['clinic operations','receptionist','ادارة العيادات','استقبال','سكرتارية'],
}
export function canonicalMatchRole(value:unknown):string|null {
 const text=normalizeMatchText(value)
 if(!text)return null
 const exact=catalog.roles.find(role=>normalizeMatchText(role.id)===text||normalizeMatchText(role.ar)===text)
 if(exact)return exact.id
 for(const role of ['Assistants & Techs','Medical Reps','Receptionists / Admin','Dentists','Pharmacists','General Physicians'])if(roleAliases[role].some(alias=>mentioned(text,alias)))return role
 return MEDICAL_SKILLS.find(skill=>skill.role&&[skill.id,...skill.aliases].some(alias=>normalizeMatchText(alias)===text))?.role||null
}
function locations(value:PractitionerProfile):string[]{
 const values=[...strings(value.governorates),...strings(value.city),...strings(value.location)].map(normalizeMatchText)
 return catalog.governorates.filter(city=>values.some(value=>[city.id,city.ar,...city.aliases].some(alias=>normalizeMatchText(alias)===value))).map(city=>city.id)
}
const shiftAliases:Record<string,readonly string[]>={
 'Full-time':['full time','دوام كامل'], 'Part-time':['part time','دوام جزئي'],
 Shift:['shift','مناوبة','مناوبات','شفت'],Night:['night','night shift','دوام ليلي','مناوبة ليلية'],
 Evening:['evening','evening shift','دوام مسائي','مناوبة مسائية'],Day:['day shift','morning','دوام صباحي','مناوبة صباحية'],
}
function shifts(values:readonly string[],text=''):string[]{
 const normalized=values.map(normalizeMatchText)
 return Object.entries(shiftAliases).filter(([id,aliases])=>normalized.some(value=>[id,...aliases].some(alias=>normalizeMatchText(alias)===value))||aliases.some(alias=>mentioned(evidenceText(text),alias,true))).map(([id])=>id)
}
function skillMap(values:readonly string[],text=''):Map<string,string>{
 const result=new Map<string,string>(),source=evidenceText(text)
 for(const value of values.slice(0,60)){
  const normalized=normalizeMatchText(value).slice(0,100)
  if(!normalized)continue
  const known=MEDICAL_SKILLS.filter(skill=>[skill.id,skill.label,...skill.aliases].some(alias=>mentioned(normalized,alias,true)))
  if(known.length)for(const skill of known)result.set(skill.id,skill.label)
  else result.set(normalized,value.trim().slice(0,100))
 }
 for(const skill of MEDICAL_SKILLS)if(skill.aliases.some(alias=>mentioned(source,alias,true)))result.set(skill.id,skill.label)
 return result
}
function dimension(key:FitDimension['key'],label:string,known:boolean,ratio:number,detail:string):FitDimension {
 const weight=MATCH_WEIGHTS[key]
 return {key,label,weight,points:known?weight*ratio:0,status:!known?'unknown':ratio===1?'match':ratio===0?'mismatch':'partial',detail}
}
export function scoreSpecialtyFit(profile:PractitionerProfile|null|undefined,job:JobRequirements):SpecialtyFit {
 const candidate=profile||{},candidateRole=canonicalMatchRole(candidate.role||candidate.specialty)
 const jobRoles=[...strings(job.roles),...strings(job.role),...strings(job.specialty)].map(canonicalMatchRole).filter((role):role is string=>Boolean(role))
 const specialtyKnown=Boolean(candidateRole&&jobRoles.length),specialtyMatch=specialtyKnown&&jobRoles.includes(candidateRole!)
 const candidatePlaces=locations(candidate),jobPlaces=locations(job)
 const candidateShifts=shifts([...strings(candidate.workTypes),...strings(candidate.shiftPreferences)])
 const jobShifts=shifts([...strings(job.shifts),...strings(job.workTypes),...strings(job.shiftPreferences),...strings(job.schedule)],`${job.title||''}\n${job.description||''}`)
 const candidateSkills=skillMap(strings(candidate.skills),candidate.specialty||'')
 const jobSkills=skillMap([...strings(job.requiredSkills),...strings(job.skills)],`${job.title||''}\n${job.description||''}`)
 const matched=[...jobSkills.keys()].filter(key=>candidateSkills.has(key)),missing=[...jobSkills.keys()].filter(key=>!candidateSkills.has(key))
 const hasSkills=jobSkills.size>0&&candidateSkills.size>0
 const shiftMatch=jobShifts.some(shift=>candidateShifts.includes(shift)||(candidateShifts.includes('Shift')&&['Night','Evening','Day'].includes(shift)))
 const dimensions=[
  dimension('specialty','التخصص',specialtyKnown,specialtyMatch?1:0,!specialtyKnown?'التخصص غير محدد في أحد الطرفين':specialtyMatch?'التخصص المهني متوافق':'التخصص المهني مختلف'),
  dimension('location','المحافظة',Boolean(candidatePlaces.length&&jobPlaces.length),candidatePlaces.some(city=>jobPlaces.includes(city))?1:0,candidatePlaces.length&&jobPlaces.length?'مقارنة المحافظات المذكورة':'الموقع غير محدد في أحد الطرفين'),
  dimension('shift','الدوام',Boolean(candidateShifts.length&&jobShifts.length),shiftMatch?1:0,candidateShifts.length&&jobShifts.length?'مقارنة أنواع الدوام المعلنة':'الدوام غير محدد في أحد الطرفين'),
  dimension('skills','المهارات',hasSkills,hasSkills?matched.length/jobSkills.size:0,jobSkills.size?'مقارنة المهارات المذكورة في الإعلان':'لم يذكر الإعلان مهارات يمكن مقارنتها'),
 ]
 const coverage=dimensions.reduce((sum,item)=>sum+(item.status!=='unknown'?item.weight:0),0)
 let score=specialtyKnown&&coverage>=55?Math.round(dimensions.reduce((sum,item)=>sum+item.points,0)):null
 if(score!==null&&!specialtyMatch)score=Math.min(score,35)
 return {score,coverage,level:score===null?'insufficient':score>=85?'high':score>=55?'medium':'low',specialty:candidateRole,
  matchedSkills:matched.map(key=>jobSkills.get(key)!),missingSkills:missing.map(key=>jobSkills.get(key)!),dimensions}
}
