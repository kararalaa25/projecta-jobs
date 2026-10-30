import test from 'node:test'
import assert from 'node:assert/strict'
import {createPublishHandler,validateJob,verifiedProfessional} from '../api/publish-job.js'
import {iraqiAuthPhone,requestCode,verifyCode,normalizeOtp,signInWithGoogle} from '../src/auth.js'
const job={title:'طبيب أسنان',company:'عيادة الرعاية',description:'فرصة عمل لطبيب أسنان في بغداد',salary:'١٬٠٠٠٬٠٠٠ د.ع.',city:'Baghdad',role:'Dentists',schedule:'Full-time',phone:'07701234567',telegram:'@clinic_jobs'}
const res=()=>({setHeader(){},end(body){this.body=JSON.parse(body)}})
const req=(body=job)=>({method:'POST',headers:{authorization:'Bearer valid-token',host:'projecta.test',origin:'https://projecta.test'},body})
function client(user,error=null){let inserted;return {auth:{async getUser(){return {data:{user},error}}},from(table){assert.equal(table,'job_offers');return {insert(value){inserted=value;return this},select(){return this},async single(){return {data:{id:'new-id'},error:null}}}},get inserted(){return inserted}}}
test('email requests OTP using the email-only payload',async()=>{
 let sent;const c={auth:{async signInWithOtp(data){sent=data;return {error:null}}}}
 await requestCode(c,'email',' USER@EXAMPLE.COM ',true);assert.deepEqual(sent,{email:'user@example.com'})
 await requestCode(c,'email','user@example.com',false);assert.deepEqual(sent,{email:'user@example.com'})
})
test('Iraqi SMS and localized OTP digits are normalized',async()=>{
 assert.equal(iraqiAuthPhone('٠٧٧٠١٢٣٤٥٦٧'),'+9647701234567');assert.equal(iraqiAuthPhone('+15551234567'),null);assert.equal(normalizeOtp('١٢٣۴۵۶'),'123456')
 let sent;const c={auth:{async verifyOtp(data){sent=data;return {data:{},error:null}}}}
 await verifyCode(c,'phone','+9647701234567','123456');assert.deepEqual(sent,{phone:'+9647701234567',token:'123456',type:'sms'})
 await verifyCode(c,'email','USER@EXAMPLE.COM','123456');assert.equal(sent.type,'email');assert.equal(sent.email,'user@example.com')
})
test('anonymous and invalid-token requests cannot publish',async()=>{
 const missing=res();await createPublishHandler({},()=>{throw Error('must not run')})({...req(),headers:{}},missing);assert.equal(missing.statusCode,401)
 const bad=res(),db=client(null,Error('bad token'));await createPublishHandler({},()=>db)(req(),bad);assert.equal(bad.statusCode,401);assert.equal(db.inserted,undefined)
})
test('self-asserted medical metadata never grants publishing rights',async()=>{
 const user={id:'u',email_confirmed_at:'now',user_metadata:{medical_professional_verified:true},app_metadata:{}}
 assert.equal(verifiedProfessional(user),false);const db=client(user),out=res();await createPublishHandler({},()=>db)(req(),out);assert.equal(out.statusCode,403);assert.equal(db.inserted,undefined)
})
test('unconfirmed accounts cannot publish even with an administrative claim',async()=>{
 const user={id:'u',app_metadata:{medical_professional_verified:true}}
 const out=res();await createPublishHandler({},()=>client(user))(req(),out);assert.equal(out.statusCode,403)
})
test('verified professional publishes with server-assigned ownership',async()=>{
 const db=client({id:'real-user',email_confirmed_at:'now',app_metadata:{medical_professional_verified:true}}),out=res()
 await createPublishHandler({},()=>db)(req({...job,publisher_id:'attacker',source:'telegram',status:'rejected'}),out)
 assert.equal(out.statusCode,201);assert.equal(db.inserted.publisher_id,'real-user');assert.equal(db.inserted.source,'manual');assert.equal(db.inserted.status,'active');assert.equal(db.inserted.employment_type,'full_time')
})
test('server rejects invalid payloads and foreign origins',async()=>{
 assert.throws(()=>validateJob({...job,role:'admin'}));assert.throws(()=>validateJob({...job,phone:'+15551234567'}))
 const out=res();await createPublishHandler({},()=>{throw Error('must not run')})({...req(),headers:{...req().headers,origin:'https://evil.test'}},out);assert.equal(out.statusCode,403)
})

test('Google OAuth returns to the production jobs home',async()=>{
 let sent;await signInWithGoogle({auth:{async signInWithOAuth(payload){sent=payload;return {error:null}}}})
 assert.deepEqual(sent,{provider:'google',options:{redirectTo:'https://projecta-jobs.vercel.app'}})
})
test('email verification rejects any token that is not exactly six digits before requesting Supabase',async()=>{
 const c={auth:{verifyOtp(){throw Error('must not call')}}}
 for(const code of ['12345','1234567','abcdef'])await assert.rejects(()=>verifyCode(c,'email','doctor@example.com',code),/six-digit/)
})
