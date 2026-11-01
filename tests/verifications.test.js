import test from 'node:test'
import assert from 'node:assert/strict'
import {profileCompletion,profileDraft} from '../config/account-profile.js'
import {profileTrust} from '../config/profile-trust.js'
import {canPublish} from '../config/access.js'
import {getPrivateProfile,changeProfile,saveProfile,submitVerification,withdrawVerification,reviewVerification,requestOf} from '../server/verifications.js'
import {createVerificationsHandler} from '../api/verifications.js'
import {createAdminHandler} from '../api/admin.js'
import {subscribeTrustEvents} from '../src/trust-events.js'
const owner={id:'11111111-1111-4111-8111-111111111111',email:'kararalkhafaji20@gmail.com',email_confirmed_at:'2026-01-01',app_metadata:{},user_metadata:{}}
const member={id:'22222222-2222-4222-8222-222222222222',email:'member@example.test',email_confirmed_at:'2026-01-01',app_metadata:{existing:'retained'},user_metadata:{full_name:'طبيب الاختبار',profession:'Dentists',profile_kind:'dentist',governorate:'Baghdad',phone:'07701234567',license_number:'TEST-123',license_url:'https://example.org/license'}}
const clone=value=>structuredClone(value)
function database(user=member){
 const users=new Map([[owner.id,clone(owner)],[user.id,clone(user)]]),profiles=new Map(),assets=new Map(),audits=[],messages=[],authWrites=[]
 const db={users,profiles,assets,audits,messages,authWrites,failAuth:false,failFinish:false,
 auth:{async getUser(token){return token==='owner'?{data:{user:clone(users.get(owner.id))}}:token==='member'?{data:{user:clone(users.get(user.id))}}:{error:Error('invalid')}},admin:{async getUserById(id){return {data:{user:clone(users.get(id))}}},async updateUserById(id,patch){if(db.failAuth){db.failAuth=false;throw Error('auth unavailable')};authWrites.push(clone(patch));users.set(id,{...users.get(id),...clone(patch)});return {data:{user:clone(users.get(id))}}}}},
 channel(){return {async send(message){messages.push(message);return 'ok'}}},async removeChannel(){},
 from(table){let operation='read',value,filters=[],single=false,range=null,head=false
  const q={select(_fields,options={}){head=options.head||false;return this},eq(key,expected){filters.push(row=>key==='medical_credentials->>revision'?row.medical_credentials?.revision===expected:row[key]===expected);return this},is(key,expected){filters.push(row=>key==='medical_credentials->>revision'?(row.medical_credentials?.revision??null)===expected:row[key]===expected);return this},not(){return this},order(){return this},range(a,b){range=[a,b];return this},insert(input){operation='insert';value=input;return this},update(input){operation='update';value=input;return this},maybeSingle(){single=true;return finish()},single(){single=true;return finish()},then(resolve,reject){return finish().then(resolve,reject)}}
  async function finish(){
   if(table==='admin_audit_log'){if(operation==='insert')audits.push(value);return {data:null}}
   const store=table==='profiles'?profiles:assets
   if(operation==='insert'){if(store.has(value.user_id))return {error:{code:'23505'}};const row={...clone(value),verification_status:'unverified',medical_credentials:{},verified_credentials:{},updated_at:new Date().toISOString()};store.set(row.user_id,row);return {data:clone(row)}}
   const rows=[...store.values()].filter(row=>filters.every(filter=>filter(row)))
   if(operation==='update'){
    if(db.failProfileFinish&&value.display_name&&value.medical_credentials?.editing===null){db.failProfileFinish=false;throw Error('profile finalization unavailable')}
    if(db.failFinish&&['approved','rejected'].includes(value.medical_credentials?.verification_request?.status)){db.failFinish=false;throw Error('database unavailable')}
    for(const row of rows)store.set(row.user_id,{...row,...clone(value)})
    return {data:rows.length?clone(store.get(rows[0].user_id)):null}
   }
   const page=range?rows.slice(range[0],range[1]+1):rows
   return {data:head?null:single?clone(page[0]||null):clone(page),count:rows.length}
  }
  return q
 }
 }
 return db
}
const res=()=>({headers:{},setHeader(key,value){this.headers[key]=value},end(raw){this.body=JSON.parse(raw)}})
const req=(token='member',body)=>({method:body?'POST':'GET',url:'/api/verifications',headers:{authorization:`Bearer ${token}`,host:'jobs.test',origin:'https://jobs.test'},...(body?{body}:{})})
const approval=(request,user=member,extra={})=>({user_id:user.id,request_id:request.id,decision:'approve',credentials:['syndicate_membership'],evidence_reviewed:true,...extra})

test('completion requires actual required fields and confirmed identity, never a CV or verification claim',()=>{
 assert.equal(profileCompletion(member).percentage,100)
 for(const missing of ['full_name','profession','governorate','phone','license_number','license_url'])assert.equal(profileCompletion({...member,user_metadata:{...member.user_metadata,[missing]:''}}).complete,false)
 assert.equal(profileCompletion({...member,email_confirmed_at:null}).complete,false)
 assert.equal(profileCompletion({...member,user_metadata:{...member.user_metadata,profile_kind:'pharmacist'}}).complete,false)
 assert.equal(profileCompletion({...member,user_metadata:{...member.user_metadata,license_url:'https://name:secret@example.org'}}).complete,false)
})
test('structured request is durable, immutable, deduplicated and cannot self-approve',async()=>{
 const db=database(),result=await submitVerification(db,member),stored=db.profiles.get(member.id)
 assert.equal(result.request.status,'pending');assert.equal(result.request.snapshot.license_number,'TEST-123')
 assert.equal(stored.verification_status,'pending');assert.equal(profileTrust(db.users.get(member.id)).status,'pending')
 assert.equal(db.users.get(member.id).app_metadata.existing,'retained')
 assert.ok(db.messages.every(message=>!JSON.stringify(message).includes(member.id)))
 await assert.rejects(()=>submitVerification(db,db.users.get(member.id)),error=>error.status===409)
 await assert.rejects(()=>saveProfile(db,member,profileDraft(member)),error=>error.status===409)
 assert.equal(db.profiles.get(member.id).medical_credentials.verification_request.id,result.request.id)
})
test('incomplete requests do not write a request or Auth approval',async()=>{
 const db=database();await assert.rejects(()=>submitVerification(db,{...member,user_metadata:{...member.user_metadata,license_url:''}}),error=>error.status===400);assert.equal(db.profiles.size,0);assert.equal(db.authWrites.length,0)
})
test('Auth interruption leaves a recoverable submitting request that is not approvable',async()=>{
 const db=database();db.failAuth=true;await assert.rejects(()=>submitVerification(db,member))
 const request=requestOf(db.profiles.get(member.id));assert.equal(request.status,'submitting')
 await assert.rejects(()=>reviewVerification(db,owner,approval(request)),error=>error.status===409)
 const retried=await submitVerification(db,member);assert.equal(retried.request.id,request.id);assert.equal(retried.request.status,'pending')
})
test('admin review grants only explicit applicable credentials and is replay-safe',async()=>{
 const db=database(),{request}=await submitVerification(db,member),body=approval(request)
 await assert.rejects(()=>reviewVerification(db,owner,{...body,evidence_reviewed:false}),error=>error.status===400)
 await assert.rejects(()=>reviewVerification(db,owner,{...body,credentials:['facility_license']}),error=>error.status===400)
 const result=await reviewVerification(db,owner,body)
 assert.equal(result.request.status,'approved');assert.deepEqual(profileTrust(db.users.get(member.id)),{status:'verified',kind:'dentist',credentials:['syndicate_membership']})
 assert.equal(db.profiles.get(member.id).verification_status,'verified');assert.equal(db.audits.length,1)
 assert.equal(canPublish(db.users.get(member.id)),true)
 const writes=db.authWrites.length;await assert.rejects(()=>reviewVerification(db,owner,body),error=>error.status===409);assert.equal(db.authWrites.length,writes)
})
test('clinics receive an organization approval and can publish without invented personal credentials',async()=>{
 const clinic={...member,user_metadata:{...member.user_metadata,profile_kind:'clinic'}}
 const db=database(clinic),{request}=await submitVerification(db,clinic)
 await reviewVerification(db,owner,approval(request,clinic,{credentials:['facility_license']}))
 const account=db.users.get(clinic.id);assert.equal(account.app_metadata.medical_professional_verified,false);assert.equal(account.app_metadata.organization_verified,true);assert.equal(profileTrust(account).kind,'clinic');assert.equal(canPublish(account),true)
})
test('CAS prevents two conflicting administrators from approving and rejecting the same snapshot',async()=>{
 const db=database(),{request}=await submitVerification(db,member)
 const results=await Promise.allSettled([reviewVerification(db,owner,approval(request)),reviewVerification(db,owner,approval(request,member,{decision:'reject',credentials:[],note:'الترخيص غير واضح للمراجعة'}))])
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1)
 assert.equal(db.audits.length,1)
})
test('a database interruption after Auth approval preserves a retryable fixed decision',async()=>{
 const db=database(),{request}=await submitVerification(db,member),body=approval(request);db.failFinish=true
 await assert.rejects(()=>reviewVerification(db,owner,body));assert.equal(requestOf(db.profiles.get(member.id)).status,'reviewing')
 await assert.rejects(()=>reviewVerification(db,owner,{...body,decision:'reject',note:'سبب رفض مختلف'}),error=>error.status===409)
 const completed=await reviewVerification(db,owner,body);assert.equal(completed.request.status,'approved');assert.equal(db.audits.length,1)
})
test('withdrawal unlocks editing, stale revisions fail, and changed credentials revoke the old badge',async()=>{
 const db=database(),{request}=await submitVerification(db,member)
 await withdrawVerification(db,db.users.get(member.id));assert.equal(requestOf(db.profiles.get(member.id)).status,'withdrawn')
 await assert.rejects(()=>reviewVerification(db,owner,approval(request)),error=>error.status===409)
 const old=clone(db.profiles.get(member.id));await changeProfile(db,old,{...old.medical_credentials,marker:true})
 await assert.rejects(()=>changeProfile(db,old,{stale:true}),error=>error.status===409)
 const saved=await saveProfile(db,db.users.get(member.id),{...profileDraft(member),license_number:'UPDATED'})
 assert.equal(saved.user.user_metadata.license_number,'UPDATED');assert.equal(profileTrust(saved.user).status,'unverified')
})
test('API rejects anonymous, cross-origin, suspended and forged review requests',async()=>{
 const db=database(),handler=createVerificationsHandler({},()=>db)
 for(const request of [{...req(),headers:{}}, {...req(),headers:{...req().headers,origin:'https://attacker.test'}},req('member',{action:'verification.review',user_id:owner.id})]){const out=res();await handler(request,out);assert.ok([400,401,403].includes(out.statusCode))}
 const out=res();await createAdminHandler({},()=>db)({...req('member'),url:'/api/admin?section=verifications'},out);assert.equal(out.statusCode,403)
 assert.equal(db.profiles.size,0)
})
test('profile save drops forged approval fields and refuses another account CV',async()=>{
 const db=database(),saved=await saveProfile(db,member,{...profileDraft(member),full_name:'اسم جديد',medical_professional_verified:true,role:'super_admin'})
 assert.equal(profileTrust(saved.user).status,'unverified');assert.equal(saved.user.app_metadata.role,undefined)
 const asset='33333333-3333-4333-8333-333333333333';db.assets.set(asset,{id:asset,user_id:owner.id,state:'ready'})
 await assert.rejects(()=>saveProfile(db,saved.user,{...profileDraft(saved.user),cv_asset_id:asset}))
})
test('broadcast subscriptions are shared, cleaned up, and treat messages only as invalidation',()=>{
 let starts=0,handler,removed=0,a=0,b=0
 const client={channel(){starts++;return {on(_type,_filter,fn){handler=fn;return this},subscribe(){return this}}},removeChannel(){removed++}}
 const stopA=subscribeTrustEvents(client,()=>a++),stopB=subscribeTrustEvents(client,()=>b++)
 assert.equal(starts,1);handler({payload:{verified:true,role:'super_admin'}});assert.equal(a,1);assert.equal(b,1)
 stopA();assert.equal(removed,0);stopB();assert.equal(removed,1)
})

test('rapid invalidations deliver a trailing refresh and release their timer',async()=>{
 let handler,seen=0
 const client={channel(){return {on(_type,_filter,callback){handler=callback;return this},subscribe(){return this}}},removeChannel(){}}
 const stop=subscribeTrustEvents(client,()=>seen++)
 handler();handler();handler();assert.equal(seen,1)
 await new Promise(resolve=>setTimeout(resolve,550));assert.equal(seen,2)
 handler();stop();await new Promise(resolve=>setTimeout(resolve,550));assert.equal(seen,2)
})
test('overlapping drawer and dialog locks restore scroll and inert state in either cleanup order',async()=>{
 const {acquireOverlayLock}=await import('../src/overlay-lock.js')
 for(const reverse of [false,true]){
  const root={inert:false},doc={body:{style:{overflow:'auto'}},getElementById(){return root}}
  const drawer=acquireOverlayLock({doc,inertRoot:true}),dialog=acquireOverlayLock({doc,inertRoot:true})
  const [first,last]=reverse?[dialog,drawer]:[drawer,dialog];first()
  assert.equal(root.inert,true);assert.equal(doc.body.style.overflow,'hidden');last();last()
  assert.equal(root.inert,false);assert.equal(doc.body.style.overflow,'auto')
 }
})
test('failed Auth writes unlock profile editing without granting a badge',async()=>{
 const db=database();db.failAuth=true
 await assert.rejects(()=>saveProfile(db,member,{...profileDraft(member),full_name:'تحديث ملف'}))
 assert.equal(db.profiles.get(member.id).medical_credentials.editing,null)
 assert.equal(profileTrust(db.users.get(member.id)).status,'unverified')
 await saveProfile(db,member,{...profileDraft(member),full_name:'تحديث ملف'})
})
test('withdrawal interruption remains blocked until the same withdrawal is completed',async()=>{
 const db=database();await submitVerification(db,member);db.failAuth=true
 await assert.rejects(()=>withdrawVerification(db,db.users.get(member.id)))
 assert.equal(requestOf(db.profiles.get(member.id)).status,'withdrawing')
 await assert.rejects(()=>submitVerification(db,db.users.get(member.id)),error=>error.status===409)
 const result=await withdrawVerification(db,db.users.get(member.id));assert.equal(result.request.status,'withdrawn')
})
test('fresh Auth metadata under the review claim prevents restoration of a stale administrative role',async()=>{
 const db=database();await submitVerification(db,member)
 const stale=clone(db.users.get(member.id));stale.app_metadata.role='super_admin'
 const original=db.auth.admin.getUserById;let read=0
 db.auth.admin.getUserById=async id=>{if(++read===1)return {data:{user:stale}};return original(id)}
 const request=requestOf(db.profiles.get(member.id));await reviewVerification(db,owner,approval(request))
 assert.equal(db.users.get(member.id).app_metadata.role,undefined)
 assert.equal(profileTrust(db.users.get(member.id)).status,'verified')
})

test('an anonymous request is denied before constructing a privileged server client',async()=>{
 let touched=false;const out=res();await createVerificationsHandler({},()=>{touched=true;throw Error('No server credentials')})({...req(),headers:{}},out)
 assert.equal(out.statusCode,401);assert.equal(touched,false)
})
test('GET profile does not create a private profile or mutate Auth',async()=>{
 const db=database(),out=res();await createVerificationsHandler({},()=>db)(req(),out)
 assert.equal(out.statusCode,200);assert.equal(out.body.request,null);assert.equal(out.body.cv,null);assert.equal(db.profiles.size,0);assert.equal(db.authWrites.length,0)
})
test('malformed self-declared account kinds cannot block administrative account initialization',async()=>{
 const malicious={...member,user_metadata:{...member.user_metadata,profile_kind:'invented-admin',governorate:'invalid'}}
 const db=database(malicious),profile=await getPrivateProfile(db,malicious)
 assert.equal(profile.profile_kind,'professional');assert.equal(profile.governorate,null)
})

test('retrying an interrupted profile save reconciles the private status with trusted Auth revocation',async()=>{
 const db=database(),{request}=await submitVerification(db,member);await reviewVerification(db,owner,approval(request))
 const changed={...profileDraft(db.users.get(member.id)),license_number:'UPDATED-LICENSE'};db.failProfileFinish=true
 await assert.rejects(()=>saveProfile(db,db.users.get(member.id),changed))
 assert.equal(profileTrust(db.users.get(member.id)).status,'unverified');assert.equal(db.profiles.get(member.id).verification_status,'verified')
 db.profiles.get(member.id).medical_credentials.editing.until='2000-01-01'
 await saveProfile(db,db.users.get(member.id),changed)
 assert.equal(db.profiles.get(member.id).verification_status,'unverified')
 const result=await submitVerification(db,db.users.get(member.id));assert.equal(result.request.status,'pending')
})
