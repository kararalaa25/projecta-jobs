import {serverClient} from '../../server/supabase.js'
import {headers,json,readBody,check,errorResponse} from '../../server/http.js'
import {safeEqual,verifyLink,tokenHash} from '../../server/telegram-link.js'
import {sendTelegramMessage} from '../../lib/telegram.js'
export const confirmation='✅ تم ربط حسابك بنجاح بـ منصة Projecta Jobs!\n\nستصلك كافة الإشعارات والمواعيد وتحديثات الوظائف مباشرة هنا.'
export function createTelegramWebhookHandler(env=process.env,factory=serverClient,send=sendTelegramMessage){return async(req,res)=>{
 headers(res);if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
 if(!env.TELEGRAM_WEBHOOK_SECRET||!env.TELEGRAM_BOT_TOKEN)return json(res,503,{error:'Bot not configured'})
 if(!safeEqual(req.headers?.['x-telegram-bot-api-secret-token'],env.TELEGRAM_WEBHOOK_SECRET))return json(res,401,{error:'Unauthorized'})
 try{const update=await readBody(req),message=update.message
 if(!Number.isSafeInteger(update.update_id)||!message||message.chat?.type!=='private'||!Number.isSafeInteger(message.chat.id)||message.chat.id<=0||message.from?.id!==message.chat.id)return json(res,200,{ok:true})
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
