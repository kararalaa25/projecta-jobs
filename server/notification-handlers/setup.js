// Restricted operational endpoint: fixed provider operations, no message sending.
import {createHmac} from 'node:crypto'
import {safeEqual} from '../telegram-link.js'
import {headers,json,readBody} from '../http.js'
export function createNotificationSetupHandler(env=process.env,factory=null,fetcher=fetch){return async(req,res)=>{
 headers(res);if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
 const timestamp=req.headers?.['x-projecta-timestamp'],signature=req.headers?.['x-projecta-signature']
 if(!env.TELEGRAM_LINK_SECRET||!/^\d{13}$/.test(timestamp||'')||Math.abs(Date.now()-Number(timestamp))>60000)return json(res,401,{error:'Unauthorized'})
 let body;try{body=await readBody(req,1000)}catch{return json(res,400,{error:'Invalid request'})}
 const action=body.action,expected=createHmac('sha256',env.TELEGRAM_LINK_SECRET).update(`${timestamp}:${action}`).digest('hex')
 if(!safeEqual(signature,expected))return json(res,401,{error:'Unauthorized'})
 if(!['telegram.info','telegram.register','whatsapp.inspect'].includes(action))return json(res,400,{error:'Invalid operation'})
 try{
  if(action.startsWith('telegram.')){
   if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)return json(res,503,{error:'Telegram not configured'})
   const operation=action==='telegram.register'?'setWebhook':'getWebhookInfo'
   const response=await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(operation==='setWebhook'?{url:'https://projecta-jobs.vercel.app/api/telegram/webhook',secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message']}:{}),signal:AbortSignal.timeout(12000)}),data=await response.json()
   return json(res,200,{provider:'telegram',status:response.status,ok:data.ok===true,errorCode:data.error_code||null,...(operation==='getWebhookInfo'?{url:data.result?.url||'',pendingUpdates:data.result?.pending_update_count||0,lastError:data.result?.last_error_message||null}:{})})
  }
  if(!env.WHATSAPP_ACCESS_TOKEN||!/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID||''))return json(res,503,{error:'WhatsApp not configured'})
  const version=env.WHATSAPP_GRAPH_API_VERSION||'v17.0';if(!/^v\d+\.\d+$/.test(version))return json(res,503,{error:'Invalid API version'})
  const response=await fetcher(`https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}?fields=id`,{headers:{Authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`},signal:AbortSignal.timeout(12000)}),data=await response.json()
  return json(res,200,{provider:'whatsapp',status:response.status,ok:response.ok,version,code:data.error?.code||null,subcode:data.error?.error_subcode||null,type:data.error?.type||null})
 }catch{return json(res,502,{error:'Provider request failed; credentials withheld'})}
}}
