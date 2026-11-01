import test from 'node:test'
import assert from 'node:assert/strict'
import {demoTalent,talentRoles,talentCities,talentCity,normalizeTalent,validateTalent,talentMatches,talentContacts,legacyTalentProfiles,validateTalentCv} from '../src/talent/data.js'
const valid={id:'local-fixture',name:'د. ليلى أحمد',role:'Dentists',city:'Baghdad',availability:'available',workTypes:['Full-time','Shift'],phone:'07701234567',whatsappEnabled:true,qualification:'بكالوريوس طب الأسنان',skills:['ترميم الأسنان','رعاية المرضى'],experience:3}
test('talent directory covers all Iraqi governorates and all six professional categories',()=>{
 assert.equal(talentCities.length,18);assert.equal(talentRoles.length,6);assert.equal(demoTalent.length,8)
 for(const city of ['Baghdad','Karbala','Babylon','Najaf','Erbil'])assert.ok(talentCities.some(item=>item.id===city))
 assert.equal(new Set(demoTalent.map(profile=>profile.role)).size,6)
})
test('governorate filters accept Arabic and English Iraqi aliases',()=>{
 for(const [value,expected] of [['بغداد','Baghdad'],['كربلاء','Karbala'],['Babil','Babylon'],['الحلة','Babylon'],['Najaf','Najaf'],['أَربيل','Erbil']])assert.equal(talentCity(value),expected)
 assert.equal(talentCity('Unspecified'),'')
})
test('instant search matches normalized Arabic names, credentials and clinical expertise',()=>{
 const profile=validateTalent(valid)
 for(const query of ['ليلى','اسنان','رعاية بغداد','Dentists','بكالوريوس'])assert.equal(talentMatches(profile,{query}),true,query)
 assert.equal(talentMatches(profile,{query:'صيدلي'}),false)
 assert.equal(talentMatches(normalizeTalent({...valid,city:'Babylon'}),{query:'الحلة'}),true)
})
test('governorate, specialty, availability and work-type filters combine with AND',()=>{
 const profile=validateTalent(valid)
 assert.equal(talentMatches(profile,{city:'بغداد',role:'Dentists',availability:'available',workType:'Shift'}),true)
 for(const filter of [{city:'Erbil'},{role:'Pharmacists'},{availability:'open'},{workType:'Part-time'}])assert.equal(talentMatches(profile,filter),false)
})
test('direct contact URLs use validated Iraqi phone numbers and explicit WhatsApp choice',()=>{
 assert.deepEqual(talentContacts(validateTalent(valid)),{phone:'tel:07701234567',whatsapp:'https://wa.me/9647701234567'})
 assert.equal(talentContacts(validateTalent({...valid,whatsappEnabled:false})).whatsapp,null)
 assert.equal(talentContacts({...validateTalent(valid),source:'demo'}).phone,null)
 assert.deepEqual(talentContacts({source:'local',phone:'javascript:alert(1)',whatsappEnabled:true}),{phone:null,whatsapp:null})
})
test('local profiles discard verification, remote CV links and arbitrary credential claims',()=>{
 const value=normalizeTalent({...valid,verification:{status:'verified'},source:'server',verified:true,verified_credentials:{syndicate_membership:true},cv_url:'https://private.example/resume',publisher_id:'private'})
 assert.equal(value.source,'local');assert.equal(value.verification,undefined);assert.equal(value.verified_credentials,undefined);assert.equal(value.cv_url,undefined);assert.equal(value.publisher_id,undefined)
})
test('invalid specialties, locations, phone numbers and unavailable work choices are rejected',()=>{
 for(const overrides of [{name:''},{role:'Unknown'},{city:'Unknown'},{phone:'123'},{workTypes:[]},{workTypes:['Locum']},{experience:-1},{experience:61},{availability:'random'}])assert.throws(()=>validateTalent({...valid,...overrides}))
})
test('local profile normalization bounds expertise and removes duplicates',()=>{
 const profile=normalizeTalent({...valid,skills:['ترميم','ترميم',...Array.from({length:20},(_,i)=>'مهارة '+i)]})
 assert.ok(profile.skills.length<=8);assert.equal(new Set(profile.skills).size,profile.skills.length)
 assert.equal(normalizeTalent({...valid,name:{ar:'doctor'}}),null)
})
test('legacy device profiles are imported without private assets or trust claims',()=>{
 const storage={getItem:()=>JSON.stringify([{...valid,id:'old',type:'candidates',company:valid.name,source:'server',verification:{status:'verified'},cv:{name:'secret.pdf',size:123}},{...valid,type:'jobs'}])}
 const profiles=legacyTalentProfiles(storage);assert.equal(profiles.length,1);assert.equal(profiles[0].source,'legacy');assert.equal(profiles[0].id,'legacy:old');assert.equal(profiles[0].cv,null);assert.equal(profiles[0].verification,undefined)
 for(const getItem of [()=>'{invalid',()=>'{"private":true}',()=>{throw Error('storage blocked')}])assert.deepEqual(legacyTalentProfiles({getItem}),[])
})
test('demo profiles never contain actionable contact numbers or fake resume files',()=>{
 for(const profile of demoTalent){assert.equal(profile.source,'demo');assert.equal(profile.phone,null);assert.equal(profile.cv,null);assert.deepEqual(talentContacts(profile),{phone:null,whatsapp:null})}
})
test('CV preview accepts PDF contents and a bounded sanitized filename',async()=>{
 const file=new File(['%PDF-1.4\nfixture'], 'سيرة ذاتية.pdf',{type:'application/pdf'})
 const meta=await validateTalentCv(file);assert.equal(meta.mime,'application/pdf');assert.equal(meta.name,'سيرة ذاتية.pdf');assert.equal(meta.size,file.size)
})
test('CV upload rejects renamed HTML, unsupported documents, empty and oversized files',async()=>{
 for(const file of [new File(['<html>not pdf</html>'],'fake.pdf',{type:'application/pdf'}),new File(['%PDF-1.4'],'resume.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),new File([],'empty.pdf',{type:'application/pdf'}),new File([new Uint8Array(5*1024*1024+1)],'large.pdf',{type:'application/pdf'})])await assert.rejects(validateTalentCv(file))
})
