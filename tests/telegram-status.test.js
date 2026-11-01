import test from 'node:test'
import assert from 'node:assert/strict'
import {publicSyncStatus,createTelegramStatusHandler} from '../api/telegram-status.js'
const now=Date.parse('2026-11-01T00:10:00Z')
test('sync status distinguishes recent checks from old posts, stalled checks and in-progress work',()=>{
 assert.deepEqual(publicSyncStatus({last_success_at:'2026-11-01T00:05:00Z'},now),{lastCheckedAt:'2026-11-01T00:05:00.000Z',intervalSeconds:300,status:'ok'})
 assert.equal(publicSyncStatus({last_success_at:'2026-10-31T23:00:00Z'},now).status,'delayed')
 assert.equal(publicSyncStatus({last_success_at:'2026-11-01T00:05:00Z',last_error:'private-error'},now).status,'delayed')
 assert.equal(publicSyncStatus({lease_until:'2026-11-01T00:12:00Z'},now).status,'checking')
 for(const row of [undefined,{last_success_at:'invalid'},{last_success_at:'2099-01-01'}])assert.equal(publicSyncStatus(row,now).lastCheckedAt,null)
})
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=JSON.parse(value)}}}
test('public status exposes only safe aggregate metadata and never caches it',async()=>{
 let selected
 const q={select(v){selected=v;return this},eq(){return this},limit(){return this},async abortSignal(){return {data:[{last_success_at:new Date().toISOString(),last_error:null,lease_owner:'private-owner',last_summary:{private:'do-not-publish'}}]}}}
 const res=response();await createTelegramStatusHandler({},()=>({from(table){assert.equal(table,'telegram_sync_control');return q}}))({method:'GET'},res)
 assert.equal(res.statusCode,200);assert.equal(res.body.intervalSeconds,300);assert.ok(!JSON.stringify(res.body).includes('private'));assert.ok(!selected.includes('lease_owner'));assert.equal(res.headers['Vercel-CDN-Cache-Control'],'no-store')
})
test('status rejects writes and reports failures without exposing credentials',async()=>{
 const res=response();let called=false
 const handler=createTelegramStatusHandler({},()=>{called=true;throw Error('private-key')})
 await handler({method:'POST'},res);assert.equal(res.statusCode,405);assert.equal(called,false)
 await handler({method:'GET'},res);assert.equal(res.statusCode,503);assert.deepEqual(res.body,{lastCheckedAt:null,intervalSeconds:300,status:'unknown'})
})
