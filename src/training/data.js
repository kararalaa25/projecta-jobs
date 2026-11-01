import catalog from '../../config/iraq.json' with {type:'json'}
import {normalizeSearch,matchesSearch} from '../job-ui.js'
import {normalizeIraqiPhone} from '../contacts.js'
import {ar} from '../i18n.js'
const STORAGE_KEY='projecta-training-courses-v1'
export const trainingTypes=[['hands_on','ورشة عملية'],['seminar','ندوة'],['course','دورة'],['program','برنامج تدريبي']]
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):''
export function safeRegistrationUrl(value){
 if(typeof value!=='string'||!value.trim())return null
 try{const url=new URL(value.trim());return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}
}
export function normalizeCourse(value,source='local'){
 if(!value||typeof value!=='object')return null
 const id=text(value.id,100),title=text(value.title,160),city=catalog.governorates.find(city=>city.id===value.city)?.id,
 role=catalog.roles.find(role=>role.id===value.role)?.id,kind=trainingTypes.find(([id])=>id===value.kind)?.[0]
 if(!id||!title||!city||!role||!kind)return null
 if(typeof value.startsAt!=='string'||typeof value.endsAt!=='string')return null
 const starts=Date.parse(value.startsAt),ends=Date.parse(value.endsAt)
 if(!Number.isFinite(starts)||!Number.isFinite(ends)||ends<=starts)return null
 const phone=normalizeIraqiPhone(value.phone)?.local||null
 return {id,title,city,role,kind,startsAt:new Date(starts).toISOString(),endsAt:new Date(ends).toISOString(),
  description:text(value.description,1800),instructor:text(value.instructor,120),credentials:text(value.credentials,240),venue:text(value.venue,180),
  phone,whatsappEnabled:value.whatsappEnabled===true&&Boolean(phone),registrationUrl:safeRegistrationUrl(value.registrationUrl),
  source:source==='demo'?'demo':source==='platform'?'platform':'local'}
}
export function validateCourse(value){
 if(!text(value.title,160))throw Error('أدخل عنوان البرنامج.')
 if(!text(value.instructor,120)||!text(value.credentials,240))throw Error('أدخل اسم المدرب ومؤهلاته المعلنة.')
 if(value.registrationUrl&&!safeRegistrationUrl(value.registrationUrl))throw Error('رابط التسجيل يجب أن يبدأ بـ https:// وألا يتضمن بيانات دخول.')
 if(value.phone&&!normalizeIraqiPhone(value.phone))throw Error('أدخل رقم هاتف عراقياً صالحاً.')
 if(!normalizeIraqiPhone(value.phone)&&!safeRegistrationUrl(value.registrationUrl))throw Error('أضف رقم تواصل أو رابط تسجيل صالحاً.')
 const course=normalizeCourse(value)
 if(!course)throw Error('تحقق من التخصص والمحافظة والمواعيد؛ يجب أن ينتهي البرنامج بعد بدايته.')
 return course
}
export function coursePhase(course,now=Date.now()){
 const start=Date.parse(course.startsAt),end=Date.parse(course.endsAt)
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 'unscheduled'
 return now>=end?'ended':now>=start?'ongoing':'upcoming'
}
export function registrationActions(course,now=Date.now()){
 if(course.source==='demo'||['ended','unscheduled'].includes(coursePhase(course,now)))return {registration:null,whatsapp:null,phone:null}
 const phone=normalizeIraqiPhone(course.phone)
 return {registration:safeRegistrationUrl(course.registrationUrl),phone:phone?`tel:${phone.local}`:null,
  whatsapp:course.whatsappEnabled===true&&phone?`https://wa.me/${phone.whatsapp}`:null}
}
export function courseMatches(course,{query='',city='',role='',kind='',phase='upcoming'}={},now=Date.now()){
 if(city&&course.city!==city||role&&course.role!==role||kind&&course.kind!==kind)return false
 const status=coursePhase(course,now)
 if(phase==='upcoming'&&!['upcoming','ongoing'].includes(status)||phase==='ended'&&status!=='ended')return false
 return matchesSearch(normalizeSearch([course.title,course.description,course.instructor,course.credentials,course.venue,course.city,ar(course.city),course.role,ar(course.role),trainingTypes.find(([id])=>id===course.kind)?.[1]].join(' ')),query)
}
const dateFormatter=new Intl.DateTimeFormat('ar-IQ',{timeZone:'Asia/Baghdad',day:'numeric',month:'long',year:'numeric'})
const timeFormatter=new Intl.DateTimeFormat('ar-IQ',{timeZone:'Asia/Baghdad',hour:'numeric',minute:'2-digit'})
export const courseDate=value=>Number.isFinite(Date.parse(value))?dateFormatter.format(new Date(value)):'الموعد غير محدد'
export const courseTime=value=>Number.isFinite(Date.parse(value))?timeFormatter.format(new Date(value)):''
export function baghdadDateTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return ''
 const date=new Date(`${value}:00+03:00`)
 return Number.isFinite(date.getTime())&&new Date(date.getTime()+3*3600000).toISOString().slice(0,16)===value?date.toISOString():''
}
export function localCourseDateTime(value){
 if(!Number.isFinite(Date.parse(value)))return ''
 return new Date(Date.parse(value)+3*3600000).toISOString().slice(0,16)
}
export function loadCourses(storage){
 try{const list=JSON.parse(storage.getItem(STORAGE_KEY)||'[]');return Array.isArray(list)?list.slice(0,100).map(value=>normalizeCourse(value)).filter(Boolean):[]}catch{return []}
}
export function saveCourse(storage,course){
 const safe=validateCourse(course),rows=loadCourses(storage).filter(row=>row.id!==safe.id)
 if(rows.length>=100)throw Error('وصلت إلى حد 100 برنامج محلي. احذف برنامجاً قديماً أولاً.')
 try{storage.setItem(STORAGE_KEY,JSON.stringify([safe,...rows]))}catch{throw Error('تعذر حفظ البرنامج على هذا المتصفح.')}
 return safe
}
export function removeCourse(storage,id){
 try{storage.setItem(STORAGE_KEY,JSON.stringify(loadCourses(storage).filter(course=>course.id!==id)))}catch{throw Error('تعذر حذف البرنامج المحلي.')}
}
export const courseStorageKey=STORAGE_KEY
const demoInputs=[
 ['cme-demo-1','التقويم: التشخيص وتخطيط العلاج','Dentists','Baghdad','seminar','2026-11-20T09:00:00+03:00','2026-11-20T14:00:00+03:00','مدرب تقويم — نموذج','اختصاص تقويم الأسنان — مثال للمؤهل المعروض','جلسات علمية توضيحية عن التشخيص وخيارات التخطيط في تقويم الأسنان.'],
 ['cme-demo-2','تحضير التيجان والترميمات الثابتة','Dentists','Karbala','hands_on','2026-11-27T09:00:00+03:00','2026-11-27T16:00:00+03:00','مدربة ترميمات — نموذج','اختصاص التعويضات السنية — مثال للمؤهل المعروض','ورشة توضيحية تشمل مبادئ تحضير التيجان والتطبيق على نماذج تدريبية.'],
 ['cme-demo-3','التواصل العلمي للمندوب الطبي','Medical Reps','Najaf','program','2026-12-04T10:00:00+03:00','2026-12-04T15:00:00+03:00','مدرب تمثيل طبي — نموذج','خبرة في التدريب والتواصل العلمي — مثال توضيحي','برنامج توضيحي لتخطيط الزيارات وإدارة العلاقات والتواصل العلمي المهني.'],
 ['cme-demo-4','الإرشاد الدوائي ومراجعة الوصفات','Pharmacists','Erbil','course','2026-12-11T09:30:00+03:00','2026-12-11T14:30:00+03:00','مدربة صيدلة — نموذج','صيدلة سريرية — مثال للمؤهل المعروض','تدريب توضيحي على الإرشاد الدوائي وتنظيم مراجعة الوصفات.'],
 ['cme-demo-5','العناية بالجروح ومكافحة العدوى','Assistants & Techs','Babylon','hands_on','2026-12-18T09:00:00+03:00','2026-12-18T15:00:00+03:00','مدرب تمريض — نموذج','تدريب تمريضي سريري — مثال توضيحي','ورشة توضيحية في الرعاية التمريضية ومبادئ التعقيم والتطبيق العملي.'],
 ['cme-demo-6','تنظيم العيادات وتجربة المريض','Receptionists / Admin','Basra','course','2027-01-08T10:00:00+03:00','2027-01-08T14:00:00+03:00','مدربة إدارة صحية — نموذج','إدارة مؤسسات صحية — مثال للمؤهل المعروض','دورة توضيحية لإدارة المواعيد وتنظيم العمل داخل الفرق الصحية.'],
 ['cme-demo-7','الرعاية الأولية: نقاشات مهنية','General Physicians','Sulaymaniyah','seminar','2027-01-15T09:00:00+03:00','2027-01-15T13:00:00+03:00','مدرب طب عام — نموذج','خبرة في الرعاية الأولية — مثال للمؤهل المعروض','ندوة توضيحية لتبادل الخبرات حول تنظيم المتابعة والرعاية الأولية.'],
]
export const demoCourses=demoInputs.map(([id,title,role,city,kind,startsAt,endsAt,instructor,credentials,description])=>normalizeCourse({id,title,role,city,kind,startsAt,endsAt,instructor,credentials,description,venue:`${ar(city)} — موقع تدريبي توضيحي`},'demo'))
