/** Iraqi mobile numbers in Meta's digits-only international format. */
export function formatIraqiPhoneNumber(phone: string): string {
 let digits=String(phone||'').replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\D/g,'')
 if(digits.startsWith('00964'))digits=digits.slice(2)
 const national=digits.startsWith('964')?digits.slice(3).replace(/^0/,''):digits.replace(/^0/,'')
 if(!/^7\d{9}$/.test(national))throw new Error('أدخل رقم هاتف عراقي صالحاً.')
 return `964${national}`
}
