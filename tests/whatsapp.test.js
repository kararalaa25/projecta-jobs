import test from 'node:test'
import assert from 'node:assert/strict'
import {formatIraqiPhoneNumber} from '../lib/phone.ts'
import {sendWhatsAppTemplateMessage,notifyPublisherWhatsAppNewApplication,notifyApplicantWhatsAppInterviewScheduled} from '../lib/whatsapp.ts'
import {createWhatsAppPreferencesHandler} from '../server/notification-handlers/whatsapp-preferences.js'
const env={WHATSAPP_ACCESS_TOKEN:'mock-secret',WHATSAPP_PHONE_NUMBER_ID:'123456',WHATSAPP_GRAPH_API_VERSION:'v17.0'}
const result=()=>({setHeader(){},end(raw){this.body=JSON.parse(raw)}})
test('Iraqi phone formats normalize to the same Meta digits-only recipient',()=>{
 for(const phone of ['+9647800000000','07800000000','7800000000','+964 780-000-0000','009647800000000','٠٧٨٠٠٠٠٠٠٠٠'])assert.equal(formatIraqiPhoneNumber(phone),'9647800000000')
 for(const phone of ['', '123', '+447800000000'])assert.throws(()=>formatIraqiPhoneNumber(phone))
})
test('Cloud API uses authenticated template payload and sanitized recipients',async()=>{
 let captured;const fetcher=async(url,init)=>{captured={url,init,body:JSON.parse(init.body)};return {ok:true,async json(){return {messages:[{id:'mock-message'}]}}}}
 assert.equal((await sendWhatsAppTemplateMessage('07800000000','new_job_applicant','ar',['العيادة','مثال','طبيب'],{env,fetcher})).messageId,'mock-message')
 assert.equal(captured.url,'https://graph.facebook.com/v17.0/123456/messages');assert.equal(captured.init.headers.Authorization,'Bearer mock-secret');assert.equal(captured.body.to,'9647800000000');assert.equal(captured.body.type,'template');assert.equal(captured.body.messaging_product,'whatsapp')
 assert.deepEqual(captured.body.template.components[0].parameters.map(item=>item.text),['العيادة','مثال','طبيب'])
})
test('Arabic templates preserve exact body parameter ordering including recipient greetings',async()=>{
 const bodies=[],fetcher=async(url,init)=>{bodies.push(JSON.parse(init.body));return {ok:true,async json(){return {messages:[{id:'mock'}]}}}}
 await notifyPublisherWhatsAppNewApplication('7800000000','أحمد','طبيب أسنان','عيادة المثال',{env,fetcher})
 await notifyApplicantWhatsAppInterviewScheduled('+9647800000000','عيادة المثال','2026-11-20','10:30','أحمد',{env,fetcher})
 assert.equal(bodies[0].template.name,'new_job_applicant');assert.deepEqual(bodies[0].template.components[0].parameters.map(item=>item.text),['عيادة المثال','أحمد','طبيب أسنان'])
 assert.equal(bodies[1].template.name,'interview_scheduled');assert.deepEqual(bodies[1].template.components[0].parameters.map(item=>item.text),['أحمد','عيادة المثال','2026-11-20','10:30'])
})
test('configuration and upstream failures never disclose secrets or recipients',async()=>{
 await assert.rejects(()=>sendWhatsAppTemplateMessage('07800000000','test','ar',[],{env:{}}),/not configured/)
 for(const fetcher of [async()=>{throw Error('raw mock-secret 9647800000000')},async()=>({ok:false,async json(){return {error:{message:'raw mock-secret'}}}})])await assert.rejects(()=>sendWhatsAppTemplateMessage('07800000000','test','ar',[],{env,fetcher}),error=>!error.message.includes('mock-secret')&&!error.message.includes('9647800000000'))
})
test('preferences reject anonymous callers before creating a privileged client',async()=>{
 const res=result();await createWhatsAppPreferencesHandler({},()=>{throw Error('must not run')})({method:'POST',headers:{}},res);assert.equal(res.statusCode,401)
})
test('preferences require explicit boolean consent, never truthy strings',async()=>{
 const res=result(),db={auth:{async getUser(){return {data:{user:{id:'owner',email_confirmed_at:'2026-01-01',app_metadata:{}}}}}}}
 await createWhatsAppPreferencesHandler({},()=>db)({method:'POST',headers:{authorization:'Bearer mock'},body:{phone:'07800000000',optIn:'true',user_id:'someone-else'}},res)
 assert.equal(res.statusCode,400)
})
test('saving and withdrawing consent updates only the authenticated private profile',async()=>{
 const writes=[],db={auth:{async getUser(){return {data:{user:{id:'owner',email_confirmed_at:'2026-01-01',app_metadata:{}}}}}},from(){let patch;return {select(){return this},eq(key,value){if(patch)writes.push({key,value,patch});return this},update(value){patch=value;return this},async maybeSingle(){return {data:{user_id:'owner'}}},then(resolve){return Promise.resolve({data:null}).then(resolve)}}}}
 const handler=createWhatsAppPreferencesHandler({},()=>db)
 for(const body of [{phone:'07800000000',optIn:true,user_id:'someone-else'},{phone:'invalid',optIn:false}]){const res=result();await handler({method:'POST',headers:{authorization:'Bearer mock'},body},res);assert.equal(res.statusCode,200)}
 assert.deepEqual(writes,[{key:'user_id',value:'owner',patch:{whatsapp_phone:'9647800000000',whatsapp_opt_in:true}},{key:'user_id',value:'owner',patch:{whatsapp_phone:null,whatsapp_opt_in:false}}])
})
test('new application notification respects stored opt-in and cannot undo a committed application',async()=>{
 const {createApplicationsHandler}=await import('../api/applications.js'),jobId='11111111-1111-4111-8111-111111111111'
 for(const [optIn,duplicate,failSend] of [[true,false,false],[false,false,false],[true,true,false],[true,false,true]]){
  const sent=[],db={auth:{async getUser(){return {data:{user:{id:'applicant',email_confirmed_at:'2026-01-01',user_metadata:{full_name:'أحمد'},app_metadata:{}}}}}},from(table){return {select(){return this},eq(){return this},order(){return Promise.resolve({data:[]})},insert(){return this},async maybeSingle(){return {data:table==='platform_settings'?{value:{maintenance:false}}:{display_name:'عيادة المثال',whatsapp_phone:'9647800000000',whatsapp_opt_in:optIn}}},async single(){return table==='job_applications'&&duplicate?{error:{code:'23505'}}:{data:table==='job_offers'?{id:jobId,status:'active',expires_at:'2099-01-01T00:00:00Z',publisher_id:'publisher',title:'طبيب أسنان'}:{id:jobId}}}}}}
  const res=result();await createApplicationsHandler(env,()=>db,async(...args)=>{sent.push(args);if(failSend)throw Error('mock failure')})({method:'POST',headers:{authorization:'Bearer mock'},body:{job_id:jobId,cover_letter:'نبذة مهنية طويلة بما يكفي',publisherPhone:'someone-else'}},res)
  assert.equal(res.statusCode,duplicate?409:201);assert.equal(sent.length,optIn&&!duplicate?1:0);if(sent.length)assert.equal(sent[0][0],'9647800000000')
 }
})
test('token placeholders never cause an outbound WhatsApp request',async()=>{
 let called=false
 await assert.rejects(()=>sendWhatsAppTemplateMessage('07800000000','new_job_applicant','ar',['test'],{env:{...env,WHATSAPP_ACCESS_TOKEN:'<YOUR_META_ACCESS_TOKEN>'},fetcher:async()=>{called=true;throw Error('must not run')}}),/not configured/)
 assert.equal(called,false)
})
test('Meta errors preserve actionable codes without exposing raw payloads',async()=>{
 await assert.rejects(()=>sendWhatsAppTemplateMessage('07800000000','new_job_applicant','ar',['test'],{env,fetcher:async()=>({ok:false,status:400,async json(){return {error:{code:131030,error_subcode:99,message:'secret mock-secret recipient 9647800000000'}}}})}),error=>error.diagnostics.status===400&&error.diagnostics.code===131030&&!JSON.stringify(error).includes('mock-secret')&&!JSON.stringify(error).includes('9647800000000'))
})
