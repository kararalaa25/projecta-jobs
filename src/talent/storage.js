import {normalizeTalent,validateTalentCv} from './data.js'
const DATABASE='projecta-talent-local-v1'
function openDatabase(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('التخزين المحلي غير متاح في هذا المتصفح.'));return}
  const request=indexedDB.open(DATABASE,1)
  request.onupgradeneeded=()=>{const db=request.result;for(const store of ['profiles','resumes'])if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'id'})}
  request.onerror=()=>reject(Error('تعذر فتح ملفاتك المحلية. تحقق من إعدادات التخزين في المتصفح.'))
  request.onblocked=()=>reject(Error('أغلق نوافذ الدليل الأخرى ثم حاول مجدداً.'))
  request.onsuccess=()=>resolve(request.result)
 })
}
async function transaction(stores,mode,action){
 const db=await openDatabase()
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode)
  let result
  tx.oncomplete=()=>resolve(typeof result==='function'?result():result)
  tx.onabort=tx.onerror=()=>reject(Error('تعذر حفظ التغييرات. قد تكون مساحة التخزين ممتلئة؛ لم يتم تأكيد الحفظ.'))
  try{result=action(tx)}catch(error){tx.abort();reject(error)}
 })}finally{db.close()}
}
export function loadTalentProfiles(){
 return transaction(['profiles'],'readonly',tx=>{const request=tx.objectStore('profiles').getAll();return()=>request.result.map(profile=>normalizeTalent(profile)).filter(Boolean)})
}
export async function saveTalentProfile(profile,file,{removeCv=false}={}){
 const cv=file?await validateTalentCv(file):removeCv?null:profile.cv
 const safe=normalizeTalent({...profile,cv,updatedAt:new Date().toISOString()})
 if(!safe)throw Error('بيانات الملف غير صالحة.')
 await transaction(['profiles','resumes'],'readwrite',tx=>{
  tx.objectStore('profiles').put(safe)
  if(file)tx.objectStore('resumes').put({id:safe.id,blob:new Blob([file],{type:'application/pdf'}),name:cv.name,size:cv.size})
  else if(removeCv)tx.objectStore('resumes').delete(safe.id)
 })
 return safe
}
export function loadTalentCv(id){
 return transaction(['resumes'],'readonly',tx=>{const request=tx.objectStore('resumes').get(id);return()=>request.result||null})
}
export function deleteTalentProfile(id){
 return transaction(['profiles','resumes'],'readwrite',tx=>{tx.objectStore('profiles').delete(id);tx.objectStore('resumes').delete(id)})
}
