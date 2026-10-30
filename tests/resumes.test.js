import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {resumeFileSpec,MAX_RESUME_BYTES} from '../config/resumes.js'
import {inspectResume,attachResume} from '../server/resumes.js'
import {createResumesHandler} from '../api/resumes.js'
import {errorResponse} from '../server/http.js'
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',assetId='33333333-3333-4333-8333-333333333333'
const user={id,email:'person@example.test',email_confirmed_at:'2026-01-01',app_metadata:{}}
const req=(body,method='POST')=>({method,headers:{authorization:'Bearer valid-token',host:'jobs.test',origin:'https://jobs.test'},body,url:'/api/resumes?id='+assetId})
const res=()=>({setHeader(){},end(raw){this.body=JSON.parse(raw)}})
const pdf=Buffer.from('%PDF-1.7\nA test document\n%%EOF\n')
function db(options={}){
 const writes=[];const asset={id:assetId,user_id:id,object_path:`${id}/${assetId}.pdf`,filename:'cv.pdf',mime_type:'application/pdf',byte_size:pdf.length,state:'pending',expires_at:'2099-01-01',...options.asset}
 return {writes,auth:{async getUser(){return {data:{user:options.user||user}}}},from(table){const q={select(){return this},eq(k,v){writes.push({filter:[k,v],table});return this},update(v){writes.push({update:v,table});if(table==='resume_assets')Object.assign(asset,v);return this},order(){return this},async maybeSingle(){return {data:table==='platform_settings'?{value:{maintenance:false}}:table==='resume_assets'?options.missing?null:asset:null}},async single(){return {data:asset}},then(resolve){return Promise.resolve(table==='admin_catalog'?{data:[]}:{count:options.references||0}).then(resolve)}};return q},async rpc(name,args){writes.push({rpc:name,args});if(name==='projecta_discard_resume')return options.references?{error:{code:'P0001',message:'resume_in_use'}}:{data:asset.object_path};return options.quota?{error:{code:'P0001'}}:{data:null}},storage:{from(bucket){writes.push({bucket});return {async createSignedUploadUrl(path,options){writes.push({path,options});return {data:{token:'scoped-upload-token'}}},async download(){return {data:new Blob([options.file||pdf])}},async remove(paths){writes.push({removed:paths});return {data:[]}},async createSignedUrl(path,ttl,options){writes.push({signedPath:path,ttl,options});return {data:{signedUrl:'https://storage.example.test/scoped-token'}}}}}}}
}
test('resume metadata validation enforces size, extension, MIME and safe display names',()=>{
 assert.equal(resumeFileSpec('cv.PDF',100,'application/pdf').extension,'pdf')
 assert.equal(resumeFileSpec('../<cv>.docx',100).filename.includes('/'),false)
 for(const [name,size,type] of [['x.exe',100,''],['x.pdf',0,''],['x.pdf',MAX_RESUME_BYTES+1,''],['x.pdf',100,'text/html']])assert.throws(()=>resumeFileSpec(name,size,type))
})
test('PDF/DOCX inspection rejects renamed files and macro-enabled archives',async()=>{
 assert.equal((await inspectResume(pdf,'pdf')).length,64)
 assert.equal((await inspectResume(fs.readFileSync(new URL('./fixtures/resume.docx',import.meta.url)),'docx')).length,64)
 await assert.rejects(()=>inspectResume(Buffer.from('<html>not a pdf</html>'),'pdf'))
 await assert.rejects(()=>inspectResume(pdf,'docx'))
 await assert.rejects(()=>inspectResume(fs.readFileSync(new URL('./fixtures/macro.docx',import.meta.url)),'docx'))
})
test('resume endpoints require a bearer before constructing privileged clients',async()=>{
 const out=res();await createResumesHandler({},()=>{throw Error('must not run')})({method:'POST',headers:{}},out);assert.equal(out.statusCode,401)
})
test('upload paths and owners are server-assigned, token never grants overwrite access',async()=>{
 const client=db(),out=res();await createResumesHandler({},()=>client)(req({action:'init',name:'cv.pdf',size:100,type:'application/pdf',user_id:other,path:'someone/else'}),out)
 assert.equal(out.statusCode,201);assert.equal(out.body.path.startsWith(id+'/'),true);assert.equal(out.body.bucket,'projecta-resumes');assert.equal(client.writes.find(w=>w.rpc).args.owner_id,id);assert.deepEqual(client.writes.find(w=>w.options).options,{upsert:false})
})
test('quota errors are actionable and never create upload tokens',async()=>{
 const client=db({quota:true}),out=res();await createResumesHandler({},()=>client)(req({action:'init',name:'cv.pdf',size:100}),out);assert.equal(out.statusCode,429);assert.equal(client.writes.some(w=>w.bucket),false)
})
test('successful finalization checks actual bytes before marking the asset ready',async()=>{
 const client=db(),out=res();await createResumesHandler({},()=>client)(req({action:'complete',id:assetId}),out);assert.equal(out.statusCode,200);const update=client.writes.find(w=>w.update);assert.equal(update.update.state,'ready');assert.equal(update.update.sha256.length,64)
})
test('invalid uploads are rejected and removed instead of becoming attachable',async()=>{
 const file=Buffer.from('not a valid PDF file'),client=db({file,asset:{byte_size:file.length}}),out=res();await createResumesHandler({},()=>client)(req({action:'complete',id:assetId}),out);assert.equal(out.statusCode,400);assert.equal(client.writes.some(w=>w.removed),true);assert.equal(client.writes.some(w=>w.update?.state==='ready'),false)
})
test('applicants cannot attach pending or other-user assets',async()=>{
 await assert.rejects(()=>attachResume(db(),assetId,id),e=>e.status===409)
 await assert.rejects(()=>attachResume(db({missing:true}),assetId,other),e=>e.status===404)
 const client=db({asset:{state:'ready'}});assert.equal(await attachResume(client,assetId,id),assetId);assert.ok(client.writes.some(w=>w.filter?.[0]==='user_id'&&w.filter[1]===id))
})
test('download URLs are short-lived and a linked resume cannot be discarded',async()=>{
 const client=db({asset:{state:'ready'}}),out=res();await createResumesHandler({},()=>client)(req(null,'GET'),out);assert.equal(out.statusCode,200);assert.equal(out.body.expiresIn,60);assert.equal(client.writes.find(w=>w.ttl).ttl,60)
 const used=db({references:1}),blocked=res();await createResumesHandler({},()=>used)(req({action:'discard',id:assetId}),blocked);assert.equal(blocked.statusCode,409);assert.equal(used.writes.some(w=>w.removed),false)
})
test('untrusted backend status/messages cannot leak credentials through error responses',()=>{
 const out=res();errorResponse(out,{status:500,message:'raw secret-token-value',code:'UNKNOWN'});assert.equal(out.statusCode,502);assert.equal(JSON.stringify(out.body).includes('secret-token-value'),false)
})
