import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,createHmac} from 'node:crypto'
import {telegramTextAllowed} from '../lib/telegram-prefilter.js'
import {issueLink,verifyLink,tokenHash,safeEqual} from '../server/telegram-link.js'
import {createTelegramWebhookHandler,confirmation} from '../server/notification-handlers/telegram-webhook.js'
import {createTelegramLinkHandler} from '../server/notification-handlers/telegram-link.js'
import {notifyPublisherNewApplication,notifyApplicantInterviewScheduled,sendTelegramMessage} from '../lib/telegram.js'
const env={TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_WEBHOOK_SECRET:'test-webhook-secret',TELEGRAM_LINK_SECRET:'a'.repeat(40),TELEGRAM_CHANNELS:'@clinic_jobs'},id='22222222-2222-4222-8222-222222222222'
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
test('pure JS gate rejects short and unrelated channel posts',()=>{
 assert.equal(telegramTextAllowed('شكرا للجميع'),false)
 assert.equal(telegramTextAllowed('random unrelated announcement with no useful tokens here'),false)
 assert.equal(telegramTextAllowed('مطلوب صيدلاني للعمل في بغداد هاتف 07701234567'),true)
 assert.equal(telegramTextAllowed('Dentist needed at our Baghdad clinic'),true)
})
test('allowlisted channel posts are durably enqueued without AI or account linking',async()=>{
 const text='مطلوب طبيب أسنان للعمل في عيادة ببغداد هاتف 07701234567'
 const calls=[],db={async rpc(name,args){calls.push({name,args});return {data:{state:'pending'}}}}
 const res=output(),req={method:'POST',headers:{'x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET},body:{update_id:202,channel_post:{message_id:88,date:1762888800,chat:{id:-1001234567890,type:'channel',username:'clinic_jobs'},text}}}
 await createTelegramWebhookHandler(env,()=>db,()=>{throw Error('must not send')})(req,res)
 assert.equal(res.statusCode,200);assert.equal(calls.length,1);assert.equal(calls[0].name,'enqueue_telegram_message')
 const message=calls[0].args.p_message
 assert.equal(message.message_key,'clinic_jobs:88');assert.equal(message.channel,'clinic_jobs');assert.equal(message.message_id,88)
 assert.equal(message.raw_text,text);assert.equal(message.chat_id,-1001234567890)
 assert.equal(message.source_hash,createHash('sha256').update(text,'utf8').digest('hex'))
 assert.equal(calls[0].args.p_parser_version,3)
})
test('channel allowlist normalizes URLs and casing',async()=>{
 const calls=[],db={async rpc(name,args){calls.push({name,args});return {data:{state:'pending'}}}}
 const env2={...env,TELEGRAM_CHANNELS:'https://t.me/Clinic_Jobs'}
 const res=output(),req={method:'POST',headers:{'x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET},body:{update_id:206,channel_post:{message_id:91,date:1762888800,chat:{id:-1001234567890,type:'channel',username:'clinic_jobs'},text:'مطلوب طبيب أسنان للعمل في عيادة ببغداد هاتف 07701234567'}}}
 await createTelegramWebhookHandler(env2,()=>db)(req,res)
 assert.equal(res.statusCode,200);assert.equal(calls.length,1);assert.equal(calls[0].args.p_message.channel,'clinic_jobs')
})
test('unlisted channels and irrelevant new posts never open a privileged client',async()=>{
 const factory=()=>{throw Error('must not run')},handler=createTelegramWebhookHandler(env,factory)
 const base={method:'POST',headers:{'x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET}}
 for(const body of [
  {update_id:203,channel_post:{message_id:89,date:1762888800,chat:{id:-100999,type:'channel',username:'other_channel'},text:'مطلوب طبيب أسنان للعمل في بغداد هاتف 07701234567'}},
  {update_id:204,channel_post:{message_id:90,date:1762888800,chat:{id:-1001234567890,type:'channel',username:'clinic_jobs'},text:'شكرا للجميع'}},
 ]){
  const res=output();await handler({...base,body},res);assert.equal(res.statusCode,200)
 }
})
test('edited channel posts are retained even when the new text is filtered',async()=>{
 const calls=[],db={async rpc(name,args){calls.push({name,args});return {data:{state:'pending'}}}}
 const res=output(),req={method:'POST',headers:{'x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET},body:{update_id:205,edited_channel_post:{message_id:88,date:1762888800,chat:{id:-1001234567890,type:'channel',username:'clinic_jobs'},text:'تم الاغلاق'}}}
 await createTelegramWebhookHandler(env,()=>db)(req,res)
 assert.equal(res.statusCode,200);assert.equal(calls.length,1);assert.equal(calls[0].args.p_message.raw_text,'تم الاغلاق')
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
test('operational provider setup denies callers without a fresh signature',async()=>{
 const {createNotificationSetupHandler}=await import('../server/notification-handlers/setup.js');const res=output();await createNotificationSetupHandler(env,null,()=>{throw Error('must not run')})({method:'POST',headers:{},body:{action:'telegram.register'}},res);assert.equal(res.statusCode,401)
})
test('webhook registration includes channel posts for push ingestion',async()=>{
 const {createNotificationSetupHandler}=await import('../server/notification-handlers/setup.js')
 const timestamp=String(Date.now()),signature=createHmac('sha256',env.TELEGRAM_LINK_SECRET).update(`${timestamp}:telegram.register`).digest('hex')
 let payload
 const fetcher=async(url,init)=>{payload=JSON.parse(init.body);return {status:200,async json(){return {ok:true}}}}
 const res=output()
 await createNotificationSetupHandler(env,null,fetcher)({method:'POST',headers:{'x-projecta-timestamp':timestamp,'x-projecta-signature':signature},body:{action:'telegram.register'}},res)
 assert.equal(res.statusCode,200);assert.deepEqual(payload.allowed_updates,['message','channel_post','edited_channel_post'])
})
