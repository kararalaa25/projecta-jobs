const roleNames = {
  dentist: 'Dentists', dentists: 'Dentists', medical_rep: 'Medical Reps',
  medical_reps: 'Medical Reps', dental_assistant: 'Dental Assistants',
  receptionist: 'Receptionists/Secretaries', secretary: 'Receptionists/Secretaries',
  lab_tech: 'Lab Techs', lab_technician: 'Lab Techs',
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
  const title = raw ? text.split('\n').find(line => line.trim()) || 'Telegram post' : row.title || 'Job offer'
  const phone = typeof meta.phone === 'string' && /^\+?[\d\s()-]{8,25}$/.test(meta.phone) ? meta.phone : null
  const username = typeof meta.telegram === 'string' ? meta.telegram.replace(/^@/, '') : ''
  const sourceUrl = telegramUrl(meta.source_url)
  const company = typeof meta.company_name === 'string' && meta.company_name.trim() ? meta.company_name : row.source === 'telegram' ? 'Telegram community' : 'Healthcare employer'
  return {
    id: row.id, type: 'jobs', title: title.slice(0, 140), company,
    city: row.location_city || 'City not specified', role: roleNames[row.role_category] || row.role_category || '',
    salary: row.salary_range || 'Salary not specified',
    schedule: raw ? 'Schedule not specified' : ({ full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' }[row.employment_type] || 'Schedule not specified'),
    description: text, logo: row.source === 'telegram' ? '↗' : company.slice(0, 2).toUpperCase(), color: 'mint',
    time: row.created_at && Number.isFinite(Date.parse(row.created_at)) ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(row.created_at)) : '',
    createdAt: row.created_at || '', sourceUrl, phone,
    telegram: /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) ? username : null,
    live: true, raw,
  }
}
export async function fetchJobs(signal) {
  const response = await fetch('/api/jobs', { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Live jobs could not be loaded. Please retry.')
  const payload = await response.json()
  if (!Array.isArray(payload.jobs)) throw new Error('The job feed returned an invalid response.')
  return payload.jobs.map(toJob)
}
