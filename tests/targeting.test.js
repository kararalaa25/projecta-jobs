import test from 'node:test'
import assert from 'node:assert/strict'
import fixtures from '../config/job-targeting-fixtures.json' with {type:'json'}
import {classifyJob} from '../config/job-targeting.js'
import {validateJob} from '../api/publish-job.js'
test('shared target-audience fixtures separate dentists, physicians, assistants, reps and venue names',()=>{
 for(const fixture of fixtures){const result=classifyJob(fixture.title,fixture.description);assert.deepEqual(result.roles,fixture.roles,fixture.title);assert.equal(result.needsReview,fixture.roles.length!==1)}
})
test('manual posting automatically assigns a title-evidenced role rather than an incorrect submitted category',()=>{
 const record=validateJob({title:'مطلوب طبيب عام',company:'عيادة',description:'مطلوب طبيب عام في كربلاء',salary:'حسب الاتفاق',role:'Pharmacists',city:'Karbala',schedule:'Full-time',phone:'07701234567'})
 assert.equal(record.role_category,'General Physicians');assert.deepEqual(JSON.parse(record.contact_info).target_audience,['الأطباء العامون'])
})
