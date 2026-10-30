// Real, disposable self-hosted Supabase acceptance tests. Refuses non-loopback targets.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {randomBytes} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {createResumesHandler} from '../../api/resumes.js'
import {createApplicationsHandler} from '../../api/applications.js'
import {createAdminHandler} from '../../api/admin.js'
import {createJobsHandler} from '../../api/jobs.js'
import {createPlatformHandler} from '../../api/platform.js'
const state=JSON.parse(fs.readFileSync('/run/projecta-stage.json','utf8'))
const target=new URL(state.url)
if(!['127.0.0.1','localhost'].includes(target.hostname)||!state.containers.every(n=>n.startsWith('projecta-stage-')))throw Error('Refusing a non-local staging target')
const env={SUPABASE_URL:state.url,SUPABASE_SERVICE_ROLE_KEY:state.service,VITE_SUPABASE_ANON_KEY:state.anon,APP_ORIGIN:state.url}
const routes={'/api/resumes':createResumesHandler(env),'/api/applications':createApplicationsHandler(env),'/api/admin':createAdminHandler(env),'/api/jobs':createJobsHandler(env),'/api/platform':createPlatformHandler(env)}
const upstreams={'/auth/v1':['projecta-stage-auth',9999],'/rest/v1':['projecta-stage-rest',3000],'/storage/v1':['127.0.0.1',5000]}
const sensitive=[state.anon,state.service,state.password,state.jwtSecret]
const safeMessage=value=>{let s=String(value);for(const secret of sensitive)s=s.replaceAll(secret,'[redacted]');return s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted-token]')}
const app=http.createServer((req,res)=>{
 const url=new URL(req.url,state.url),handler=routes[url.pathname]
 if(handler){Promise.resolve(handler(req,res)).catch(()=>{res.statusCode=500;res.end('Staging handler failed')});return}
 const prefix=Object.keys(upstreams).find(p=>url.pathname.startsWith(p+'/'))
 if(!prefix){res.statusCode=404;res.end();return}
 // Official Supabase's Kong gateway supplies CORS; mirror that layer locally.
 if(req.headers.origin)res.setHeader('Access-Control-Allow-Origin',req.headers.origin)
 res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-upsert')
 res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')
 if(req.method==='OPTIONS'){res.statusCode=204;res.end();return}
 const [hostname,port]=upstreams[prefix]
 const upstream=http.request({hostname,port,path:url.pathname.slice(prefix.length)+url.search,method:req.method,headers:{...req.headers,host:`${hostname}:${port}`}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)})
 upstream.on('error',()=>{res.statusCode=503;res.end('Local upstream not ready')});req.pipe(upstream)
})
await new Promise(resolve=>app.listen(Number(target.port),'0.0.0.0',resolve))
const options={auth:{persistSession:false,autoRefreshToken:false}}
const service=createClient(state.url,state.service,options)
async function request(path,token,body){
 const response=await fetch(state.url+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 let data;try{data=await response.json()}catch{data={}}
 return {status:response.status,data}
}
async function identity(email){
 const password=randomBytes(24).toString('hex');sensitive.push(password)
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});if(created.error){const users=await service.auth.admin.listUsers({page:1,perPage:1000});const previous=users.data?.users.find(u=>u.email===email);if(!previous)throw Error('Local user creation failed: '+created.error.message);const reset=await service.auth.admin.updateUserById(previous.id,{password,email_confirm:true});if(reset.error)throw Error('Synthetic local account reset failed')}
 const client=createClient(state.url,state.anon,{...options,auth:{...options.auth,storageKey:email}})
 const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw Error('Local sign-in failed: '+signed.error.message)
 sensitive.push(signed.data.session.access_token,signed.data.session.refresh_token)
 return {user:signed.data.user,token:signed.data.session.access_token,client}
}
async function reserve(actor,filename,bytes,mime){
 const init=await request('/api/resumes',actor.token,{action:'init',name:filename,size:bytes.length,type:mime})
 assert.equal(init.status,201,'Upload reservation failed: '+JSON.stringify(init.data))
 const uploaded=await actor.client.storage.from(init.data.bucket).uploadToSignedUrl(init.data.path,init.data.token,bytes,{contentType:init.data.contentType,upsert:false})
 if(uploaded.error)throw Error('Real signed upload failed: '+uploaded.error.message)
 return init.data
}
const pdf=Buffer.from('%PDF-1.7\nSynthetic staging resume; no personal data.\n%%EOF\n')
try{
 const suffix=randomBytes(5).toString('hex');const person=await identity('applicant-'+suffix+'@projecta-stage.invalid'),other=await identity('other-'+suffix+'@projecta-stage.invalid')
 const owners=[];for(const email of ['kararalkhafaji892@gmail.com','kararalkhafaji20@gmail.com'])owners.push(await identity(email))
 console.log('PASS: real local Auth sign-in for applicants and synthetic owner identities; no messages sent.')
 for(const owner of owners){const admin=await request('/api/admin?section=session',owner.token);assert.equal(admin.status,200);assert.equal(admin.data.user.role,'super_admin');assert.equal(admin.data.user.verified,true)}
 assert.equal((await request('/api/admin?section=session',person.token)).status,403)
 assert.equal((await request('/api/resumes',null,{action:'init'})).status,401)
 const publication={title:'مطلوب طبيب عام',company:'مركز اختبار مرحلي',description:'فرصة اصطناعية في كربلاء لاختبار المسار فقط',salary:'حسب الاتفاق',role:'General Physicians',city:'Karbala',schedule:'Full-time',phone:'07700000000'}
 // Use the real publish handler too; the owner has no medical-verification claim.
 const {createPublishHandler}=await import('../../api/publish-job.js');routes['/api/publish-job']=createPublishHandler(env)
 const post=await request('/api/publish-job',owners[0].token,publication);assert.equal(post.status,201,'Owner publishing bypass failed: '+JSON.stringify(post.data));const jobId=post.data.id
 const platform=await request('/api/platform');assert.equal(platform.status,200);assert.ok(platform.data.catalog.some(c=>c.id==='General Physicians'))
 const jobs=await request('/api/jobs?offset=0');assert.equal(jobs.status,200);assert.ok(jobs.data.jobs.some(j=>j.id===jobId))
 const forged=await person.client.auth.updateUser({data:{role:'super_admin',medical_professional_verified:true}});assert.equal(forged.error,null);assert.equal((await request('/api/admin?section=session',person.token)).status,403)
 console.log('PASS: both owners receive server admin access; owner publishes without professional approval; real job/platform APIs include the sixth category.')
 const first=await reserve(person,'resume.pdf',pdf,'application/pdf')
 const completed=await request('/api/resumes',person.token,{action:'complete',id:first.id});assert.equal(completed.status,200,'Real file validation failed: '+JSON.stringify(completed.data))
 assert.equal((await request('/api/resumes?id='+first.id,other.token)).status,404)
 const direct=await person.client.storage.from(first.bucket).download(first.path);assert.ok(direct.error,'Private file was exposed through normal authenticated reads')
 const publicRead=await fetch(state.url+'/storage/v1/object/public/'+first.bucket+'/'+first.path);assert.equal(publicRead.ok,false)
 const anonStorage=createClient(state.url,state.anon,options);const anonRead=await anonStorage.storage.from(first.bucket).download(first.path);assert.ok(anonRead.error)
 const escaped=await person.client.storage.from(first.bucket).uploadToSignedUrl(first.path+'.other.pdf',first.token,pdf,{contentType:'application/pdf'});assert.ok(escaped.error,'Signed upload token escaped its reserved path')
 const overwrite=await person.client.storage.from(first.bucket).uploadToSignedUrl(first.path,first.token,pdf,{contentType:'application/pdf',upsert:true});assert.ok(overwrite.error,'A non-overwriting signed token permitted replacement')
 const link=await request('/api/resumes?id='+first.id,person.token);assert.equal(link.status,200);assert.equal(link.data.expiresIn,60)
 const downloaded=await fetch(link.data.url);assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),pdf)
 assert.match(downloaded.headers.get('content-disposition')||'',/attachment/)
 assert.equal((await request('/api/resumes?id='+first.id,owners[1].token)).status,200)
 const anonMetadata=await anonStorage.from('resume_assets').select('id');assert.ok(anonMetadata.error,'Anonymous resume metadata read was allowed');const ownMetadata=await person.client.from('resume_assets').select('id');assert.ok(ownMetadata.error,'Direct browser resume metadata reads were allowed')
 console.log('PASS: real PDF signed upload/validation/download; private bucket denies anonymous, other-user API and normal authenticated reads; no overwrite; admin download works.')
 const premature=await reserve(other,'pending.pdf',pdf,'application/pdf')
 const pendingApplication=await request('/api/applications',other.token,{job_id:jobId,cover_letter:'طلب تجريبي للتحقق من الملف المعلّق',resume_asset_id:premature.id});assert.equal(pendingApplication.status,409)
 const foreignApplication=await request('/api/applications',other.token,{job_id:jobId,cover_letter:'طلب اصطناعي لمحاولة إرفاق ملف غير مملوك',resume_asset_id:first.id});assert.equal(foreignApplication.status,404)
 const application=await request('/api/applications',person.token,{job_id:jobId,cover_letter:'طلب اصطناعي لاختبار إرفاق السيرة الذاتية',resume_asset_id:first.id});assert.equal(application.status,201,JSON.stringify(application.data))
 const linked=await service.from('job_applications').select('resume_asset_id,applicant_id').eq('id',application.data.id).single();assert.equal(linked.data.resume_asset_id,first.id);assert.equal(linked.data.applicant_id,person.user.id)
 assert.equal((await request('/api/resumes',person.token,{action:'discard',id:first.id})).status,409)
 assert.equal((await request('/api/applications',person.token,{job_id:jobId,cover_letter:'اختبار الطلب المكرر لمنع التكرار',resume_asset_id:first.id})).status,409)
 const adminApplications=await request('/api/admin?section=applications',owners[0].token);assert.equal(adminApplications.status,200);assert.ok(adminApplications.data.rows.some(a=>a.resume_asset_id===first.id))
 console.log('PASS: real application attachment, same-owner FK, pending/foreign-file denial, duplicate prevention, linked-file deletion denial and admin application list.')
 const docx=fs.readFileSync('/review/tests/fixtures/resume.docx'),second=await reserve(person,'resume.docx',docx,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 assert.equal((await request('/api/resumes',person.token,{action:'complete',id:second.id})).status,200)
 const garbage=Buffer.from('This is not a real PDF document.'),bad=await reserve(person,'bad.pdf',garbage,'application/pdf')
 assert.equal((await request('/api/resumes',person.token,{action:'complete',id:bad.id})).status,400)
 assert.equal((await service.storage.from(bad.bucket).download(bad.path)).error!==null,true)
 console.log('PASS: actual DOCX upload/validation and invalid-content deletion.')
 const short=await service.storage.from(first.bucket).createSignedUrl(first.path,1);assert.equal(short.error,null)
 await new Promise(resolve=>setTimeout(resolve,2100));assert.equal((await fetch(short.data.signedUrl)).ok,false,'Expired signed link remained usable')
 const cors=await fetch(state.url+'/storage/v1/object/upload/sign/'+first.bucket+'/'+first.path,{method:'OPTIONS',headers:{Origin:'http://localhost:5180','Access-Control-Request-Method':'PUT'}});assert.ok(cors.headers.get('access-control-allow-origin'))
 console.log('PASS: actual signed-link expiry and local Supabase gateway upload preflight CORS.')
 // Race attachment against discard repeatedly. Either winner is valid, never an attached deleted asset.
 for(let i=0;i<5;i++){
  const job=await service.from('job_offers').insert({title:'اختبار تزامن',description:'بيانات اصطناعية فقط',role_category:'General Physicians',location_city:'Karbala',status:'active'}).select('id').single();assert.equal(job.error,null)
  const asset=await reserve(person,'race.pdf',pdf,'application/pdf');assert.equal((await request('/api/resumes',person.token,{action:'complete',id:asset.id})).status,200)
  const [attached,discarded]=await Promise.all([request('/api/applications',person.token,{job_id:job.data.id,cover_letter:'طلب اختبار تزامن الإرفاق والحذف',resume_asset_id:asset.id}),request('/api/resumes',person.token,{action:'discard',id:asset.id})])
  assert.ok([201,409].includes(attached.status),'Unexpected attachment race response: '+attached.status);assert.ok([200,409].includes(discarded.status),'Unexpected discard race response: '+discarded.status)
  const row=await service.from('resume_assets').select('state').eq('id',asset.id).single()
  if(attached.status===201){assert.equal(row.data.state,'ready');assert.equal(discarded.status,409);assert.equal((await service.storage.from(asset.bucket).download(asset.path)).error,null)}else assert.equal(row.data.state,'deleted')
 }
 console.log('PASS: five real concurrent attachment/discard races preserve file/application consistency.')
 const quotaActor=await identity('quota-'+suffix+'@projecta-stage.invalid')
 const reservations=await Promise.all(Array.from({length:22},(_,i)=>request('/api/resumes',quotaActor.token,{action:'init',name:`quota-${i}.pdf`,size:pdf.length,type:'application/pdf'})))
 assert.equal(reservations.filter(r=>r.status===201).length,20);assert.equal(reservations.filter(r=>r.status===429).length,2)
 const limited=reservations.find(r=>r.status===201).data
 const oversized=await quotaActor.client.storage.from(limited.bucket).uploadToSignedUrl(limited.path,limited.token,Buffer.alloc(5*1024*1024+1),{contentType:'application/pdf'});assert.ok(oversized.error,'Storage accepted a file larger than the bucket limit')
 console.log('PASS: real 22-way quota contention permits exactly 20 uploads; Storage enforces the 5 MiB limit.')
 console.log('STAGING ACCEPTANCE PASSED. Only disposable local services and synthetic data were used; production and migration 010 were untouched.')
}catch(error){console.error(safeMessage(error.message));process.exitCode=1}finally{await new Promise(resolve=>app.close(resolve))}
