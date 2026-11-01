import {MAX_RESUME_BYTES} from '../../config/resumes.js'
const formats={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'}
export function licenseFileSpec(file){
 const extension=String(file.name||'').split('.').at(-1).toLowerCase(),mime=formats[extension]
 if(!mime||file.type&&file.type!==mime&&file.type!=='application/octet-stream')throw Error('اختر صورة JPG أو PNG أو ملف PDF صالحاً.')
 if(!Number.isInteger(file.size)||file.size<1||file.size>MAX_RESUME_BYTES)throw Error('اختر ملفاً لا يتجاوز 5 ميغابايت.')
 return {extension,mime}
}
export async function licenseUploadFile(file){
 const {extension}=licenseFileSpec(file)
 if(extension==='pdf')return file
 // Convert locally so evidence uses the existing inspected, private PDF store.
 // This library is downloaded only after choosing an image, never on page load.
 const bytes=await file.arrayBuffer(),header=new DataView(bytes)
 if(extension==='png'){
  if(bytes.byteLength<24||header.getUint32(0)!==0x89504e47||header.getUint32(4)!==0x0d0a1a0a)throw Error('اختر صورة PNG صالحة.')
  if(header.getUint32(16)*header.getUint32(20)>25000000)throw Error('دقة الصورة كبيرة جداً. اختر صورة أصغر من 25 مليون بكسل.')
 }else if(bytes.byteLength<3||header.getUint16(0)!==0xffd8)throw Error('اختر صورة JPG صالحة.')
 const {PDFDocument}=await import('pdf-lib'),pdf=await PDFDocument.create()
 const image=extension==='png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes)
 if(image.width*image.height>25000000)throw Error('دقة الصورة كبيرة جداً. اختر صورة أصغر من 25 مليون بكسل.')
 const scale=Math.min(1,1600/Math.max(image.width,image.height)),width=image.width*scale,height=image.height*scale
 const page=pdf.addPage([width,height]);page.drawImage(image,{x:0,y:0,width,height})
 const output=new File([await pdf.save()],file.name.replace(/\.(png|jpe?g)$/i,'.pdf'),{type:'application/pdf'})
 if(output.size>MAX_RESUME_BYTES)throw Error('حجم الصورة بعد تجهيزها يتجاوز 5 ميغابايت. اختر صورة أصغر.')
 return output
}
