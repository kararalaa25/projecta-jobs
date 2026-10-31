import test from 'node:test'
import assert from 'node:assert/strict'
import {startJobFeed,reconcileSnapshot} from '../src/job-realtime.js'
import {createJobsHandler} from '../api/jobs.js'
const id='11111111-1111-4111-8111-111111111111'
const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
function harness(overrides={}){
 let handler,status,removed=0,jobTimer,interval
 const listeners=new Map(),doc={visibilityState:'visible',addEventListener(){},removeEventListener(){}}
 const win={setTimeout(fn){jobTimer=fn;return 1},clearTimeout(){},setInterval(fn){interval=fn;return 2},clearInterval(){},addEventListener(k,fn){listeners.set(k,fn)},removeEventListener(k){listeners.delete(k)}}
 const channel={on(type,filter,fn){assert.equal(type,'postgres_changes');assert.equal(filter.table,'job_offers');assert.deepEqual(filter.select,['id','source','status']);handler=fn;return this},subscribe(fn){status=fn;return this}}
 const snapshots=[],updates=[],deletions=[],states=[]
 const stop=startJobFeed({client:{channel(name){assert.equal(name,'public:jobs');return channel},removeChannel(){removed++}},win,doc,onSnapshot:v=>snapshots.push(v),onUpsert:v=>updates.push(v),onRemove:v=>deletions.push(v),onConnection:v=>states.push(v),onLoad(){},fetchAll:async()=>[],fetchByIds:async ids=>ids.map(id=>({id,title:'sanitized'})),...overrides})
 return {event:v=>handler(v),status:v=>status(v),flush:()=>jobTimer(),poll:()=>interval(),stop,snapshots,updates,deletions,states,listeners,get removed(){return removed}}
}
test('socket INSERT fetches only sanitized API cards; duplicate notifications batch and DELETE removes',async()=>{
 let idsSeen
 const h=harness({fetchByIds:async ids=>{idsSeen=ids;return [{id,title:'sanitized'}]}})
 await settle();h.event({eventType:'INSERT',new:{id,publisher_id:'must-not-merge',title:'untrusted'}});h.event({eventType:'INSERT',new:{id}});await h.flush()
 assert.deepEqual(idsSeen,[id]);assert.deepEqual(h.updates,[{id,title:'sanitized'}]);h.event({eventType:'DELETE',old:{id}});assert.deepEqual(h.deletions,[id]);h.stop();assert.equal(h.removed,1);assert.equal(h.listeners.size,0)
})
test('late snapshots cannot erase inserts or resurrect deletions',()=>{
 const changes=new Map([[id,{version:2,job:{id,title:'new'}}],['deleted',{version:3,job:null}]])
 assert.deepEqual(reconcileSnapshot([{id,title:'old'},{id:'deleted'}],changes,1),[{id,title:'new'}])
})
test('a stale row request cannot resurrect a job deleted while the request was in flight',async()=>{
 let resolve
 const h=harness({fetchByIds:()=>new Promise(r=>{resolve=r})});await settle()
 h.event({eventType:'INSERT',new:{id}});const request=h.flush();h.event({eventType:'DELETE',old:{id}});resolve([{id}]);await request;assert.deepEqual(h.updates,[]);h.stop()
})
test('reconnect reconciles missed events and cleanup aborts in-flight requests',async()=>{
 let calls=0,signal
 const h=harness({fetchAll:async s=>{calls++;signal=s;return []}});await settle();h.status('SUBSCRIBED');await settle();assert.equal(calls,2);assert.deepEqual(h.states,['live']);h.status('CHANNEL_ERROR');assert.equal(h.states.at(-1),'reconnecting');h.stop();assert.equal(signal.aborted,true)
})
test('API targeted reads validate IDs, exclude internal fields, and disable CDN caching',async()=>{
 const filters=[]
 const q={select(){return this},eq(){return this},in(column,ids){filters.push([column,ids]);return this},order(){return this},range(){return this},async abortSignal(){return {data:[{id,publisher_id:'private',contact_info:'{"moderator":"private","company_name":"Public"}'}]}}}
 const handler=createJobsHandler({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret'},()=>({from(){return q}}))
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=JSON.parse(body)}}
 await handler({method:'GET',url:'/api/jobs?ids='+id},res)
 assert.equal(res.statusCode,200);assert.deepEqual(filters,[['id',[id]]]);assert.equal(res.body.hasMore,false);assert.ok(!JSON.stringify(res.body).includes('private'));assert.equal(res.headers['Vercel-CDN-Cache-Control'],'no-store')
 await handler({method:'GET',url:'/api/jobs?ids=invalid'},res);assert.equal(res.statusCode,400)
})
