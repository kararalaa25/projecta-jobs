import test from 'node:test'
import assert from 'node:assert/strict'
import { toJob, telegramUrl, fetchJobsPage } from '../src/jobs.js'
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
  const query={select(fields){selected=fields;return this},eq(...args){filter=args;return this},gt(){return this},order(){return this},limit(){return this},range(){return this},abortSignal(){return Promise.resolve({data:[{id:'real'}],error:null})}}
  const res=response()
  await createJobsHandler({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'},()=>({from(table){assert.equal(table,'job_offers');return query}}))({method:'GET'},res)
  assert.equal(res.statusCode,200);assert.deepEqual(res.body.jobs,[{id:'real'}]);assert.deepEqual(filter,['status','active']);assert.ok(!selected.includes('publisher_id'));assert.ok(!JSON.stringify(res).includes('private-test-key'))
})
test('missing config and database failures return safe visible errors',async()=>{
  const missing=response();await createJobsHandler({})({method:'GET'},missing);assert.equal(missing.statusCode,503)
  const failed=response();await createJobsHandler({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret'},()=>{throw Error('secret')})({method:'GET'},failed)
  assert.equal(failed.statusCode,502);assert.ok(!JSON.stringify(failed).includes('secret'))
})
test('feed does not accept write requests',async()=>{
  const res=response();await createJobsHandler({})({method:'POST'},res);assert.equal(res.statusCode,405)
})
test('pending Telegram rows cannot reach the public feed (active-only query)',async()=>{
  const filters=[]
  const query={select(){return this},eq(...args){filters.push(args);return this},gt(){return this},order(){return this},limit(){return this},range(){return this},abortSignal(){return Promise.resolve({data:[],error:null})}}
  const res=response()
  await createJobsHandler({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'},()=>({from(){return query}}))({method:'GET'},res)
  assert.equal(res.statusCode,200)
  assert.deepEqual(filters.find(f=>f[0]==='status'),['status','active'],'public feed must always filter status=active')
  assert.ok(!filters.some(f=>f[0]==='status'&&f[1]==='pending'),'pending must never be selected for the public feed')
})
test('targeted realtime refetch reads cannot return pending rows',async()=>{
  const filters=[]
  const query={select(){return this},eq(...args){filters.push(args);return this},gt(){return this},in(){return this},order(){return this},range(){return this},abortSignal(){return Promise.resolve({data:[],error:null})}}
  const res=response()
  const id='11111111-1111-4111-8111-111111111111'
  await createJobsHandler({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'},()=>({from(){return query}}))({method:'GET',url:'/api/jobs?ids='+id},res)
  assert.equal(res.statusCode,200)
  assert.deepEqual(filters.find(f=>f[0]==='status'),['status','active'],'targeted reads used by realtime refetch must filter status=active')
})
test('public serialization strips internal classification and review metadata',async()=>{
  const {publicJobOffer}=await import('../server/public-jobs.js')
  const row=publicJobOffer({id:'job',contact_info:JSON.stringify({phone:'07701234567',classification:'mixed',disposition:'job_offer',needs_review:true,review_reasons:['mixed_content']})})
  const meta=JSON.parse(row.contact_info)
  assert.equal(meta.phone,'07701234567')
  for(const key of ['classification','disposition','needs_review','review_reasons'])assert.equal(meta[key],undefined,`internal key ${key} leaked publicly`)
})


test('Iraqi contact normalization and promo filtering',async()=>{
  const {extractContacts,normalizeIraqiPhone,isRejectedPost}=await import('../src/contacts.js')
  assert.deepEqual(normalizeIraqiPhone('+964 770 123 4567'),{local:'07701234567',whatsapp:'9647701234567'})
  assert.deepEqual(extractContacts('مطلوب مساعد واتساب ٠٧٧٠١٢٣٤٥٦٧ https://t.me/clinic_jobs'),{phone:'07701234567',whatsapp:'9647701234567',telegram:'clinic_jobs'})
  assert.equal(isRejectedPost('مطلوب التسجيل في كورس الاسنان بالعيادة'),true)
  assert.equal(isRejectedPost('مطلوب طبيب اسنان للتوظيف في عيادة بغداد'),false)
})
test('raw cards extract actionable contacts without Gemini',()=>{
  const job=toJob({id:'raw',description:'مطلوب طبيب اسنان واتساب 07701234567 @clinic_jobs',source:'telegram',contact_info:'{}'})
  assert.equal(job.phone,'07701234567');assert.equal(job.whatsapp,'9647701234567');assert.equal(job.telegram,'clinic_jobs')
})
test('new database contact columns are read directly',()=>{
  const job=toJob({id:'row',contact_phone:'+9647701234567',contact_telegram:'https://t.me/clinic_jobs',contact_whatsapp:'9647801234567'})
  assert.equal(job.phone,'07701234567');assert.equal(job.telegram,'clinic_jobs');assert.equal(job.whatsapp,'9647801234567')
})

test('public serialization excludes publisher identity and future internal contact metadata',async()=>{
 const {publicJobOffer}=await import('../server/public-jobs.js')
 const row=publicJobOffer({id:'job',publisher_id:'private-user',moderation_notes:'private-note',contact_info:JSON.stringify({phone:'07701234567',company_name:'عيادة',source_text_hash:'internal-hash',moderator_email:'private@example.test',role_categories:['Dentists']})})
 assert.equal(row.publisher_id,undefined);assert.equal(row.moderation_notes,undefined);assert.deepEqual(JSON.parse(row.contact_info),{phone:'07701234567',company_name:'عيادة',role_categories:['Dentists']})
})
test('fetchJobsPage forwards the requested feed and combines the caller signal with a deadline',async()=>{
 const originalFetch=globalThis.fetch
 let url,signal
 globalThis.fetch=async(request,init)=>{url=request;signal=init.signal;return {ok:true,json:async()=>({jobs:[],hasMore:false,total:0})}}
 try{
  assert.deepEqual(await fetchJobsPage(undefined,0,'telegram'),{hasMore:false,total:0,jobs:[]})
  assert.match(url,/offset=0&feed=telegram$/)
  assert.equal(signal.aborted,false)
 }finally{globalThis.fetch=originalFetch}
})
test('caller aborts stay AbortError while the client deadline becomes a retryable timeout',async()=>{
 const originalFetch=globalThis.fetch,originalTimeout=AbortSignal.timeout
 try{
 globalThis.fetch=async(_url,{signal})=>new Promise((_resolve,reject)=>{
  if(signal.aborted)return reject(signal.reason)
  signal.addEventListener('abort',()=>reject(signal.reason),{once:true})
 })
  const controller=new AbortController()
  const aborted=fetchJobsPage(controller.signal)
  controller.abort()
  await assert.rejects(aborted,error=>error.name==='AbortError')
  AbortSignal.timeout=()=>{
   const expired=new AbortController()
   expired.abort(Object.assign(Error('deadline'),{name:'TimeoutError'}))
   return expired.signal
  }
  await assert.rejects(fetchJobsPage(),/انتهت مهلة تحميل فرص العمل/)
 }finally{globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout}
})
