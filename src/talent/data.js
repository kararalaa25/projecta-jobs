import {hasVerifiedCredentials} from '../../config/profile-trust.js'
import catalog from '../../config/iraq.json' with {type:'json'}
import {canonicalRole,ar} from '../i18n.js'
import {normalizeSearch,matchesSearch} from '../job-ui.js'
import {normalizeIraqiPhone} from '../contacts.js'
import {resumeFileSpec} from '../../config/resumes.js'

export const talentRoles=catalog.roles
export const talentCities=catalog.governorates
export const availabilityOptions=[{id:'available',label:'متاح الآن'},{id:'open',label:'منفتح على الفرص'},{id:'unavailable',label:'غير متاح حالياً'}]
export const workOptions=[{id:'Full-time',label:'دوام كامل'},{id:'Part-time',label:'دوام جزئي'},{id:'Shift',label:'شفت / مناوبة'}]
const clean=(value,max)=>typeof value==='string'?value.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):''
export function talentCity(value){
 const key=normalizeSearch(value)
 return talentCities.find(city=>[city.id,city.ar,...city.aliases].some(alias=>normalizeSearch(alias)===key))?.id||''
}
export function normalizeTalent(value,source='local'){
 if(!value||typeof value!=='object')return null
 const name=clean(value.name||value.company,120),role=canonicalRole(value.role),city=talentCity(value.city)
 if(!name||!talentRoles.some(item=>item.id===role)||!city||!clean(value.id,180))return null
 const phone=normalizeIraqiPhone(value.phone)?.local||null
 const whatsapp=value.whatsappEnabled===true&&phone?normalizeIraqiPhone(phone).whatsapp:null
 const workTypes=[...new Set(Array.isArray(value.workTypes)?value.workTypes:[value.schedule])].filter(type=>workOptions.some(item=>item.id===type))
 const experience=value.experience===''||value.experience==null?null:Number(value.experience)
 const skills=(Array.isArray(value.skills)?value.skills:[]).map(item=>clean(item,60)).filter(Boolean).slice(0,8)
 return {id:clean(value.id,180),name,headline:clean(value.headline||value.title,140),role,city,
  qualification:clean(value.qualification,180),bio:clean(value.bio||value.description,1200),skills:[...new Set(skills)],
  experience:Number.isFinite(experience)&&experience>=0&&experience<=60?experience:null,
  availability:availabilityOptions.some(item=>item.id===value.availability)?value.availability:'open',workTypes,
  phone,whatsapp,whatsappEnabled:Boolean(whatsapp),source:source==='demo'?'demo':source==='legacy'?'legacy':source==='platform'?'platform':'local',
  cv:source==='local'&&value.cv&&typeof value.cv.name==='string'?{name:clean(value.cv.name,180),size:Number(value.cv.size)||0}:null,
  updatedAt:typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt))?value.updatedAt:'',
 }
}
export function validateTalent(form){
 const name=clean(form.name,120),phone=normalizeIraqiPhone(form.phone)
 if(!name)throw Error('أدخل اسم الممارس.')
 if(!talentRoles.some(item=>item.id===form.role))throw Error('اختر تخصصاً مهنياً صالحاً.')
 if(!talentCity(form.city))throw Error('اختر المحافظة.')
 if(!phone)throw Error('أدخل رقم هاتف عراقي صالحاً يبدأ بـ 07 أو ‎+964.')
 if(!availabilityOptions.some(item=>item.id===form.availability))throw Error('اختر حالة التفرغ.')
 if(!Array.isArray(form.workTypes)||!form.workTypes.length||form.workTypes.some(type=>!workOptions.some(item=>item.id===type)))throw Error('اختر نوع دوام واحداً على الأقل.')
 if(form.experience!==''&&form.experience!=null&&(!Number.isFinite(Number(form.experience))||Number(form.experience)<0||Number(form.experience)>60))throw Error('أدخل سنوات خبرة بين صفر و60.')
 const profile=normalizeTalent(form)
 if(!profile)throw Error('تعذر قراءة بيانات الملف.')
 return profile
}
export function talentMatches(profile,{query='',city='',role='',availability='',workType='',verifiedOnly=false}={}){
 if(verifiedOnly&&(profile.source!=='platform'||!hasVerifiedCredentials(profile.verification)))return false
 if(city&&profile.city!==talentCity(city))return false
 if(role&&profile.role!==canonicalRole(role))return false
 if(availability&&profile.availability!==availability)return false
 if(workType&&!profile.workTypes.includes(workType))return false
 return matchesSearch(profile.searchText||talentSearchText(profile),query)
}
export function talentSearchText(profile){
 const city=talentCities.find(item=>item.id===profile.city)
 return normalizeSearch([profile.name,profile.headline,profile.qualification,profile.bio,...profile.skills,profile.city,ar(profile.city),...(city?.aliases||[]),profile.role,ar(profile.role),...profile.workTypes.map(type=>workOptions.find(item=>item.id===type)?.label)].join(' '))
}

export function talentContacts(profile){
 if(profile.source==='demo')return {phone:null,whatsapp:null}
 const phone=normalizeIraqiPhone(profile.phone)
 return {phone:phone?`tel:${phone.local}`:null,whatsapp:profile.whatsappEnabled===true&&phone?`https://wa.me/${phone.whatsapp}`:null}
}
export function legacyTalentProfiles(storage){
 try{
  const entries=JSON.parse(storage.getItem('projecta-listings')||'[]')
  return Array.isArray(entries)?entries.filter(item=>item?.type==='candidates').map(item=>normalizeTalent({...item,id:`legacy:${item.id}`},'legacy')).filter(Boolean):[]
 }catch{return []}
}
export async function validateTalentCv(file){
 const spec=resumeFileSpec(file.name,file.size,file.type)
 if(spec.extension!=='pdf')throw Error('اختر ملف PDF لعرض السيرة الذاتية داخل الدليل.')
 const header=new TextDecoder('latin1').decode(await file.slice(0,1024).arrayBuffer())
 if(!header.startsWith('%PDF-'))throw Error('محتوى الملف ليس PDF صالحاً. اختر نسخة PDF أصلية.')
 return {name:spec.filename,size:spec.size,mime:spec.mime}
}

const demoInputs=[
 ['demo-1','د. نور أحمد','طبيبة أسنان عامة','Dentists','Baghdad','بكالوريوس طب وجراحة الفم والأسنان',3,['ترميم الأسنان','العلاج الوقائي','التواصل مع المرضى'],'available',['Full-time','Part-time']],
 ['demo-2','علي حسن','صيدلاني مجتمعي','Pharmacists','Karbala','بكالوريوس صيدلة',4,['الإرشاد الدوائي','إدارة المخزون','مراجعة الوصفات'],'available',['Full-time','Shift']],
 ['demo-3','سارة محمود','ممرضة رعاية سريرية','Assistants & Techs','Babylon','بكالوريوس تمريض',5,['الرعاية التمريضية','العناية بالجروح','مكافحة العدوى'],'open',['Part-time','Shift']],
 ['demo-4','عمر خالد','مندوب علمي وطبي','Medical Reps','Najaf','بكالوريوس صيدلة',2,['التواصل العلمي','إدارة الزيارات','العلاقات مع العيادات'],'available',['Full-time']],
 ['demo-5','د. هبة علي','طبيبة أسنان عامة','Dentists','Erbil','بكالوريوس طب وجراحة الفم والأسنان',6,['علاج الجذور','الترميم التجميلي','التخطيط العلاجي'],'open',['Part-time']],
 ['demo-6','د. أحمد سامي','طبيب عام','General Physicians','Basra','بكالوريوس طب وجراحة عامة',4,['الرعاية الأولية','المتابعة الدورية','التثقيف الصحي'],'available',['Full-time','Shift']],
 ['demo-7','ريم حسين','منسقة عمليات عيادة','Receptionists / Admin','Sulaymaniyah','دبلوم إدارة مؤسسات صحية',3,['تنظيم المواعيد','تجربة المريض','تنسيق الفريق'],'open',['Full-time','Part-time']],
 ['demo-8','مريم ياسين','صيدلانية','Pharmacists','Duhok','بكالوريوس صيدلة',1,['صرف الأدوية','الإرشاد الصحي','تنظيم الصيدلية'],'unavailable',['Part-time','Shift']],
]
export const demoTalent=demoInputs.map(([id,name,headline,role,city,qualification,experience,skills,availability,workTypes])=>normalizeTalent({id,name,headline,role,city,qualification,experience,skills,availability,workTypes,bio:'ملف توضيحي يعرض طريقة تنظيم الخبرات والمؤهلات في دليل الكفاءات الطبية. لا يمثل متقدماً فعلياً.'},'demo'))
