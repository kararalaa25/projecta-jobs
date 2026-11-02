import {serverClient} from '../supabase.js'
import {headers,json,sameOrigin,bearerToken,authenticate,check,errorResponse,HttpError} from '../http.js'
import {getPrivateProfile} from '../verifications.js'
import {hasConfirmedIdentity,isSuspended} from '../../config/access.js'
import {issueLink,tokenHash} from '../telegram-link.js'
export function createTelegramLinkHandler(env=process.env,factory=serverClient){return async(req,res)=>{
 headers(res);if(req.method!=='POST')return json(res,405,{error:'طريقة الطلب غير مسموحة.'})
 try{sameOrigin(req,env);bearerToken(req);const db=factory(env),user=await authenticate(db,req)
 if(!hasConfirmedIdentity(user)||isSuspended(user))throw new HttpError(403,'أكّد حسابك أولاً.')
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)throw new HttpError(503,'خدمة إشعارات التليجرام غير مهيأة.')
 const link=issueLink(user.id,env);await getPrivateProfile(db,user)
 check(await db.from('profiles').update({telegram_link_token_hash:tokenHash(link.token),telegram_link_expires_at:link.expiresAt}).eq('user_id',user.id))
 return json(res,200,{url:`https://t.me/ProjectaJobsBot?start=${link.token}`,expiresAt:link.expiresAt})
 }catch(error){return errorResponse(res,error)}
}}
export default createTelegramLinkHandler()
