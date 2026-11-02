import {serverClient} from '../../server/supabase.js'
import {headers,json,sameOrigin,bearerToken,authenticate,readBody,HttpError,check,errorResponse} from '../../server/http.js'
import {getPrivateProfile} from '../../server/verifications.js'
import {hasConfirmedIdentity,isSuspended} from '../../config/access.js'
import {formatIraqiPhoneNumber} from '../../lib/phone.ts'
export function createWhatsAppPreferencesHandler(env=process.env,factory=serverClient){return async(req,res)=>{
 headers(res);if(!['GET','POST'].includes(req.method))return json(res,405,{error:'طريقة الطلب غير مسموحة.'})
 try{sameOrigin(req,env);bearerToken(req);const db=factory(env),user=await authenticate(db,req)
 if(!hasConfirmedIdentity(user)||isSuspended(user))throw new HttpError(403,'أكّد حسابك أولاً.')
 if(req.method==='GET'){const profile=check(await db.from('profiles').select('whatsapp_phone,whatsapp_opt_in').eq('user_id',user.id).maybeSingle());return json(res,200,{phone:profile?.whatsapp_phone||'',optIn:profile?.whatsapp_opt_in===true})}
 const body=await readBody(req,2000);if(typeof body.optIn!=='boolean')throw new HttpError(400,'اختر الموافقة على إشعارات واتساب صراحةً.')
 let phone=null;if(body.optIn)try{phone=formatIraqiPhoneNumber(body.phone)}catch{throw new HttpError(400,'أدخل رقم واتساب عراقياً صالحاً.')}
 await getPrivateProfile(db,user)
 check(await db.from('profiles').update({whatsapp_phone:phone,whatsapp_opt_in:body.optIn}).eq('user_id',user.id))
 return json(res,200,{phone:phone||'',optIn:body.optIn})
 }catch(error){return errorResponse(res,error)}
}}
export default createWhatsAppPreferencesHandler()
