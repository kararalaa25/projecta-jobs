import {classifyJob} from '../config/job-targeting.js'
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
  const scheduleValue=Object.hasOwn(meta,'employment_type')?meta.employment_type:row.employment_type
  const mappedRoles=(Array.isArray(meta.role_categories)?meta.role_categories:[]).map(canonicalRole).filter(value=>roleList.includes(value))
  const mappedLocations=(Array.isArray(meta.governorates)?meta.governorates:[]).map(canonicalCity).filter(value=>cityList.includes(value))
  const inferred=classifyJob(title,text)
  if(raw&&inferred.primary)title='فرصة عمل — '+ar(inferred.primary)
  const role=canonicalRole(meta.role_category||roleNames[row.role_category]||row.role_category||inferred.primary||'')
  const province=canonicalCity(meta.governorate||row.location_city||'City not specified')
  return {
    id: row.id, type: 'jobs', title: title.slice(0, 140), company,
    city:province, governorates:mappedLocations.length?mappedLocations:[province], role, roles:mappedRoles.length?mappedRoles:role?[role]:inferred.roles,
    salary: row.salary_range || 'Salary not specified',
    schedule: raw ? 'Schedule not specified' : ({ full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', 'Full-time':'Full-time', 'Part-time':'Part-time', Contract:'Contract' }[scheduleValue] || 'Schedule not specified'),
    description: text, logo: row.source === 'telegram' ? '↗' : company.slice(0, 2).toUpperCase(), color: 'mint',
    time: jobTimestamp(meta.source_posted_at || row.created_at),
    createdAt: meta.source_posted_at || row.created_at || '', sourceUrl, phone, whatsapp,
    telegram: username,
    targetAudience:meta.target_audience||inferred.targetAudience,
    live: true, raw, featured:meta.featured===true,
  }
}
export async function fetchJobsPage(signal, offset=0) {
  const response = await fetch(`/api/jobs?offset=${offset}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('تعذر تحميل فرص العمل. يرجى إعادة المحاولة.')
  const payload = await response.json()
  if (!Array.isArray(payload.jobs)) throw new Error('تعذر قراءة بيانات الإعلانات.')
  return {hasMore:payload.hasMore===true,jobs:payload.jobs.filter(row => {
    if (row.source !== 'telegram') return true
    const text = row.description || row.title || ''
    return !isRejectedPost(text) && (contact(row.contact_info).parsing_status !== 'unparsed' || isRawJobAllowed(text))
  }).map(toJob)}
}
export async function fetchJobs(signal){
 const jobs=[]
 for(let page=0;page<100;page++){const result=await fetchJobsPage(signal,page*200);jobs.push(...result.jobs);if(!result.hasMore)return jobs}
 throw new Error("تجاوزت النتائج حد التحميل. يرجى تضييق نطاق البحث.")
}
