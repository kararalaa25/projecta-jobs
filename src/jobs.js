import {classifyJob} from '../config/job-targeting.js'
import {isPlatformOffer} from '../config/job-feeds.js'
import {matchGovernorates,matchEmploymentType} from '../config/job-matching.js'
import {jobTimestamp} from './dates.js'
import { ar, canonicalRole, canonicalCity, roles as roleList, cities as cityList } from './i18n.js'
import { extractContacts, normalizeIraqiPhone, telegramHandle, isRejectedPost, isRawJobAllowed } from './contacts.js'
const roleNames = {
  dentist: 'Dentists', dentists: 'Dentists', pharmacist:'Pharmacists', pharmacists:'Pharmacists', nurse:'Assistants & Techs', medical_rep: 'Medical Reps',
  medical_reps: 'Medical Reps', dental_assistant: 'Assistants & Techs',
  receptionist: 'Receptionists / Admin', secretary: 'Receptionists / Admin',
  lab_tech: 'Assistants & Techs', lab_technician: 'Assistants & Techs',
}
export function telegramUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 't.me' && !url.username && !url.password ? url.href : null
  } catch { return null }
}
function contact(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}
export function toJob(row) {
  const meta = contact(row.contact_info)
  const raw = meta.parsing_status === 'unparsed'
  const text = row.description || ''
  let title = raw ? text.split('\n').find(line => line.trim()) || 'Telegram post' : row.title || 'Job offer'
  const extracted = extractContacts(text)
  const phone = normalizeIraqiPhone(row.contact_phone || meta.phone)?.local || extracted.phone
  const whatsapp = normalizeIraqiPhone(row.contact_whatsapp || meta.whatsapp)?.whatsapp || extracted.whatsapp
  const username = telegramHandle(row.contact_telegram || meta.telegram) || extracted.telegram
  const sourceUrl = telegramUrl(meta.source_url)
  const company = typeof meta.company_name === 'string' && meta.company_name.trim() ? meta.company_name : row.source === 'telegram' ? 'Telegram community' : 'Healthcare employer'
  const scheduleValue=Object.hasOwn(meta,'employment_type')?meta.employment_type:row.source==='telegram'?null:row.employment_type
  const mappedRoles=(Array.isArray(meta.role_categories)?meta.role_categories:[]).map(canonicalRole).filter(value=>roleList.includes(value))
  const mappedLocations=(Array.isArray(meta.governorates)?meta.governorates:[]).map(canonicalCity).filter(value=>cityList.includes(value))
  const inferred=classifyJob(title,text)
  if(raw&&inferred.primary)title='فرصة عمل — '+ar(inferred.primary)
  const candidateRole=canonicalRole(meta.role_category||roleNames[row.role_category]||row.role_category||mappedRoles[0]||inferred.primary||'')
  const role=roleList.includes(candidateRole)?candidateRole:inferred.primary||'Unsorted'
  const inferredLocations=row.source==='telegram'&&!mappedLocations.length?matchGovernorates(text):[]
  const candidateCity=canonicalCity(meta.governorate||row.location_city||'')
  const province=cityList.includes(candidateCity)?candidateCity:inferredLocations[0]||'City not specified'
  const schedule=({full_time:'Full-time',part_time:'Part-time',contract:'Contract',internship:'Internship','Full-time':'Full-time','Part-time':'Part-time',Contract:'Contract'}[scheduleValue])
  // Imported full_time defaults are not evidence when parsing explicitly left the schedule unknown.
  const inferredSchedule=row.source==='telegram'?matchEmploymentType(text):null
  return {
    id: row.id, type: 'jobs', source:row.source, official:isPlatformOffer(row), title: title.slice(0, 140), company,
    city:province, governorates:mappedLocations.length?mappedLocations:inferredLocations.length?inferredLocations:[province], role, roles:mappedRoles.length?mappedRoles:inferred.roles.length?inferred.roles:[role],
    salary: row.salary_range || 'Salary not specified',
    schedule: inferredSchedule||(!raw?schedule:null)||'Schedule not specified',
    description: text, logo: row.source === 'telegram' ? '↗' : company.slice(0, 2).toUpperCase(), color: 'mint',
    time: jobTimestamp(meta.source_posted_at || row.created_at),
    createdAt: meta.source_posted_at || row.created_at || '', sourceUrl, phone, whatsapp,
    telegram: username,
    targetAudience:meta.target_audience||inferred.targetAudience,
    live: true, raw, featured:meta.featured===true,
  }
}
export function visibleJobs(rows){
 return rows.filter(row=>{
  if(row.source!=='telegram')return true
  const meta=contact(row.contact_info),text=row.description||row.title||''
  // Grounded AI extractions can be short (e.g. one role in a numbered list).
  // The raw-post heuristic must not hide a successfully parsed individual offer.
  if(meta.parsing_status==='parsed')return typeof row.title==='string'&&Boolean(row.title.trim())&&Boolean(text.trim())
  return !isRejectedPost(text)&&(meta.parsing_status!=='unparsed'||isRawJobAllowed(text))
 }).map(toJob)
}
export async function fetchJobsByIds(ids,signal){
 const response=await fetch(`/api/jobs?ids=${encodeURIComponent(ids.join(','))}`,{signal,cache:'no-store',headers:{Accept:'application/json'}})
 if(!response.ok)throw Error('تعذر تحديث فرص العمل.')
 const body=await response.json()
 if(!Array.isArray(body.jobs))throw Error('تعذر قراءة تحديث الإعلانات.')
 return visibleJobs(body.jobs)
}
export async function fetchJobsPage(signal, offset=0, feed='all') {
  const response = await fetch(`/api/jobs?offset=${offset}&feed=${encodeURIComponent(feed)}`, { signal, cache:'no-store', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('تعذر تحميل فرص العمل. يرجى إعادة المحاولة.')
  const payload = await response.json()
  if (!Array.isArray(payload.jobs)) throw new Error('تعذر قراءة بيانات الإعلانات.')
  return {hasMore:payload.hasMore===true,jobs:visibleJobs(payload.jobs)}
}
export async function fetchJobs(signal,feed='all'){
 const jobs=[]
 for(let page=0;page<100;page++){const result=await fetchJobsPage(signal,page*200,feed);jobs.push(...result.jobs);if(!result.hasMore)return jobs}
 throw new Error("تجاوزت النتائج حد التحميل. يرجى تضييق نطاق البحث.")
}
