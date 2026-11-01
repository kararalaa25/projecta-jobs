import test from 'node:test'
import assert from 'node:assert/strict'
import {scoreSpecialtyFit,canonicalMatchRole} from '../src/matching_engine.ts'
import {normalizeMatchingProfile,accountMatchingProfile,matchingStorageKey,readMatchingPreference} from '../src/matching/profile.js'
const profile={role:'Dentists',city:'Baghdad',workTypes:['Full-time'],skills:['Orthodontics','Crown prep']}
const job={role:'Dentists',city:'بغداد',schedule:'full_time',description:'مطلوب طبيب أسنان لديه خبرة في تقويم الأسنان وتحضير التيجان.'}
test('complete specialty, governorate, shift and Arabic/English skill matches score 100',()=>{
 const fit=scoreSpecialtyFit(profile,job)
 assert.equal(fit.score,100);assert.equal(fit.coverage,100);assert.deepEqual(fit.matchedSkills,['تقويم الأسنان','تحضير التيجان']);assert.deepEqual(fit.missingSkills,[])
})
test('only declared requirements contribute points and missing fields do not create a perfect match',()=>{
 const roleOnly=scoreSpecialtyFit({role:'Dentists'},{role:'Dentists'})
 assert.equal(roleOnly.score,null);assert.equal(roleOnly.coverage,45);assert.equal(roleOnly.level,'insufficient')
 const sparse=scoreSpecialtyFit(profile,{role:'Dentists',city:'Baghdad'})
 assert.equal(sparse.score,65);assert.equal(sparse.coverage,65)
})
test('medical role mismatch stays low even when location, shifts and transferable skills match',()=>{
 const fit=scoreSpecialtyFit({...profile,role:'Pharmacists'},job)
 assert.ok(fit.score<=35);assert.equal(fit.level,'low');assert.equal(fit.dimensions[0].status,'mismatch')
})
test('skill coverage is calculated over required skills and ignores extra candidate tags',()=>{
 const fit=scoreSpecialtyFit({...profile,skills:['Orthodontics','inventory management','patient care']},job)
 assert.equal(fit.score,90);assert.deepEqual(fit.missingSkills,['تحضير التيجان']);assert.equal(fit.dimensions.find(item=>item.key==='skills').points,10)
 const duplicate=scoreSpecialtyFit({...profile,skills:['Orthodontics','تقويم الأسنان','Crown prep','Crown prep']},job)
 assert.equal(duplicate.score,100);assert.equal(duplicate.matchedSkills.length,2)
})
test('negative or non-required skill statements do not create requirements',()=>{
 const fit=scoreSpecialtyFit(profile,{role:'Dentists',city:'Baghdad',schedule:'Full-time',description:'Orthodontics is not required. لا يشترط تحضير التيجان.'})
 assert.equal(fit.score,80);assert.deepEqual(fit.matchedSkills,[]);assert.equal(fit.dimensions.find(item=>item.key==='skills').status,'unknown')
})
test('negation remains scoped to its own clause or line',()=>{
 const fit=scoreSpecialtyFit(profile,{...job,description:'لا يشترط تقويم الأسنان.\nمطلوب خبرة في تحضير التيجان.\nيفضل خبرة في تقويم الأسنان.'})
 assert.deepEqual(fit.matchedSkills,['تقويم الأسنان','تحضير التيجان'])
})
test('role normalization respects hired role rather than a workplace or degree',()=>{
 for(const [value,expected] of [['مساعد طبيب أسنان','Assistants & Techs'],['مندوب علمي خريج صيدلة','Medical Reps'],['استقبال في صيدلية','Receptionists / Admin'],['طبيب أسنان عام','Dentists'],['General Practitioner','General Physicians'],['Orthodontics','Dentists']])assert.equal(canonicalMatchRole(value),expected)
})
test('all six specialties support exact canonical category comparison',()=>{
 for(const role of ['Dentists','Pharmacists','Assistants & Techs','Medical Reps','General Physicians','Receptionists / Admin'])assert.equal(scoreSpecialtyFit({role,city:'Erbil'},{role,city:'أربيل'}).score,65)
})
test('Iraqi city aliases and multi-governorate offers match explicitly supplied locations',()=>{
 const fit=scoreSpecialtyFit({...profile,city:'الحلة'},{...job,city:'Basra',governorates:['Babylon','Najaf']})
 assert.equal(fit.dimensions.find(item=>item.key==='location').status,'match')
 assert.equal(scoreSpecialtyFit({...profile,city:'Erbil'},job).dimensions.find(item=>item.key==='location').status,'mismatch')
})
test('shift comparisons support declared full-time, part-time and clinical shifts',()=>{
 for(const schedule of ['دوام كامل','Full-time','full_time'])assert.equal(scoreSpecialtyFit(profile,{...job,schedule}).dimensions[2].status,'match')
 assert.equal(scoreSpecialtyFit({...profile,workTypes:['Part-time']},job).dimensions[2].status,'mismatch')
 assert.equal(scoreSpecialtyFit({...profile,workTypes:['Shift']},{...job,schedule:'night shift'}).dimensions[2].status,'match')
})
test('unknown specialties and absent profiles never produce a confident percentage',()=>{
 assert.equal(scoreSpecialtyFit(profile,{...job,role:'Unsorted'}).score,null)
 assert.equal(scoreSpecialtyFit(null,job).score,null)
 assert.equal(scoreSpecialtyFit({},{}).score,null)
})
test('unrelated personal fields cannot alter the fit score',()=>{
 assert.deepEqual(scoreSpecialtyFit({...profile,name:'A',gender:'female',age:20},job),scoreSpecialtyFit({...profile,name:'B',gender:'male',age:60},job))
})
test('local matching profiles allow only requested preferences and discard credentials and private assets',()=>{
 const normalized=normalizeMatchingProfile({...profile,verified:true,phone:'07701234567',cv_url:'https://private.example',skills:['Orthodontics','Orthodontics']})
 assert.equal(normalized.verified,undefined);assert.equal(normalized.phone,undefined);assert.equal(normalized.cv_url,undefined);assert.equal(normalized.skills.length,1)
 assert.equal(normalizeMatchingProfile({role:'Unknown'}),null)
})
test('account profile fallback and local preference keys stay separated by account',()=>{
 assert.equal(accountMatchingProfile({id:'a',app_metadata:{professional_specialty:'Dentists'},user_metadata:{city:'Baghdad',skills:['Crown prep']}}).city,'Baghdad')
 assert.notEqual(matchingStorageKey({id:'a'}),matchingStorageKey({id:'b'}));assert.notEqual(matchingStorageKey(null),matchingStorageKey({id:'a'}))
 const preference=readMatchingPreference({getItem:()=>JSON.stringify({enabled:false,profile})},'test');assert.equal(preference.disabled,true)
 assert.equal(readMatchingPreference({getItem:()=>'{bad'},'test').profile,null)
})

test('recommendation filtering reacts to specialty, governorate, shifts and bilingual skills',async()=>{
 const {isSpecialtyRecommendation}=await import('../src/matching_engine.ts')
 const job={role:'Dentists',city:'Baghdad',schedule:'Full-time',description:'خبرة تقويم الأسنان وتحضير التيجان'}
 const preferences={role:'Dentists',city:'Baghdad',workTypes:['Full-time'],skills:['Orthodontics']}
 assert.equal(isSpecialtyRecommendation(preferences,job),true)
 assert.equal(isSpecialtyRecommendation({...preferences,role:'Pharmacists'},job),false)
 assert.equal(isSpecialtyRecommendation({...preferences,city:'Erbil'},job),false)
 assert.equal(isSpecialtyRecommendation({...preferences,workTypes:['Part-time']},job),false)
 assert.equal(isSpecialtyRecommendation({...preferences,skills:['Wound care']},job),false)
 assert.equal(isSpecialtyRecommendation(preferences,{...job,city:''}),false)
 assert.equal(isSpecialtyRecommendation(preferences,{...job,description:'مطلوب طبيب أسنان'}),true)
})
