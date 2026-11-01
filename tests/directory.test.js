import test from 'node:test'
import assert from 'node:assert/strict'
import {publicTalent,publicCourse,createDirectoryHandler} from '../api/directory.js'
const talent={id:'record',user_id:'private-owner',name:'طبيبة',specialty:'Dentists',governorate:'Baghdad',phone:'07701234567',whatsapp_enabled:true,contact_consent:false,availability:'available',skill_tags:['تقويم الأسنان'],shift_preferences:['Full-time'],cv_asset_id:'private-file',medical_credentials:{license:'private'}}
const course={id:'course',title:'ورشة',specialty:'Dentists',governorate:'Baghdad',kind:'hands_on',starts_at:'2099-11-01T06:00:00Z',ends_at:'2099-11-01T11:00:00Z',instructor_name:'مدرب',instructor_credentials:'اختصاص معلن',registration_url:'https://example.org/register',organizer_id:'private-owner'}
test('published talent projection hides private identity, CV and nonconsented contacts',()=>{
 const output=publicTalent(talent,{status:'unverified',kind:'professional',credentials:[]})
 assert.equal(output.source,'platform');assert.equal(output.phone,null);assert.equal(output.whatsappEnabled,false)
 for(const key of ['user_id','cv_asset_id','medical_credentials'])assert.equal(key in output,false)
 assert.equal(publicTalent({...talent,contact_consent:true}).phone,'07701234567')
})
test('published course projection validates links and does not confer accreditation',()=>{
 const output=publicCourse(course);assert.equal(output.source,'platform');assert.equal(output.registrationUrl,'https://example.org/register');assert.equal('organizer_id' in output,false);assert.equal('accreditation_verified' in output,false)
 assert.equal(publicCourse({...course,registration_url:'javascript:alert(1)'}).registrationUrl,null)
 assert.equal(publicCourse({...course,ends_at:'bad'}),null)
})
function response(){return {headers:{},setHeader(key,value){this.headers[key]=value},end(body){this.body=JSON.parse(body)}}}
test('directory denies mutations and malformed requests before querying',async()=>{
 let touched=false;const handler=createDirectoryHandler(()=>{touched=true;throw Error('unexpected')})
 for(const [method,url,status] of [['POST','/?kind=courses',405],['GET','/?kind=profiles',400],['GET','/?kind=talent&offset=-1',400]]){const res=response();await handler({method,url},res);assert.equal(res.statusCode,status);assert.equal(res.headers['Cache-Control'],'no-store')}
 assert.equal(touched,false)
})
test('directory explicitly queries only published courses with bounded pagination',async()=>{
 const calls=[];const query={select(fields){calls.push(['select',fields]);return this},eq(...args){calls.push(['eq',...args]);return this},order(){return this},range(...args){calls.push(['range',...args]);return this},abortSignal(){return Promise.resolve({data:[course],error:null})}}
 const handler=createDirectoryHandler(()=>({from(table){assert.equal(table,'courses');return query}})),res=response()
 await handler({method:'GET',url:'/?kind=courses&offset=24'},res)
 assert.equal(res.statusCode,200);assert.equal(res.body.items.length,1);assert.equal(res.body.hasMore,false)
 assert.ok(calls.some(call=>call[0]==='eq'&&call[1]==='publication_status'&&call[2]==='published'))
 assert.deepEqual(calls.find(call=>call[0]==='range'),['range',24,47])
})
test('directory errors stay generic and never reveal backend details',async()=>{
 const res=response();await createDirectoryHandler(()=>{throw Error('private-token')})({method:'GET',url:'/?kind=talent'},res)
 assert.equal(res.statusCode,503);assert.ok(!JSON.stringify(res.body).includes('private-token'))
})
