import test from 'node:test'
import assert from 'node:assert/strict'
import {profileTrust,publicProfileTrust,normalizeProfileTrust} from '../config/profile-trust.js'
import {listingTrust} from '../server/profile-trust.js'
import {createProfileTrustHandler} from '../api/profile-trust.js'
import {listingVerification} from '../src/useJobTrust.js'
import {canPublish} from '../config/access.js'
const user=(app_metadata={},extra={})=>({id:'private-person',email:'private@example.test',email_confirmed_at:'2026-10-30T00:00:00Z',app_metadata,...extra})
const approved={medical_professional_verified:true,verification_status:'approved',profile_kind:'dentist',verified_credentials:{syndicate_membership:true,certified_specialist:true}}
const id='11111111-1111-4111-8111-111111111111'
const id2='22222222-2222-4222-8222-222222222222'

test('verification uses explicit trusted professional claims and separate credential approvals',()=>{
 assert.deepEqual(profileTrust(user(approved)),{status:'verified',kind:'dentist',credentials:['syndicate_membership','certified_specialist']})
 assert.deepEqual(profileTrust(user({...approved,verified_credentials:{syndicate_membership:'true',certified_specialist:false}})).credentials,[])
 assert.equal(profileTrust(user({medical_professional_verified:true,professional_specialty:'Pharmacists'})).kind,'pharmacist')
 assert.equal(profileTrust(user({medical_professional_verified:true,professional_specialty:'Assistants & Techs'})).kind,'professional')
})
test('user claims, email confirmation and owner publishing rights cannot create professional badges',()=>{
 assert.equal(profileTrust(user({}, {user_metadata:approved})).status,'unverified')
 assert.equal(profileTrust(user({}, {user_metadata:{license_number:'123',license_url:'https://private.example/license',syndicate_membership:true}})).status,'unverified')
 const owner=user({}, {email:'kararalkhafaji892@gmail.com'})
 assert.equal(canPublish(owner),true);assert.equal(profileTrust(owner).status,'unverified')
})
test('suspension, missing confirmed identity and pending or rejected review remove verification',()=>{
 for(const account of [user({...approved,suspended:true}),user(approved,{email_confirmed_at:null}),user({...approved,verification_status:'pending'}),user({...approved,verification_status:'rejected'})]){
  const trust=profileTrust(account);assert.notEqual(trust.status,'verified');assert.deepEqual(trust.credentials,[])
 }
})
test('clinic and medical center badges require their own organization approval',()=>{
 for(const kind of ['clinic','medical_center']){
  assert.equal(profileTrust(user({...approved,profile_kind:kind})).status,'unverified')
  const trust=profileTrust(user({profile_kind:kind,organization_verified:true,verified_credentials:{facility_license:true,syndicate_membership:true}}))
  assert.equal(trust.status,'verified');assert.equal(trust.kind,kind);assert.deepEqual(trust.credentials,['facility_license'])
 }
})
test('public summaries exclude private review states, contact data and license documents',()=>{
 const pending=publicProfileTrust(user({verification_status:'pending'},{user_metadata:{license_number:'private-license'}}))
 assert.equal(pending.status,'unverified');assert.deepEqual(Object.keys(pending),['status','kind','credentials'])
 assert.equal(JSON.stringify(pending).includes('private'),false)
 assert.deepEqual(normalizeProfileTrust({status:'verified',kind:'dentist',credentials:['syndicate_membership','syndicate_membership','invented','facility_license']}),{status:'verified',kind:'dentist',credentials:['syndicate_membership']})
})
test('listing lookups deduplicate publishers and never authenticate imported Telegram posts',async()=>{
 const looked=[]
 const db={auth:{admin:{async getUserById(value){looked.push(value);return {data:{user:user(approved)}}}}}}
 const rows=await listingTrust(db,[{id,source:'manual',publisher_id:'private-person'},{id:id2,source:'manual',publisher_id:'private-person'},{id:'telegram',source:'telegram',publisher_id:'untrusted',contact_info:JSON.stringify(approved)}])
 assert.deepEqual(looked,['private-person']);assert.equal(rows[0].verification.status,'verified');assert.equal(rows[2].verification.status,'unverified')
 assert.equal(JSON.stringify(rows).includes('private-person'),false);assert.equal(JSON.stringify(rows).includes('private@example.test'),false)
})
test('lookup failures cannot show a stale verified credential and do not hide listings',async()=>{
 const rows=await listingTrust({auth:{admin:{async getUserById(){throw Error('private secret')}}}},[{id,source:'manual',publisher_id:'private-person'}])
 assert.equal(rows.length,1);assert.equal(rows[0].verification.status,'unavailable');assert.deepEqual(rows[0].verification.credentials,[])
 assert.equal(JSON.stringify(rows).includes('secret'),false)
})
test('local and sample talent profiles cannot promote stored trust claims into badges',()=>{
 for(const job of [{id,source:'manual',sample:true,live:true},{id,source:'telegram',live:true},{id,type:'candidates',verification:{status:'verified'}}]){
  assert.equal(listingVerification(job,{[id]:{status:'verified',kind:'dentist'}}).status,'unverified')
 }
 assert.equal(listingVerification({id,source:'manual',live:true},{}).status,'checking')
})
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=JSON.parse(body)}}}
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-key'}
test('public trust endpoint restricts queries to requested active listings and returns minimal no-store summaries',async()=>{
 const filters=[];let selected
 const query={select(v){selected=v;return this},eq(...args){filters.push(args);return this},in(...args){filters.push(args);return this},async abortSignal(){return {data:[{id,source:'manual',publisher_id:'private-person'}]}}}
 const db={from(table){assert.equal(table,'job_offers');return query},auth:{admin:{async getUserById(){return {data:{user:user(approved)}}}}}}
 const res=response();await createProfileTrustHandler(env,()=>db)({method:'GET',url:`/?ids=${id}`},res)
 assert.equal(res.statusCode,200);assert.equal(res.body.jobs[0].verification.status,'verified')
 assert.deepEqual(filters,[['status','active'],['id',[id]]]);assert.equal(selected,'id,publisher_id,source')
 assert.match(res.headers['Cache-Control'],/no-store/);assert.equal(JSON.stringify(res.body).includes('private'),false)
})
test('invalid IDs, writes and missing credentials reject before constructing a database client',async()=>{
 let calls=0;const factory=()=>{calls++;throw Error('must not run')}
 for(const [request,expected] of [[{method:'POST',url:'/'},405],[{method:'GET',url:'/?ids=private-person'},400],[{method:'GET',url:'/'},400],[{method:'GET',url:'/?ids='+Array(25).fill(id).join(',')},400]]){
  const res=response();await createProfileTrustHandler(env,factory)(request,res);assert.equal(res.statusCode,expected)
 }
 const missing=response();await createProfileTrustHandler({},factory)({method:'GET',url:`/?ids=${id}`},missing);assert.equal(missing.statusCode,503);assert.equal(calls,0)
})
test('lookup concurrency remains bounded to four and failures stay isolated',async()=>{
 let active=0,max=0
 const db={auth:{admin:{async getUserById(value){active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;return value==='bad'?{error:new Error('private')}:{data:{user:user(approved)}}}}}}
 const rows=Array.from({length:12},(_,i)=>({id:String(i),source:'manual',publisher_id:i===0?'bad':String(i)}))
 const result=await listingTrust(db,rows);assert.equal(max,4);assert.equal(result[0].verification.status,'unavailable');assert.equal(result[1].verification.status,'verified')
})
