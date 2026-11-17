import test from 'node:test'
import assert from 'node:assert/strict'
import {createAdminHandler} from '../api/admin.js'
import {createJobsHandler} from '../api/jobs.js'

const owner={id:'11111111-1111-4111-8111-111111111111',email:'kararalkhafaji892@gmail.com',email_confirmed_at:'2026-01-01',app_metadata:{}}
const member={id:'22222222-2222-4222-8222-222222222222',email:'member@example.test',email_confirmed_at:'2026-01-01',app_metadata:{}}
const pendingId='33333333-3333-4333-8333-333333333333'
const response=()=>({headers:{},setHeader(key,value){this.headers[key]=value},end(raw){this.body=JSON.parse(raw)}})
const request=(section='jobs',body,url=`/api/admin?section=${section}`)=>({method:body?'POST':'GET',url,headers:{authorization:'Bearer token',host:'jobs.test',origin:'https://jobs.test'},...(body?{body}:{})})

function row(id,status){return {id,title:'test offer',role_category:'Dentists',employment_type:'full_time',location_city:'Baghdad',salary_range:'100 IQD',description:'desc',source:'telegram',status,expires_at:'2099-01-01T00:00:00Z',created_at:'2026-11-17T00:00:00Z',contact_info:'{}'}}

// Shared in-memory rows so an admin moderation update is visible to the next public feed read.
function makeDb(rows,actor){
  const calls=[]
  const db={
    calls,
    auth:{
      async getUser(){return {data:{user:actor},error:null}},
      admin:{async listUsers(){return {data:{users:[owner,member]},error:null}},async getUserById(){return {data:{user:actor}}}},
    },
    async rpc(){return {data:null,error:null}},
    from(table){
      const call={table};calls.push(call)
      function result(single=false){
        if(table==='admin_audit_log')return {data:{id:'audit'},error:null}
        if(table==='platform_settings')return {data:{id:'p',value:{}},error:null}
        if(table==='admin_catalog')return {data:[],error:null}
        if(table!=='job_offers')return {data:single?{id:'x'}:[],error:null,count:0}
        if(call.update){const id=(call.eq||[]).find(([k])=>k==='id')?.[1];const current=rows.find(r=>r.id===id);if(current)Object.assign(current,call.update);return {data:{...current,id:id||'x'},error:null}}
        if(call.insert)return {data:{id:'inserted'},error:null}
        if(call.delete)return {data:{id:'x'},error:null}
        const data=rows.filter(r=>(call.eq||[]).every(([k,v])=>r[k]===v)&&(call.gt||[]).every(([k,v])=>r[k]>v)&&(!call.in||call.in.every(([k,v])=>v.includes(r[k]))))
        return {data:single?(data[0]||{id:'x'}):data,error:null,count:data.length,status:200}
      }
      const q={
        select(...a){call.select=a;return q},eq(k,v){(call.eq||=[]).push([k,v]);return q},gt(k,v){(call.gt||=[]).push([k,v]);return q},
        in(k,v){(call.in||=[]).push([k,v]);return q},is(){return q},not(){return q},order(){return q},range(){return q},limit(){return q},ilike(){return q},
        insert(v){call.insert=v;return q},update(v){call.update=v;return q},delete(){call.delete=true;return q},
        abortSignal(){return Promise.resolve(result())},single(){return Promise.resolve(result(true))},maybeSingle(){return Promise.resolve(result(true))},
        then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)},
      }
      return q
    },
  }
  return db
}
async function admin(actor,body,url){
  const rows=[row(pendingId,'pending'),row('44444444-4444-4444-8444-444444444444','rejected')]
  const db=makeDb(rows,actor)
  const res=response()
  await createAdminHandler({},()=>db)(request('jobs',body,url),res)
  return {db,res,rows}
}
async function publicFeed(rows){
  const res=response()
  await createJobsHandler({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'},()=>makeDb(rows,owner))({method:'GET'},res)
  return res
}

test('only a super-admin can read or change the pending moderation queue',async()=>{
  const denied=await admin(member)
  assert.ok([401,403].includes(denied.res.statusCode))
  assert.equal(denied.db.calls.length,0,'no database access before authorization')
  const deniedWrite=await admin(member,{action:'job.status',id:pendingId,status:'active'})
  assert.ok([401,403].includes(deniedWrite.res.statusCode))
  assert.equal(deniedWrite.db.calls.length,0,'no database write before authorization')

  const {db,res}=await admin(owner,null,'/api/admin?section=jobs&status=pending')
  assert.equal(res.statusCode,200)
  const jobsCall=db.calls.find(c=>c.table==='job_offers')
  assert.deepEqual((jobsCall.eq||[]).find(([k])=>k==='status'),['status','pending'])
  assert.equal(res.body.rows.length,1)
  assert.equal(res.body.rows[0].id,pendingId)
})

test('pending and rejected rows never reach the public feed',async()=>{
  const res=await publicFeed([row(pendingId,'pending'),row('44444444-4444-4444-8444-444444444444','rejected')])
  assert.equal(res.statusCode,200)
  assert.deepEqual(res.body.jobs,[])
  assert.equal(res.body.total,0)
})

test('approved pending job becomes public only after authorized moderation; rejection stays excluded',async()=>{
  const approved=await admin(owner,{action:'job.status',id:pendingId,status:'active'})
  assert.equal(approved.res.statusCode,200)
  const update=approved.db.calls.find(c=>c.table==='job_offers'&&c.update)
  assert.deepEqual(update.update,{status:'active'})
  assert.deepEqual(update.eq,[['id',pendingId]])
  assert.equal(approved.rows.find(r=>r.id===pendingId).status,'active')
  const afterApproval=await publicFeed(approved.rows)
  assert.equal(afterApproval.statusCode,200)
  assert.equal(afterApproval.body.jobs.length,1)
  assert.equal(afterApproval.body.jobs[0].id,pendingId)

  const rejected=await admin(owner,{action:'job.status',id:pendingId,status:'rejected'})
  assert.equal(rejected.res.statusCode,200)
  assert.equal(rejected.rows.find(r=>r.id===pendingId).status,'rejected')
  const afterRejection=await publicFeed(rejected.rows)
  assert.deepEqual(afterRejection.body.jobs,[])
  assert.equal(afterRejection.body.total,0)

  const invalid=await admin(owner,{action:'job.status',id:pendingId,status:'published'})
  assert.equal(invalid.res.statusCode,400)
})
