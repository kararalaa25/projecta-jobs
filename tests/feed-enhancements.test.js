import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {hasVerifiedCredentials} from '../config/profile-trust.js'
import {talentMatches} from '../src/talent/data.js'
import {quickApplyContact} from '../src/quick-apply.js'
import {JOB_LIFETIME_MS,isJobFresh} from '../config/job-lifecycle.js'
import {authorizedDispatcher,dispatchJobBroadcasts} from '../server/job-broadcasts.js'
import {createApplicationsHandler} from '../api/applications.js'
import {createJobsHandler} from '../api/jobs.js'
import {createPlatformHandler} from '../api/platform.js'
const verified={status:'verified',kind:'clinic',credentials:['facility_license']}
const id='11111111-1111-4111-8111-111111111111',application='22222222-2222-4222-8222-222222222222'
const response=()=>({setHeader(){},end(body){this.body=JSON.parse(body)}})
test('credential filter excludes unreviewed, imported, sample and local claims',()=>{
 assert.ok(hasVerifiedCredentials(verified))
 assert.ok(hasVerifiedCredentials({status:'verified',kind:'dentist',credentials:['syndicate_membership']}))
 for(const trust of [{...verified,status:'checking'},{...verified,status:'rejected'},{...verified,credentials:[]},{status:'verified',kind:'dentist',credentials:['facility_license']}])assert.equal(hasVerifiedCredentials(trust),false)
 const profile={name:'طبيبة',skills:[],source:'platform',verification:{status:'verified',kind:'dentist',credentials:['syndicate_membership']},workTypes:[]}
 assert.equal(talentMatches(profile,{verifiedOnly:true}),true)
 for(const source of ['local','legacy','demo'])assert.equal(talentMatches({...profile,source},{verifiedOnly:true}),false)
})
test('quick apply uses real validated job contacts, prefills a safe message and falls back to Telegram',()=>{
 const job={type:'jobs',live:true,title:'طبيب & مساعد',phone:'٠٧٧٠١٢٣٤٥٦٧',telegram:'@clinic_jobs'}
 const contact=quickApplyContact(job),url=new URL(contact.href)
 assert.equal(contact.channel,'whatsapp');assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/9647701234567');assert.ok(url.searchParams.get('text').includes(job.title))
 assert.equal(quickApplyContact({...job,phone:'invalid'}).channel,'telegram')
 for(const extra of [{sample:true},{live:false},{type:'candidates'},{phone:'invalid',telegram:'javascript:alert(1)'}])assert.equal(quickApplyContact({...job,...extra}),null)
})
test('expiry boundary is exactly 30 days and employer renewal overrides original publication',()=>{
 const published=Date.parse('2026-10-01T00:00:00Z'),now=published+JOB_LIFETIME_MS
 assert.equal(isJobFresh({created_at:new Date(published).toISOString()},now-1),true)
 assert.equal(isJobFresh({created_at:new Date(published).toISOString()},now),false)
 assert.equal(isJobFresh({created_at:new Date(published).toISOString(),renewed_at:new Date(now).toISOString()},now),true)
 assert.equal(isJobFresh({expires_at:'invalid',created_at:new Date(now).toISOString()},now),false)
 assert.equal(isJobFresh({},now),false)
})
const webhookEnv={TELEGRAM_JOB_WEBHOOK_URL:'https://receiver.example/telegram',WHATSAPP_JOB_WEBHOOK_URL:'https://receiver.example/whatsapp',JOB_BROADCAST_WEBHOOK_SECRET:'s'.repeat(40)}
function broadcastDatabase({revoked=false,expired=false}={}){
 const finishes=[],claims=[]
 return {finishes,claims,auth:{admin:{async getUserById(){return {data:{user:{email_confirmed_at:'2026-01-01',app_metadata:{profile_kind:'clinic',organization_verified:!revoked,verified_credentials:{facility_license:true}}}}}}}},from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{id,publisher_id:'private-owner',source:'manual',status:'active',title:'طبيب',expires_at:expired?'2020-01-01':'2099-01-01',contact_info:JSON.stringify({company_name:'عيادة',license_url:'private-license',moderation_notes:'private-note'})}}}}},async rpc(name,args){if(name==='projecta_claim_job_broadcasts'){claims.push(args);return {data:args.p_channels.map(channel=>({id:`event-${channel}`,job_id:id,channel,lease_token:'lease',created_at:'2026-11-10'}))}}finishes.push(args);return {data:null}}}
}
test('broadcast signs public payloads, separates provider delivery and preserves idempotency keys',async()=>{
 const db=broadcastDatabase(),requests=[]
 const result=await dispatchJobBroadcasts(db,webhookEnv,{jobId:id,fetcher:async(url,init)=>{requests.push({url,init});return {ok:!url.endsWith('whatsapp')}}})
 assert.deepEqual(result,{configured:true,delivered:1,failed:1,cancelled:0});assert.equal(db.finishes.length,2)
 for(const {init} of requests){const body=JSON.parse(init.body),timestamp=init.headers['X-Projecta-Timestamp'];assert.equal(body.job.id,id);assert.ok(!init.body.includes('private-'));assert.equal(init.headers['Idempotency-Key'],body.id);assert.equal(init.headers['X-Projecta-Signature'],'sha256='+createHmac('sha256',webhookEnv.JOB_BROADCAST_WEBHOOK_SECRET).update(`${timestamp}.${init.body}`).digest('hex'));assert.equal(init.redirect,'error')}
})
test('broadcast configuration and current trust/expiry are checked before any outbound delivery',async()=>{
 let calls=0
 for(const options of [{revoked:true},{expired:true}]){const result=await dispatchJobBroadcasts(broadcastDatabase(options),webhookEnv,{fetcher:async()=>{calls++;throw Error('unexpected')}});assert.equal(result.cancelled,2)}
 assert.equal(calls,0)
 const db=broadcastDatabase();assert.equal((await dispatchJobBroadcasts(db,{})).configured,false);assert.equal(db.claims.length,0)
 assert.equal(authorizedDispatcher('Bearer short','short'),false);assert.ok(authorizedDispatcher('Bearer '+'x'.repeat(40),'x'.repeat(40)));assert.equal(authorizedDispatcher('Bearer wrong','x'.repeat(40)),false)
})
test('broadcast retry route rejects unauthenticated callers before opening a privileged client',async()=>{
 const res=response();await createPlatformHandler({},()=>{throw Error('must not create a client')})({method:'POST',url:'/?action=dispatch-jobs',headers:{}},res);assert.equal(res.statusCode,401)
})
test('employer application stages use an ownership-checking RPC and validate IDs/status first',async()=>{
 const calls=[],user={id,email_confirmed_at:'2026-01-01'},db={auth:{async getUser(){return {data:{user}}}},from(table){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{value:{maintenance:false}}}},async order(){return {data:[]}}}},async rpc(name,args){calls.push({name,args});return {data:args.p_job===id?{id:application,status:args.p_status}:null}}}
 const handler=createApplicationsHandler({},()=>db)
 const invoke=async(body)=>{const res=response();await handler({method:'POST',headers:{authorization:'Bearer mock'},body},res);return res}
 for(const status of ['viewed','shortlisted','archived'])assert.equal((await invoke({action:'application.status',job_id:id,application_id:application,status})).statusCode,200)
 assert.equal(calls[0].name,'projecta_application_status');assert.equal(calls[0].args.p_actor,user.id)
 assert.equal((await invoke({action:'application.status',job_id:application,application_id:application,status:'viewed'})).statusCode,404)
 assert.equal((await invoke({action:'application.status',job_id:id,application_id:application,status:'invented'})).statusCode,400)
 assert.equal((await invoke({action:'application.status',job_id:'invalid',application_id:application,status:'viewed'})).statusCode,400)
})

test('public feed applies a database expiry predicate before pagination, including legacy fallback',async()=>{
 for(const legacy of [false,true]){
  const predicates=[],fields=[];let attempt=0
  const query={select(value){fields.push(value);return this},eq(){return this},gt(column,value){predicates.push({column,value});return this},order(){return this},range(){return this},async abortSignal(){return legacy&&attempt++<2?{error:{code:'42703'}}:{data:[]}}}
  const res=response(),before=Date.now()
  await createJobsHandler({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'},()=>({from(){return query}}))({method:'GET'},res)
  assert.equal(res.statusCode,200);assert.equal(predicates[0].column,'expires_at');assert.ok(Date.parse(predicates[0].value)>=before)
  if(legacy){assert.equal(predicates[2].column,'created_at');assert.ok(Math.abs(Date.parse(predicates[2].value)-(Date.now()-JOB_LIFETIME_MS))<1000)}
 }
})
test('expired jobs reject application submissions even while archive cleanup is pending',async()=>{
 let inserted=false
 const db={auth:{async getUser(){return {data:{user:{id,email_confirmed_at:'2026-01-01'}}}}},from(table){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{value:{maintenance:false}}}},async order(){return {data:[]}},async single(){return {data:{id,status:'active',expires_at:'2020-01-01'}}},insert(){inserted=true;return this}}}}
 const res=response();await createApplicationsHandler({},()=>db)({method:'POST',headers:{authorization:'Bearer mock'},body:{job_id:id,cover_letter:'نبذة مهنية للاختبار'}},res)
 assert.equal(res.statusCode,400);assert.equal(inserted,false)
})
