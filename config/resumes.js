export const RESUME_BUCKET='projecta-resumes'
export const MAX_RESUME_BYTES=5*1024*1024
export const RESUME_TYPES={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
export function resumeFileSpec(name,size,type=''){
 const extension=String(name||'').split('.').at(-1).toLowerCase()
 if(!Object.hasOwn(RESUME_TYPES,extension))throw Error('اختر سيرة ذاتية بصيغة PDF أو DOCX فقط.')
 if(!Number.isInteger(size)||size<1||size>MAX_RESUME_BYTES)throw Error('حجم الملف يجب أن يكون بين بايت واحد و5 ميغابايت.')
 if(type&&type!==RESUME_TYPES[extension]&&type!=='application/octet-stream'&&!(extension==='docx'&&type==='application/zip'))throw Error('نوع الملف لا يطابق امتداده. اختر ملف PDF أو DOCX صالحاً.')
 const filename=String(name).normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/[^\p{L}\p{N}._ -]/gu,'_').slice(-180)
 return {filename,extension,mime:RESUME_TYPES[extension],size}
}
