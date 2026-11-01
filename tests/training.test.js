import test from 'node:test'
import assert from 'node:assert/strict'
import {demoCourses,courseMatches,coursePhase,courseDate,courseTime,baghdadDateTime,localCourseDateTime,validateCourse,normalizeCourse,safeRegistrationUrl,registrationActions,saveCourse,loadCourses,removeCourse} from '../src/training/data.js'
const now=Date.parse('2026-11-01T00:00:00Z')
const course={id:'local-course',title:'ورشة تقويم الأسنان',role:'Dentists',city:'Baghdad',kind:'hands_on',startsAt:'2026-11-20T06:00:00Z',endsAt:'2026-11-20T11:00:00Z',instructor:'اسم مدرب محلي',credentials:'اختصاص معلن',phone:'07701234567',whatsappEnabled:true,registrationUrl:'https://example.org/register',description:'تطبيق على نماذج تدريبية'}
test('CME gallery covers courses, hands-on workshops, orthodontics and medical representative programs',()=>{
 assert.equal(demoCourses.length,7)
 for(const type of ['hands_on','seminar','course','program'])assert.ok(demoCourses.some(course=>course.kind===type))
 for(const role of ['Dentists','Pharmacists','Assistants & Techs','Medical Reps','General Physicians','Receptionists / Admin'])assert.ok(demoCourses.some(course=>course.role===role))
})
test('demo events never permit registration or manufacture accreditation claims',()=>{
 for(const item of demoCourses){assert.equal(item.source,'demo');assert.deepEqual(registrationActions(item,now),{registration:null,whatsapp:null,phone:null});assert.equal(item.cme_credits,undefined)}
 assert.equal(normalizeCourse({...course,cme_credits:10,verified:true}).verified,undefined)
})
test('local event registration uses validated links and opt-in contacts',()=>{
 const value=validateCourse(course)
 assert.deepEqual(registrationActions(value,now),{registration:'https://example.org/register',phone:'tel:07701234567',whatsapp:'https://wa.me/9647701234567'})
 assert.equal(registrationActions({...value,whatsappEnabled:false},now).whatsapp,null)
 assert.deepEqual(registrationActions(value,Date.parse('2026-11-21T00:00:00Z')),{registration:null,whatsapp:null,phone:null})
})
test('unsafe registration URLs and malformed dates or instructor details reject',()=>{
 for(const url of ['javascript:alert(1)','http://example.org','https://user:password@example.org'])assert.equal(safeRegistrationUrl(url),null)
 for(const override of [{startsAt:'bad'},{endsAt:course.startsAt},{city:'Unknown'},{role:'Unknown'},{instructor:''},{credentials:''},{registrationUrl:'javascript:alert(1)'},{phone:'123'},{phone:'',registrationUrl:''}])assert.throws(()=>validateCourse({...course,...override}))
})
test('dates are parsed and formatted explicitly in Asia/Baghdad',()=>{
 assert.equal(baghdadDateTime('2026-11-20T09:00'),'2026-11-20T06:00:00.000Z')
 assert.equal(localCourseDateTime('2026-11-20T06:00:00Z'),'2026-11-20T09:00')
 assert.equal(baghdadDateTime('2026-02-30T09:00'),'')
 const reference=new Intl.DateTimeFormat('ar-IQ',{timeZone:'Asia/Baghdad',day:'numeric',month:'long',year:'numeric'}).format(new Date('2026-11-01T23:30:00Z'))
 assert.equal(courseDate('2026-11-01T23:30:00Z'),reference);assert.ok(courseTime(course.startsAt))
})
test('course phase handles upcoming, in-progress and ended events',()=>{
 assert.equal(coursePhase(course,now),'upcoming');assert.equal(coursePhase(course,Date.parse(course.startsAt)),'ongoing');assert.equal(coursePhase(course,Date.parse(course.endsAt)),'ended')
 assert.equal(coursePhase({...course,endsAt:'bad'},now),'unscheduled')
})
test('course search and location/specialty/type/date filters combine correctly',()=>{
 const value=validateCourse(course)
 assert.equal(courseMatches(value,{query:'تقويم بغداد',city:'Baghdad',role:'Dentists',kind:'hands_on',phase:'upcoming'},now),true)
 for(const filter of [{query:'صيدلة'},{city:'Erbil'},{role:'Pharmacists'},{kind:'seminar'},{phase:'ended'}])assert.equal(courseMatches(value,filter,now),false)
})
test('local events persist, update and delete without remote data access',()=>{
 let stored=null;const storage={getItem:()=>stored,setItem:(_key,value)=>{stored=value}}
 saveCourse(storage,course);assert.equal(loadCourses(storage).length,1)
 saveCourse(storage,{...course,title:'عنوان محدث'});assert.equal(loadCourses(storage)[0].title,'عنوان محدث');assert.equal(loadCourses(storage).length,1)
 removeCourse(storage,course.id);assert.equal(loadCourses(storage).length,0)
 assert.deepEqual(loadCourses({getItem:()=>'{bad'}),[])
 assert.throws(()=>saveCourse({getItem:()=>null,setItem:()=>{throw Error('quota')}},course),/تعذر حفظ/)
})
