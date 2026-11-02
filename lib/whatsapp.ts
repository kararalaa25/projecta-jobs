// Server only. Do not import into frontend components.
import {formatIraqiPhoneNumber} from './phone.ts'
export class WhatsAppDeliveryError extends Error{diagnostics:Record<string,string|number|boolean>;constructor(diagnostics:Record<string,string|number|boolean>){super('تعذر تأكيد إرسال إشعار واتساب.');this.diagnostics=diagnostics;this.name='WhatsAppDeliveryError'}}
type Options={env?:Record<string,string|undefined>;fetcher?:typeof fetch}
export async function sendWhatsAppTemplateMessage(recipientPhone:string,templateName:string,languageCode:string,parameters:string[],{env=process.env,fetcher=fetch}:Options={}){
 const to=formatIraqiPhoneNumber(recipientPhone),version=env.WHATSAPP_GRAPH_API_VERSION||'v17.0'
 if(!env.WHATSAPP_ACCESS_TOKEN?.trim()||env.WHATSAPP_ACCESS_TOKEN.includes('<')||!/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID||''))throw Error('WhatsApp is not configured')
 if(!/^v\d+\.\d+$/.test(version)||!/^\w{1,512}$/.test(templateName)||! /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(languageCode)||!Array.isArray(parameters)||parameters.some(p=>typeof p!=='string'||!p.trim()||p.length>1000))throw Error('Invalid WhatsApp template parameters')
 try{
  const response=await fetcher(`https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'template',template:{name:templateName,language:{code:languageCode},...(parameters.length?{components:[{type:'body',parameters:parameters.map(text=>({type:'text',text}))}]}:{})}}),signal:AbortSignal.timeout(8000)})
  const body=await response.json()
  if(!response.ok||!body.messages?.[0]?.id)throw new WhatsAppDeliveryError({provider:'whatsapp',status:response.status,code:Number(body.error?.code)||0,subcode:Number(body.error?.error_subcode)||0,template:templateName,language:languageCode,version})
  return {messageId:String(body.messages[0].id)}
 }catch(error){if(error instanceof WhatsAppDeliveryError)throw error;throw new WhatsAppDeliveryError({provider:'whatsapp',reason:'network_or_invalid_response',template:templateName,language:languageCode,version})} // Never expose access tokens or upstream payloads.
}
const clean=(value:string)=>String(value||'').replace(/[\r\n\p{Cc}]/gu,' ').trim().slice(0,200)||'غير محدد'
export function notifyPublisherWhatsAppNewApplication(publisherPhone:string,doctorName:string,jobTitle:string,publisherName='صاحب العيادة',options:Options={}){
 return sendWhatsAppTemplateMessage(publisherPhone,'new_job_applicant',options.env?.WHATSAPP_TEMPLATE_LANGUAGE||process.env.WHATSAPP_TEMPLATE_LANGUAGE||'ar',[clean(publisherName),clean(doctorName),clean(jobTitle)],options)
}
export function notifyApplicantWhatsAppInterviewScheduled(applicantPhone:string,clinicName:string,interviewDate:string,interviewTime:string,applicantName='المحترم',options:Options={}){
 return sendWhatsAppTemplateMessage(applicantPhone,'interview_scheduled',options.env?.WHATSAPP_TEMPLATE_LANGUAGE||process.env.WHATSAPP_TEMPLATE_LANGUAGE||'ar',[clean(applicantName),clean(clinicName),clean(interviewDate),clean(interviewTime)],options)
}
