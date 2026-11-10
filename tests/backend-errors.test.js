import test from 'node:test'
import assert from 'node:assert/strict'
import {backendReason,safeBackendCode} from '../server/backend-errors.js'
test('backend diagnostics distinguish URL, credentials, schema, grants and network errors without exposing values',()=>{
 assert.equal(backendReason(Error('Invalid supabaseUrl: private-value')),'configuration')
 assert.equal(backendReason({code:'42501'}),'permissions')
 assert.equal(backendReason({code:'42703'}),'schema')
 assert.equal(backendReason({},401),'credentials')
 assert.equal(backendReason({message:'TypeError: fetch failed'}),'connection')
 assert.equal(safeBackendCode({code:'ERR_INVALID_URL'}),'ERR_INVALID_URL')
 assert.equal(safeBackendCode({code:'secret-api-token'}),undefined)
 assert.equal(safeBackendCode({code:'PGRST205'}),'PGRST205')
})

import {normalizeSupabaseUrl} from '../config/supabase-url.js'
import {serverClient} from '../server/supabase.js'
import {createJobsHandler} from '../api/jobs.js'
test('Supabase SDK receives a project root for API, auth and table URLs',()=>{
 for(const path of ['','/','/rest/v1','/rest/v1/','/rest/v1/job_offers?select=id','/auth/v1','/storage/v1/object/public/file'])assert.equal(normalizeSupabaseUrl('https://project.supabase.co'+path),'https://project.supabase.co')
 assert.equal(normalizeSupabaseUrl('  https://proxy.example/supabase/rest/v1/  '),'https://proxy.example/supabase')
 assert.throws(()=>normalizeSupabaseUrl('secret-invalid-value'),{code:'SERVER_CONFIG'})
 assert.throws(()=>normalizeSupabaseUrl('https://username:password@example.test'),{code:'SERVER_CONFIG'})
 assert.equal(backendReason({code:'PGRST125'}),'configuration')
})
test('service-role clients normalize API URLs while retaining auth settings and the original key',()=>{
 let captured;serverClient({SUPABASE_URL:'https://project.supabase.co/rest/v1',SUPABASE_SERVICE_ROLE_KEY:'test-private-key'},(...args)=>{captured=args;return {}})
 assert.equal(captured[0],'https://project.supabase.co');assert.equal(captured[1],'test-private-key');assert.equal(captured[2].auth.persistSession,false)
})
test('jobs feed normalizes the base URL and keeps legacy optional-contact compatibility',async()=>{
 let url,calls=0;const query={select(){return this},eq(){return this},gt(){return this},order(){return this},range(){return this},async abortSignal(){calls++;return calls===1?{error:{code:'42703'}}:{data:[{id:'active-job'}],error:null}}}
 const res={setHeader(){},end(raw){this.body=JSON.parse(raw)}}
 await createJobsHandler({SUPABASE_URL:'https://project.supabase.co/rest/v1',SUPABASE_SERVICE_ROLE_KEY:'test-private-key'},value=>{url=value;return {from(){return query}}})({method:'GET',url:'/'},res)
 assert.equal(url,'https://project.supabase.co');assert.equal(res.statusCode,200);assert.equal(calls,2);assert.equal(res.body.jobs[0].id,'active-job')
})

test('direct Vercel-style server requests have a timeout and preserve caller cancellation',async()=>{
 let options;serverClient({SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-private-key'},(_url,_key,config)=>{options=config;return {}})
 const original=globalThis.fetch;let signal
 try{globalThis.fetch=async(_input,init)=>{signal=init.signal;return {ok:true}}
  await options.global.fetch('https://project.supabase.co/rest/v1/job_offers',{});assert.ok(signal instanceof AbortSignal)
  const controller=new AbortController();controller.abort();await options.global.fetch('https://project.supabase.co/rest/v1/job_offers',{signal:controller.signal});assert.equal(signal.aborted,true)
 }finally{globalThis.fetch=original}
})
