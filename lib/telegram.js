export class TelegramDeliveryError extends Error{constructor(diagnostics){super('Telegram delivery failed');this.diagnostics=diagnostics}}
// Server only. Never import this module into the browser bundle.
export async function sendTelegramMessage(chatId,text,{env=process.env,fetcher=fetch}={}){
 if(!env.TELEGRAM_BOT_TOKEN)throw Error('Telegram is not configured')
 if(!/^[1-9]\d{0,19}$/.test(String(chatId)))throw Error('Invalid private chat')
 for(let attempt=0;attempt<3;attempt++){
  let response,body
  try{response=await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:String(chatId),text:String(text).slice(0,4000)}),signal:AbortSignal.timeout(8000)});body=await response.json()}catch{if(attempt===2)throw Error('Telegram delivery unavailable');continue}
  if(response.ok&&body.ok)return
  if(attempt===2||response.status!==429&&response.status<500)throw new TelegramDeliveryError({provider:'telegram',status:response.status,code:Number(body.error_code)||0})
  await new Promise(resolve=>setTimeout(resolve,Math.min(Number(body.parameters?.retry_after)||attempt+1,5)*1000))
 }
}
const name=value=>String(value||'').replace(/[\r\n\p{Cc}]/gu,' ').slice(0,200)
// Plain text avoids Markdown/HTML injection from job titles or names.
export function notifyPublisherNewApplication(publisherChatId,doctorName,jobTitle,options){return sendTelegramMessage(publisherChatId,`📩 متقدم جديد للوظيفة\n\nالاسم: ${name(doctorName)}\nالوظيفة: ${name(jobTitle)}\n\nراجع الطلب في حسابك على منصة Projecta Jobs.`,options)}
export function notifyApplicantInterviewScheduled(applicantChatId,clinicName,interviewDate,interviewTime,options){return sendTelegramMessage(applicantChatId,`📅 تم تحديد موعد مقابلة\n\nالعيادة: ${name(clinicName)}\nالتاريخ: ${name(interviewDate)}\nالوقت: ${name(interviewTime)} — بتوقيت بغداد\n\nراجع التفاصيل مع جهة العمل على منصة Projecta Jobs.`,options)}
