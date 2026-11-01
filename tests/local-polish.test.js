import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {salaryOptions} from '../config/salary-options.js'
import {licenseFileSpec,licenseUploadFile} from '../src/account/license-file.js'
import {inspectResume} from '../server/resumes.js'
import {PDFDocument} from 'pdf-lib'

test('monthly salary menu preserves ascending professional increments and explicit IQD values',()=>{
 assert.deepEqual(salaryOptions.map(option=>option.value),['500,000 IQD','750,000 IQD','1,000,000 IQD','1,250,000 IQD','1,500,000 IQD','2,000,000+ IQD'])
})
test('license uploads accept only bounded PDF/PNG/JPEG files',()=>{
 for(const [name,type] of [['license.pdf','application/pdf'],['license.png','image/png'],['license.jpg','image/jpeg']])assert.ok(licenseFileSpec({name,type,size:200}))
 for(const file of [{name:'x.svg',size:100,type:'image/svg+xml'},{name:'x.jpg',size:100,type:'text/html'},{name:'x.png',size:6*1024*1024,type:'image/png'}])assert.throws(()=>licenseFileSpec(file))
})
test('image license is converted to an inspected PDF without changing its page proportions',async()=>{
 const bytes=await readFile(new URL('./fixtures/license.png',import.meta.url)),file=new File([bytes],'license.png',{type:'image/png'})
 const output=await licenseUploadFile(file),buffer=Buffer.from(await output.arrayBuffer()),pdf=await PDFDocument.load(buffer)
 assert.equal(output.type,'application/pdf');assert.equal(output.name,'license.pdf');assert.equal(pdf.getPageCount(),1)
 assert.equal(pdf.getPage(0).getWidth()/pdf.getPage(0).getHeight(),0.75)
 assert.equal((await inspectResume(buffer,'pdf')).length,64)
 const original=new File([buffer],'original.pdf',{type:'application/pdf'});assert.equal(await licenseUploadFile(original),original)
})
test('malformed and oversized image headers are rejected before PDF conversion',async()=>{
 const header=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(header);header.writeUInt32BE(100000,16);header.writeUInt32BE(100000,20)
 await assert.rejects(()=>licenseUploadFile(new File([header],'huge.png',{type:'image/png'})),/دقة الصورة/)
 await assert.rejects(()=>licenseUploadFile(new File(['not a JPEG'],'fake.jpg',{type:'image/jpeg'})),/JPG/)
})
