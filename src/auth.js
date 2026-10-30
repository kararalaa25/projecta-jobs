import { normalizeIraqiPhone } from './contacts.js'
export const isVerifiedProfessional=user=>Boolean(user?.app_metadata?.medical_professional_verified===true&&(user.email_confirmed_at||user.phone_confirmed_at))
export function iraqiAuthPhone(value){const phone=normalizeIraqiPhone(value);return phone?'+'+phone.whatsapp:null}
export function authError(error,method){
 const code=String(error?.code||'');const message=String(error?.message||'').toLowerCase()
 if(/rate|too_many|over_/.test(code)||/rate limit/.test(message))return 'وصلت إلى الحد المسموح للمحاولات. يرجى الانتظار قبل إعادة المحاولة.'
 if(/otp_expired|otp_disabled|invalid_credentials/.test(code)||/token.*(expired|invalid)/.test(message))return 'رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.'
 if(/sms_send_failed|phone_provider_disabled/.test(code)||/sms.*(failed|disabled|not configured)|phone.*(disabled|not enabled)/.test(message))return providerHelper('phone')
 if(/email_provider_disabled|email.*(disabled|not enabled)/.test(code+' '+message))return providerHelper('email')
 if(/provider|oauth/.test(code)||/provider.*(disabled|not enabled)|unsupported provider/.test(message))return method==='google'?providerHelper('google'):'طريقة الدخول غير متاحة حالياً. يرجى استخدام طريقة أخرى.'
 if(/access_denied/.test(code))return 'لم يكتمل الدخول عبر Google. يمكنك المحاولة مجدداً أو استخدام البريد الإلكتروني.'
 if(/signup_disabled|user_not_found/.test(code)||/signups not allowed|user not found/.test(message))return 'الحساب غير موجود أو التسجيل الجديد غير متاح. تحقق من بريدك أو اختر إنشاء حساب.'
 if(/email.*send|smtp|email.*deliver/.test(code+' '+message))return 'تعذر إرسال البريد. حاول لاحقاً أو تواصل مع الإدارة للتحقق من إعدادات البريد.'
 if(/fetch|network|timeout/.test(message))return 'تعذر الاتصال بخدمة الدخول. تحقق من الإنترنت وأعد المحاولة.'
 return 'تعذر إتمام العملية. تحقق من البيانات والاتصال وحاول مجدداً.'
}
export async function requestCode(client,method,target,signup){
 if(!client)throw Error('Auth not configured')
 return client.auth.signInWithOtp(method==='email'?{email:target.trim().toLowerCase()}:{phone:target,options:{shouldCreateUser:signup}})
}
export async function verifyCode(client,method,target,token){
 if(method==='email'&&!/^[0-9]{6}$/.test(token))throw Error('Invalid six-digit email OTP')
 return client.auth.verifyOtp(method==='email'?{email:target.trim().toLowerCase(),token,type:'email'}:{phone:target,token,type:'sms'})
}

export const normalizeOtp=value=>String(value).replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\D/g,'')

// Public Supabase settings expose provider availability, never gateway credentials.
export async function loadAuthProviders(client, fetcher = fetch) {
 if (!client) return { google: false, email: false, phone: false }
 const response = await fetcher(`${client.supabaseUrl}/auth/v1/settings`, {
  headers: { apikey: client.supabaseKey }, signal: AbortSignal.timeout(8000),
 })
 if (!response.ok) throw Error('Provider settings unavailable')
 const settings = await response.json()
 if (!settings.external || typeof settings.external !== 'object') throw Error('Invalid provider settings')
 return Object.fromEntries(['google','email','phone'].map(method => [method, typeof settings.external[method] === 'boolean' ? settings.external[method] : null]))
}
export const providerHelper = method => ({
 google: 'الدخول عبر Google غير متاح حالياً. استخدم البريد الإلكتروني. يتطلب تفعيله من إدارة المنصة في Supabase ضمن Authentication → Providers.',
 phone: 'الدخول برسائل SMS غير متاح حالياً. يتطلب تفعيل مزوّد الهاتف وإعداد بوابة الرسائل من إدارة المنصة. يمكنك استخدام البريد الإلكتروني.',
 email: 'الدخول بالبريد الإلكتروني غير متاح حالياً. يرجى مراجعة إدارة المنصة.',
}[method])

export function signInWithGoogle(client){
 return client.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://projecta-jobs.vercel.app'}})
}
