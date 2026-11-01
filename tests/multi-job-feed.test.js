import test from 'node:test'
import assert from 'node:assert/strict'
import {visibleJobs} from '../src/jobs.js'

const row=(id,title,description,status)=>({id,title,description,source:'telegram',role_category:'Pharmacists',location_city:'Baghdad',contact_info:JSON.stringify({parsing_status:status,role_categories:['Pharmacists'],source_url:'https://t.me/clinic/17'})})
test('short grounded multi-job extracts remain visible and retain their shared original source',()=>{
 const jobs=visibleJobs([row('1','صيدلاني','2. مطلوب صيدلاني','parsed'),row('2','صيدلاني','مطلوب صيدلاني لديه دورة إسعافات أولية في بغداد','parsed')])
 assert.equal(jobs.length,2)
 for(const job of jobs){assert.equal(job.sourceUrl,'https://t.me/clinic/17');assert.deepEqual(job.roles,['Pharmacists'])}
})
test('empty extractions and unparsed promotions remain excluded',()=>{
 assert.equal(visibleJobs([row('1','','','parsed'),row('2','دورة','دورة تدريبية للصيادلة في بغداد والتسجيل مطلوب','unparsed')]).length,0)
})
