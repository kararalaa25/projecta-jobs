import test from 'node:test'
import assert from 'node:assert/strict'
import {accountApplications} from '../server/account-applications.js'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',applicant='33333333-3333-4333-8333-333333333333',job='44444444-4444-4444-8444-444444444444',foreign='55555555-5555-4555-8555-555555555555',application='66666666-6666-4666-8666-666666666666',asset='77777777-7777-4777-8777-777777777777'
function database(){
 const calls=[],tables={job_offers:[{id:job,publisher_id:owner,title:'طبيب أسنان',status:'active',contact_info:JSON.stringify({company_name:'عيادة المثال',private_data:'SECRET-LICENSE'})},{id:foreign,publisher_id:other,title:'Other employer',contact_info:'{}'}],job_applications:[{id:application,job_id:job,applicant_id:applicant,status:'submitted',created_at:'2026-11-01',cover_letter:'نبذة مهنية للمتقدم',resume_asset_id:asset}],resume_assets:[{id:asset,user_id:applicant,object_path:'private/cv.pdf',state:'ready',filename:'cv.pdf',mime_type:'application/pdf'}]}
 return {calls,auth:{admin:{async getUserById(id){calls.push('identity');assert.equal(id,applicant);return {data:{user:{user_metadata:{full_name:'د. مثال',profession:'Dentists',telegram_username:'doctor_test',phone:'07701234567',license_number:'SECRET-LICENSE'},email:'applicant@example.test',email_confirmed_at:'2026-01-01'}}}}}},storage:{from(){return {async createSignedUrl(path,ttl){calls.push('download');assert.equal(ttl,60);return {data:{signedUrl:'https://example.test/temporary-cv'}}}}}},from(table){calls.push(table);let filters=[],head=false,page=null
  const q={select(fields,options={}){head=options.head;return this},eq(key,value){filters.push(row=>row[key]===value);return this},in(key,values){filters.push(row=>values.includes(row[key]));return this},order(){return this},range(a,b){page=[a,b];return this},async maybeSingle(){return {data:(tables[table]||[]).filter(row=>filters.every(fn=>fn(row)))[0]||null}},then(resolve){const all=(tables[table]||[]).filter(row=>filters.every(fn=>fn(row))),rows=page?all.slice(page[0],page[1]+1):all;return Promise.resolve({data:head?null:rows,count:all.length}).then(resolve)}};return q}}
}
const url=params=>new URL('https://jobs.test/api/applications?'+new URLSearchParams(params))
test('application summaries and job history are scoped to the current account',async()=>{
 const db=database();assert.deepEqual(await accountApplications(db,{id:applicant},url({view:'summary'})),{applications:1,postedJobs:0})
 assert.deepEqual(await accountApplications(db,{id:owner},url({view:'summary'})),{applications:0,postedJobs:1})
 const result=await accountApplications(db,{id:applicant},url({view:'mine'}));assert.equal(result.rows[0].job.title,'طبيب أسنان');assert.equal(result.rows[0].job.company,'عيادة المثال');assert.ok(!JSON.stringify(result).includes('SECRET-LICENSE'))
 const empty=await accountApplications(db,{id:owner},url({view:'mine'}));assert.equal(empty.rows.length,0)
})
test('recruiter applicant and CV access rejects foreign job ownership before identity or storage reads',async()=>{
 for(const view of ['applicants','cv']){const db=database();await assert.rejects(()=>accountApplications(db,{id:owner},url({view,job_id:foreign,application_id:application})),error=>error.status===404);assert.ok(!db.calls.includes('identity'));assert.ok(!db.calls.includes('download'));assert.ok(!db.calls.includes('job_applications'))}
})
test('owned job applicants expose only requested contact data and authorize CV through the application',async()=>{
 const db=database(),result=await accountApplications(db,{id:owner},url({view:'applicants',job_id:job}));assert.equal(result.rows[0].name,'د. مثال');assert.equal(result.rows[0].phone,'07701234567');assert.equal(result.rows[0].hasCv,true);assert.equal(result.rows[0].specialty,'Dentists');assert.equal(result.rows[0].telegram,'doctor_test');assert.ok(!JSON.stringify(result).includes('SECRET-LICENSE'));assert.ok(!JSON.stringify(result).includes('object_path'))
 const cv=await accountApplications(db,{id:owner},url({view:'cv',job_id:job,application_id:application}));assert.equal(cv.expiresIn,60)
 await assert.rejects(()=>accountApplications(db,{id:owner},url({view:'cv',job_id:job,application_id:foreign})),error=>error.status===404)
})
test('invalid pagination and unknown views cannot request unbounded candidate data',async()=>{
 for(const params of [{view:'applicants',offset:'-1'},{view:'unknown'},{view:'mine',offset:'100001'}])await assert.rejects(()=>accountApplications(database(),{id:owner},url(params)),error=>error.status===400)
})
