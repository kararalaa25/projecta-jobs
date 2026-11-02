import test from 'node:test'
import assert from 'node:assert/strict'
import {issueLink,verifyLink,tokenHash,safeEqual} from '../server/telegram-link.js'
import {createTelegramWebhookHandler,confirmation} from '../server/notification-handlers/telegram-webhook.js'
import {createTelegramLinkHandler} from '../server/notification-handlers/telegram-link.js'
import {notifyPublisherNewApplication,notifyApplicantInterviewScheduled,sendTelegramMessage} from '../lib/telegram.js'
const env={TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_WEBHOOK_SECRET:'test-webhook-secret',TELEGRAM_LINK_SECRET:'a'.repeat(40)},id='22222222-2222-4222-8222-222222222222'
const output=()=>({setHeader(){},end(raw){this.body=JSON.parse(raw)}})
const request=token=>({method:'POST',headers:{'x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET},body:{update_id:101,message:{chat:{id:12345,type:'private'},from:{id:12345},text:`/start ${token}`}}})
test('deep link tokens fit Telegram limit, expire, and cannot substitute arbitrary account IDs',()=>{
 const {token}=issueLink(id,env,1000000000000)
 assert.ok(token.length<=64);assert.equal(verifyLink(token,env,1000000001000),id)
 assert.equal(verifyLink(token,env,1000000900000),null);assert.equal(verifyLink(token.slice(0,-1)+'X',env,1000000001000),null);assert.equal(verifyLink(id,env),null)
 assert.equal(safeEqual('é','a'),false)
})
test('webhook secret is checked before constructing privileged clients',async()=>{
 const req=request('bad');req.headers={};const res=output();await createTelegramWebhookHandler(env,()=>{throw Error('must not run')})(req,res);assert.equal(res.statusCode,401)
})
test('valid private start consumes token atomically and confirms in Arabic',async()=>{
 const {token}=issueLink(id,env),calls=[],sent=[],res=output()
 const db={async rpc(name,args){calls.push({name,args});return {data:true}}}
 await createTelegramWebhookHandler(env,()=>db,async(...args)=>sent.push(args))(request(token),res)
 assert.equal(res.statusCode,200);assert.equal(calls[0].args.owner_id,id);assert.equal(calls[0].args.token_digest,tokenHash(token));assert.equal(calls[0].args.chat_id,'12345');assert.equal(sent[0][1],confirmation)
})
test('raw UUIDs, groups, wrong sender and consumed tokens never bind or confirm',async()=>{
 const {token}=issueLink(id,env)
 for(const mutate of [req=>req.body.message.text=`/start ${id}`,req=>req.body.message.chat.type='group',req=>req.body.message.from.id=99]){
  const req=request(token);mutate(req);const res=output();await createTelegramWebhookHandler(env,()=>{throw Error('must not run')})(req,res);assert.equal(res.statusCode,200)
 }
 let sent=false;const res=output();await createTelegramWebhookHandler(env,()=>({async rpc(){return {data:false}}}),async()=>sent=true)(request(token),res);assert.equal(sent,false)
})
test('authenticated link endpoint refuses anonymous callers before database creation',async()=>{
 const res=output();await createTelegramLinkHandler(env,()=>{throw Error('must not run')})({method:'POST',headers:{}},res);assert.equal(res.statusCode,401)
})
test('notification helpers send plain Arabic text, never markup or token errors',async()=>{
 const messages=[],fetcher=async(url,init)=>{messages.push(JSON.parse(init.body));return {ok:true,status:200,async json(){return {ok:true}}}}
 await notifyPublisherNewApplication('12345','د. مثال','<وظيفة>',{env,fetcher});await notifyApplicantInterviewScheduled('12345','عيادة المثال','2026-11-10','10:00',{env,fetcher})
 assert.match(messages[0].text,/<وظيفة>/);assert.equal(messages[0].parse_mode,undefined);assert.match(messages[1].text,/بغداد/)
 await assert.rejects(()=>sendTelegramMessage('12345','test',{env,fetcher:async()=>({ok:false,status:403,async json(){return {ok:false}}})}),error=>!error.message.includes(env.TELEGRAM_BOT_TOKEN))
})
test('notification rewrite dispatch retains webhook authentication without adding functions',async()=>{
 const {createVerificationsHandler}=await import('../api/verifications.js')
 for(const request of [{method:'POST',url:'/api/verifications?notification=telegram-webhook',headers:{}},{method:'POST',url:'/api/telegram/webhook',query:{notification:'telegram-webhook'},headers:{}}]){
  const res=output();await createVerificationsHandler(env,()=>{throw Error('must not run')})(request,res);assert.equal(res.statusCode,401);assert.equal(res.body.error,'Unauthorized')
 }
})
