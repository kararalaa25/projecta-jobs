import { normalizeIraqiPhone } from './contacts.js'
export const isVerifiedProfessional=user=>Boolean(user?.app_metadata?.medical_professional_verified===true&&(user.email_confirmed_at||user.phone_confirmed_at))
export function iraqiAuthPhone(value){const phone=normalizeIraqiPhone(value);return phone?'+'+phone.whatsapp:null}
export function authError(error){
 const code=String(error?.code||'');const message=String(error?.message||'').toLowerCase()
 if(/rate|too_many|over_/.test(code)||/rate limit/.test(message))return 'وصلت إلى الحد المسموح للمحاولات. يرجى الانتظار قبل إعادة المحاولة.'
 if(/otp_expired|otp_disabled|invalid_credentials/.test(code)||/token.*(expired|invalid)/.test(message))return 'رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.'
 if(/provider|phone_provider_disabled|sms_send_failed/.test(code)||/provider.*(disabled|not enabled)|unsupported provider/.test(message))return 'طريقة الدخول غير متاحة حالياً. يرجى استخدام البريد الإلكتروني أو مراجعة إدارة المنصة.'
 return 'تعذر إتمام العملية. تحقق من البيانات والاتصال وحاول مجدداً.'
}
export async function requestCode(client,method,target,signup){
 if(!client)throw Error('Auth not configured')
 return client.auth.signInWithOtp(method==='email'?{email:target.trim().toLowerCase(),options:{shouldCreateUser:signup}}:{phone:target,options:{shouldCreateUser:signup}})
}
export async function verifyCode(client,method,target,token){
 return client.auth.verifyOtp(method==='email'?{email:target.trim().toLowerCase(),token,type:'email'}:{phone:target,token,type:'sms'})
}

export const normalizeOtp=value=>String(value).replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\D/g,'')
