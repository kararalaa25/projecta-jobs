import {createHash} from 'node:crypto'
import {serverClient} from '../supabase.js'
import {headers,json,readBody,check,errorResponse} from '../http.js'
import {safeEqual,verifyLink,tokenHash} from '../telegram-link.js'
import {sendTelegramMessage} from '../../lib/telegram.js'
import {telegramTextAllowed} from '../../lib/telegram-prefilter.js'
export const confirmation='✅ تم ربط حسابك بنجاح بـ منصة Projecta Jobs!\n\nستصلك كافة الإشعارات والمواعيد وتحديثات الوظائف مباشرة هنا.'
const PARSER_VERSION=3
const allowedChannels=env=>[...new Set(String(env.TELEGRAM_CHANNELS||'').split(',')
 .map(value=>value.trim().replace(/^https:\/\/t\.me\//i,'').replace(/^s\//,'').replace(/\/+$/,'').replace(/^@/,'').toLowerCase())
 .filter(Boolean))]
const channelName=(chat,allowed)=>{
 if(!chat||chat.type!=='channel'||!Number.isSafeInteger(chat.id)||chat.id===0)return null
 const username=typeof chat.username==='string'?chat.username.replace(/^@/,'').toLowerCase():null
 if(username&&allowed.includes(username))return username
 const id=String(chat.id)
 return allowed.includes(id)?id:null
}
const enqueueChannelPost=async(factory,update,post,env)=>{
 const channel=channelName(post.chat,allowedChannels(env))
 if(!channel||!Number.isSafeInteger(post.message_id)||post.message_id<=0||post.date==null)return false
 const rawText=String(post.text||post.caption||'')
 // New chatter never reaches the inbox. Edits are always retained so a removed
 // offer can still delete its previously published jobs.
 if(!update.edited_channel_post&&!telegramTextAllowed(rawText))return false
 const epoch=Number(post.date)
 if(!Number.isFinite(epoch))return false
 const postedAt=new Date(epoch*1000)
 if(Number.isNaN(postedAt.getTime()))return false
 // Construct the service-role client only after every local check passes.
 const db=factory(env)
 check(await db.rpc('enqueue_telegram_message',{p_message:{
  message_key:`${channel}:${post.message_id}`,chat_id:post.chat.id,channel,
  message_id:post.message_id,raw_text:rawText,posted_at:postedAt.toISOString(),
  observed_at:new Date().toISOString(),
  source_hash:createHash('sha256').update(rawText,'utf8').digest('hex'),
 },p_parser_version:PARSER_VERSION}))
 return true
}
export function createTelegramWebhookHandler(env=process.env,factory=serverClient,send=sendTelegramMessage){return async(req,res)=>{
 headers(res);if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
 if(!env.TELEGRAM_WEBHOOK_SECRET||!env.TELEGRAM_BOT_TOKEN)return json(res,503,{error:'Bot not configured'})
 if(!safeEqual(req.headers?.['x-telegram-bot-api-secret-token'],env.TELEGRAM_WEBHOOK_SECRET))return json(res,401,{error:'Unauthorized'})
 try{const update=await readBody(req)
 if(!Number.isSafeInteger(update.update_id))return json(res,200,{ok:true})
 const channelPost=update.channel_post||update.edited_channel_post
 if(channelPost){await enqueueChannelPost(factory,update,channelPost,env);return json(res,200,{ok:true})}
 const message=update.message
 if(!message||message.chat?.type!=='private'||!Number.isSafeInteger(message.chat.id)||message.chat.id<=0||message.from?.id!==message.chat.id)return json(res,200,{ok:true})
 if(message.text?.trim()==='/stop'){const db=factory(env);check(await db.from('profiles').update({telegram_chat_id:null,telegram_link_token_hash:null,telegram_link_expires_at:null,telegram_last_update_id:null}).eq('telegram_chat_id',String(message.chat.id)));await send(String(message.chat.id),'تم إيقاف إشعارات Projecta Jobs وفصل حساب التليجرام.',{env});return json(res,200,{ok:true})}
 const command=/^\/start(?:@ProjectaJobsBot)?\s+([A-Za-z0-9_-]{1,64})\s*$/i.exec(message.text||''),token=command?.[1],userId=verifyLink(token,env)
 if(!userId)return json(res,200,{ok:true})
 const db=factory(env),chat=String(message.chat.id)
 // The SQL function atomically consumes the one-time token and binds the chat.
 const linked=check(await db.rpc('projecta_link_telegram',{owner_id:userId,token_digest:tokenHash(token),chat_id:chat,telegram_update:update.update_id}))
 if(linked)await send(chat,confirmation,{env})
 return json(res,200,{ok:true})
 }catch(error){return errorResponse(res,error)}
 }}
export default createTelegramWebhookHandler()
