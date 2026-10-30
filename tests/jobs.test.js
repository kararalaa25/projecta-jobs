import test from 'node:test'
import assert from 'node:assert/strict'
import { toJob, telegramUrl } from '../src/jobs.js'
import { createJobsHandler } from '../api/jobs.js'

function response() {
  return { headers: {}, setHeader(key,value) { this.headers[key]=value }, end(body) { this.body=JSON.parse(body) } }
}
test('raw Telegram posts map to real cards without invented medical details', () => {
  const job=toJob({ id:'real', title:'نص المنشور', description:'نص المنشور\nالتفاصيل', role_category:'', location_city:'', employment_type:'full_time', source:'telegram', contact_info:JSON.stringify({parsing_status:'unparsed',source_url:'https://t.me/clinic/1'}) })
  assert.equal(job.raw,true)
  assert.equal(job.live,true)
  assert.equal(job.city,'City not specified')
  assert.equal(job.schedule,'Schedule not specified')
  assert.equal(job.sourceUrl,'https://t.me/clinic/1')
  assert.equal(job.description,'نص المنشور\nالتفاصيل')
  assert.equal(job.phone,null)
})
test('parsed rows map SQL column names and normalize filters',()=>{
  const job=toJob({id:'1',title:'Dentist',location_city:'Baghdad',role_category:'dentist',employment_type:'part_time',salary_range:'100 IQD',contact_info:JSON.stringify({phone:'+9647701234567',telegram:'@clinic_test'})})
  assert.equal(job.role,'Dentists'); assert.equal(job.city,'Baghdad'); assert.equal(job.schedule,'Part-time'); assert.equal(job.salary,'100 IQD'); assert.equal(job.telegram,'clinic_test')
})
test('malformed contacts and unsafe source URLs do not become links',()=>{
  assert.equal(telegramUrl('javascript:alert(1)'),null)
  assert.equal(telegramUrl('https://t.me.evil.test/clinic'),null)
  assert.equal(toJob({contact_info:'plain text',source:'telegram'}).sourceUrl,null)
})
test('feed endpoint selects active public listing fields only',async()=>{
  let selected, filter
  const query={select(fields){selected=fields;return this},eq(...args){filter=args;return this},order(){return this},limit(){return this},abortSignal(){return Promise.resolve({data:[{id:'real'}],error:null})}}
  const res=response()
  await createJobsHandler({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'},()=>({from(table){assert.equal(table,'job_offers');return query}}))({method:'GET'},res)
  assert.equal(res.statusCode,200);assert.deepEqual(res.body.jobs,[{id:'real'}]);assert.deepEqual(filter,['status','active']);assert.ok(!selected.includes('publisher_id'));assert.ok(!JSON.stringify(res).includes('private-test-key'))
})
test('missing config and database failures return safe visible errors',async()=>{
  const missing=response();await createJobsHandler({})({method:'GET'},missing);assert.equal(missing.statusCode,503)
  const failed=response();await createJobsHandler({SUPABASE_URL:'x',SUPABASE_SERVICE_ROLE_KEY:'secret'},()=>{throw Error('secret')})({method:'GET'},failed)
  assert.equal(failed.statusCode,502);assert.ok(!JSON.stringify(failed).includes('secret'))
})
test('feed does not accept write requests',async()=>{
  const res=response();await createJobsHandler({})({method:'POST'},res);assert.equal(res.statusCode,405)
})
