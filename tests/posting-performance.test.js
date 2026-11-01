import test from 'node:test'
import assert from 'node:assert/strict'
import {ensurePublisher} from '../server/publishers.js'
import {createPublishHandler,validateJob} from '../api/publish-job.js'
import {fetchJobs} from '../src/jobs.js'
import {startJobFeed} from '../src/job-realtime.js'
import {scoreSpecialtyFit} from '../src/matching_engine.ts'
const job={title:'طبيب أسنان',company:'عيادة الرعاية',description:'مطلوب طبيب أسنان',salary:'1000000',role:'Dentists',city:'Babylon',schedule:'Full-time',phone:'07701234567'}
const user={id:'22222222-2222-4222-8222-222222222222',email:'private@example.test',phone:'+9647701234567',email_confirmed_at:'now',app_metadata:{medical_professional_verified:true},user_metadata:{license_number:'private-license'}}
const response=()=>({setHeader(){},end(body){this.body=JSON.parse(body)}})
function publishingDatabase(failPublisher=false){
 const accounts=new Map(),posts=[],calls=[]
 return {accounts,posts,calls,auth:{async getUser(){return {data:{user}}}},from(table){
  if(table==='platform_settings')return {select(){return this},eq(){return this},async maybeSingle(){return {data:null,error:{code:'PGRST205'}}}}
  if(table==='admin_catalog')return {select(){return this},async order(){return {data:null,error:{code:'PGRST205'}}}}
  if(table==='job_users')return {async upsert(row,options){calls.push('publisher');if(failPublisher)return {error:{code:'TEST_FAILURE'}};if(!accounts.has(row.id))accounts.set(row.id,row);return {error:null}}}
  if(table==='job_offers')return {insert(row){calls.push('post');posts.push(row);return this},select(){return this},async single(){const row=posts.at(-1);return accounts.has(row.publisher_id)?{data:{id:'published-id'}}:{error:{code:'23503'}}}}
  throw Error('Unexpected table')
 }}
}
test('first publication provisions a publisher before the foreign-key dependent job, without duplicating it',async()=>{
 const db=publishingDatabase(),handler=createPublishHandler({},()=>db)
 for(let attempt=0;attempt<2;attempt++){const result=response();await handler({method:'POST',headers:{authorization:'Bearer valid'},body:job},result);assert.equal(result.statusCode,201)}
 assert.deepEqual(db.calls,['publisher','post','publisher','post']);assert.equal(db.accounts.size,1)
 const row=db.accounts.get(user.id);assert.equal(row.full_name,job.company);assert.ok(row.email.endsWith('.invalid'));assert.ok(!JSON.stringify(row).includes('private@example'));assert.equal(row.phone,undefined);assert.equal(row.profession,undefined)
})
test('failed publisher creation never attempts to publish an ownerless job',async()=>{
 const db=publishingDatabase(true),result=response();await createPublishHandler({},()=>db)({method:'POST',headers:{authorization:'Bearer valid'},body:job},result)
 assert.equal(result.statusCode,502);assert.equal(db.posts.length,0)
})
test('existing publisher identities are preserved and temporary contracts use the existing database enum',async()=>{
 const db=publishingDatabase();db.accounts.set(user.id,{id:user.id,full_name:'Existing public label',email:'existing@example.test'})
 await ensurePublisher(db,user,job.company);assert.equal(db.accounts.get(user.id).full_name,'Existing public label')
 assert.equal(validateJob({...job,schedule:'Contract'}).employment_type,'locum_temp')
 assert.equal(JSON.parse(validateJob({...job,schedule:'Contract'}).contact_info).employment_type,'Contract')
})
test('the first feed page renders before the archive finishes and remaining pages use bounded parallel reads',async()=>{
 let release,pending=0,peak=0
 const gate=new Promise(resolve=>{release=resolve}),partials=[]
 const loading=fetchJobs(undefined,'all',{onPage:rows=>partials.push(rows.map(row=>row.id)),fetchPage:async(_signal,offset)=>{
  if(offset===0)return {jobs:[{id:'first'}],hasMore:true,total:1000}
  pending++;peak=Math.max(peak,pending);await gate;pending--;return {jobs:[{id:String(offset)}],hasMore:offset<800,total:null}
 }})
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(partials,[['first']]);assert.equal(peak,2)
 release();const rows=await loading;assert.equal(rows.length,5);assert.equal(peak,2);assert.equal(new Set(rows.map(row=>row.id)).size,5)
})
test('older API responses still load sequentially, deduplicate and preserve partial results',async()=>{
 const partials=[],rows=await fetchJobs(undefined,'all',{onPage:items=>partials.push(items.length),fetchPage:async(_signal,offset)=>({jobs:offset?[{id:'same'},{id:'last'}]:[{id:'same'}],hasMore:offset===0,total:null})})
 assert.deepEqual(partials,[1]);assert.deepEqual(rows.map(row=>row.id),['same','last'])
})
test('background reconciliation keeps the full feed visible while its new pages are loading',async()=>{
 const snapshots=[];let refresh,count=0,connection
 const win={setInterval(fn){refresh=fn;return 1},clearInterval(){},setTimeout(){},clearTimeout(){},addEventListener(){},removeEventListener(){}},doc={visibilityState:'visible',addEventListener(){},removeEventListener(){}}
 const channel={on(){return this},subscribe(callback){connection=callback;return this}}
 const stop=startJobFeed({client:{channel(){return channel},removeChannel(){}},win,doc,onSnapshot:rows=>snapshots.push(rows.map(row=>row.id)),onUpsert(){},onRemove(){},onConnection(){},onLoad(){},fetchAll:async(_signal,_feed,{onPage})=>{count++;onPage([{id:'first'}]);return [{id:'first'},{id:'archive'}]}})
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(snapshots,[['first'],['first','archive']])
 refresh();await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(snapshots.at(-1),['first','archive']);assert.equal(snapshots.length,3);stop()
})
test('cached matching features respect edited job text and in-place preference changes',()=>{
 const profile={role:'Dentists',city:'Baghdad',workTypes:['Full-time'],skills:['Orthodontics']},listing={role:'Dentists',city:'Baghdad',schedule:'Full-time',description:'خبرة تقويم الأسنان'}
 assert.equal(scoreSpecialtyFit(profile,listing).score,100);assert.equal(scoreSpecialtyFit(profile,listing).score,100)
 listing.description='خبرة علاج الجذور';assert.equal(scoreSpecialtyFit(profile,listing).score,80)
 profile.skills.push('Endodontics');assert.equal(scoreSpecialtyFit(profile,listing).score,100)
})
