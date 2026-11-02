import {createNotificationSetupHandler} from '../server/notification-handlers/setup.js'
import {createTelegramLinkHandler} from '../server/notification-handlers/telegram-link.js'
import {createTelegramWebhookHandler} from '../server/notification-handlers/telegram-webhook.js'
import {createWhatsAppPreferencesHandler} from '../server/notification-handlers/whatsapp-preferences.js'
import {serverClient} from '../server/supabase.js'
import {headers,json,sameOrigin,authenticate,bearerToken,readBody,HttpError,errorResponse,check} from '../server/http.js'
import {isSuspended} from '../config/access.js'
import {profileCompletion} from '../config/account-profile.js'
import {getPrivateProfile,requestOf,saveProfile,submitVerification,withdrawVerification} from '../server/verifications.js'
export function createVerificationsHandler(env=process.env,factory=serverClient){return async(req,res)=>{
 const route=req.query?.notification||new URL(req.url||'/','http://localhost').searchParams.get('notification')
 const routes={'notification-setup':createNotificationSetupHandler,'telegram-link':createTelegramLinkHandler,'telegram-webhook':createTelegramWebhookHandler,'whatsapp-preferences':createWhatsAppPreferencesHandler}
 if(Object.hasOwn(routes,route||''))return routes[route](env,factory)(req,res)
 headers(res)
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return json(res,405,{error:'طريقة الطلب غير مسموحة.'})}
 try{
  sameOrigin(req,env);bearerToken(req);const db=factory(env),user=await authenticate(db,req)
  if(isSuspended(user))throw new HttpError(403,'هذا الحساب معلّق.')
  if(req.method==='GET'){
   const profile=await getPrivateProfile(db,user,{create:false})
   let cv=null
   if(profile?.cv_asset_id)cv=check(await db.from('resume_assets').select('id,filename,byte_size,mime_type,state').eq('id',profile.cv_asset_id).eq('user_id',user.id).maybeSingle())
   return json(res,200,{user,completion:profileCompletion(user),request:requestOf(profile),cv:cv?.state==='ready'?cv:null})
  }
  const body=await readBody(req)
  if(body.action==='profile.save'){const saved=await saveProfile(db,user,body);return json(res,200,{user:saved.user,completion:profileCompletion(saved.user),warning:saved.warning})}
  if(body.action==='verification.submit')return json(res,200,await submitVerification(db,user))
  if(body.action==='verification.withdraw')return json(res,200,await withdrawVerification(db,user))
  throw new HttpError(400,'عملية غير مسموحة.')
 }catch(error){return errorResponse(res,error)}
}}
export default createVerificationsHandler()
