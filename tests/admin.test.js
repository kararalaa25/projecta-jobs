import test from 'node:test'
import assert from 'node:assert/strict'
import {isOwner,isSuperAdmin,canPublish,isSuspended} from '../config/access.js'
import {createAdminHandler,adminJobRecord,publicUser} from '../api/admin.js'
import {createApplicationsHandler} from '../api/applications.js'
import {createPublishHandler} from '../api/publish-job.js'
import {createPlatformHandler} from '../api/platform.js'
import {defaultCatalog,defaultSettings} from '../server/platform.js'
const owner={id:'11111111-1111-4111-8111-111111111111',email:'kararalkhafaji892@gmail.com',email_confirmed_at:'2026-01-01',app_metadata:{}}
const target={id:'22222222-2222-4222-8222-222222222222',email:'member@example.test',email_confirmed_at:'2026-01-01',app_metadata:{existing:'preserved'},user_metadata:{}}
const jobId='33333333-3333-4333-8333-333333333333'
const response=()=>({setHeader(){},end(raw){this.body=JSON.parse(raw)}})
const request=(section='session',body)=>({method:body?'POST':'GET',url:`/api/admin?section=${section}`,headers:{authorization:'Bearer valid-token',host:'jobs.test',origin:'https://jobs.test'},...(body?{body}:{})})
function database(actor=owner,options={}){
 const calls=[];let update
 const db={calls,get updated(){return update},auth:{async getUser(){return {data:{user:actor},error:options.authError}},admin:{async listUsers(){return {data:{users:[owner,target]},error:null}},async getUserById(){return {data:{user:options.target||target}}},async updateUserById(id,values){update={id,...values};return {data:{user:{...target,...values}}}}},async resetPasswordForEmail(){calls.push('recovery');return {error:null}}},from(table){const call={table};calls.push(call);const q={select(...x){call.select=x;return this},eq(k,v){(call.eq||=[]).push([k,v]);return this},order(){return this},range(){return this},limit(){return this},ilike(){return this},update(v){call.update=v;return this},insert(v){call.insert=v;return this},delete(){call.delete=true;return this},single(){return Promise.resolve(result(true))},maybeSingle(){return Promise.resolve(result(true))},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};function result(single=false){if(options.missing&&['platform_settings','admin_catalog','job_applications','admin_audit_log'].includes(table))return {error:{code:'PGRST205'}};if(table==='platform_settings')return {data:{value:{...defaultSettings,...options.settings}}};if(table==='admin_catalog')return {data:defaultCatalog};if(table==='job_offers')return {data:single?{id:jobId,status:'active',contact_info:JSON.stringify({source_url:'https://t.me/jobs/1',phone:'07701234567'})}:[],count:7};return {data:single?{id:'new-app'}:[],count:3,error:options.duplicate&&table==='job_applications'?{code:'23505'}:null}}return q},async rpc(name,args){calls.push({rpc:name,args});return options.missing?{error:{code:'PGRST202'}}:{data:null}}}
 return db
}
async function admin(actor,body,section='session',options={}){const db=database(actor,options),res=response();await createAdminHandler({},()=>db)(request(section,body),res);return {db,res}}
test('both confirmed owner emails gain admin and publishing without a medical claim',()=>{
 for(const email of ['kararalkhafaji892@gmail.com','kararalkhafaji20@gmail.com']){const u={...owner,email};assert.equal(isOwner(u),true);assert.equal(isSuperAdmin(u),true);assert.equal(canPublish(u),true)}
 assert.equal(isOwner({...owner,email_confirmed_at:null}),false)
 assert.equal(isSuperAdmin({...target,user_metadata:{role:'super_admin',medical_professional_verified:true}}),false)
 assert.equal(isSuperAdmin({...target,app_metadata:{role:'super_admin'}}),true)
 assert.equal(isSuperAdmin({...target,app_metadata:{role:'admin'}}),false)
})
test('suspension blocks verified professionals and admins and expires after a temporary ban',()=>{
 assert.equal(canPublish({...owner,app_metadata:{suspended:true}}),false)
 assert.equal(isSuperAdmin({...owner,banned_until:'2099-01-01'}),false)
 assert.equal(isSuspended({...target,app_metadata:{suspended:true,suspended_until:'2020-01-01'},banned_until:'2020-01-01'}),false)
})
test('every admin request requires a remotely validated bearer and super-admin identity',async()=>{
 for(const u of [null,target,{...owner,email_confirmed_at:null},{...owner,app_metadata:{suspended:true}}]){const {res,db}=await admin(u);assert.ok([401,403].includes(res.statusCode));assert.equal(db.calls.length,0)}
 const db=database(),res=response();await createAdminHandler({},()=>db)({...request(),headers:{}},res);assert.equal(res.statusCode,401)
 const denied=await admin(owner,undefined,'session',{authError:Error('revoked')});assert.equal(denied.res.statusCode,401)
})
test('cross-origin privileged writes are rejected before any database operation',async()=>{
 const db=database(),res=response();await createAdminHandler({},()=>db)({...request('users',{action:'user.update',id:target.id,role:'super_admin'}),headers:{...request().headers,origin:'https://attacker.test'}},res);assert.equal(res.statusCode,403);assert.equal(db.updated,undefined)
})
test('user management merges trusted metadata, ignores client IDs and cannot modify owners',async()=>{
 const {res,db}=await admin(owner,{action:'user.update',id:target.id,role:'super_admin',verified:true,suspension:'week',app_metadata:{evil:true}})
 assert.equal(res.statusCode,200);assert.equal(db.updated.app_metadata.existing,'preserved');assert.equal(db.updated.app_metadata.role,'super_admin');assert.equal(db.updated.app_metadata.medical_professional_verified,true);assert.equal(db.updated.app_metadata.evil,undefined);assert.equal(db.updated.ban_duration,'168h')
 const protectedUser=await admin(owner,{action:'user.update',id:owner.id,suspension:'ban'},'users',{target:owner});assert.equal(protectedUser.res.statusCode,403);assert.equal(protectedUser.db.updated,undefined)
})
test('admin user responses exclude password hashes, tokens and arbitrary metadata',()=>{
 const safe=publicUser({...owner,encrypted_password:'SECRET',user_metadata:{access_token:'SECRET',license_url:'javascript:evil()'}})
 assert.equal(JSON.stringify(safe).includes('SECRET'),false);assert.equal(safe.license.url,'')
})
test('catalog/settings writes validate input and call only the service-role transaction RPC',async()=>{
 const good=await admin(owner,{action:'catalog.save',entry:{id:'New Role',label:'تخصص جديد',kind:'role',position:3,active:true}});assert.equal(good.res.statusCode,200);assert.equal(good.db.calls[0].args.actor_id,owner.id)
 const bad=await admin(owner,{action:'catalog.save',entry:{id:'x',label:'x',kind:'sql',position:1,active:true}});assert.equal(bad.res.statusCode,400);assert.equal(bad.db.calls.length,0)
 const missing=await admin(owner,{action:'settings.save',settings:{banner_enabled:false,banner_text:'',maintenance:true}},'settings',{missing:true});assert.equal(missing.res.statusCode,503);assert.equal(missing.res.body.migrationRequired,true)
})
test('data viewer cannot query authentication, unknown tables or execute SQL',async()=>{
 const db=database(),res=response();await createAdminHandler({},()=>db)({...request('data'),url:'/api/admin?section=data&table=auth.users'},res);assert.equal(res.statusCode,400);assert.equal(db.calls.length,0)
 const denied=await admin(owner,{action:'sql.execute',sql:'DELETE FROM auth.users'});assert.equal(denied.res.statusCode,400)
})
test('job deletion requires explicit confirmation; feature preserves ingestion metadata',async()=>{
 const denied=await admin(owner,{action:'job.delete',id:jobId});assert.equal(denied.res.statusCode,400)
 const removed=await admin(owner,{action:'job.delete',id:jobId,confirmation:'DELETE'});assert.equal(removed.res.statusCode,200);assert.deepEqual(removed.db.calls[0].eq,[['id',jobId]])
 const featured=await admin(owner,{action:'job.feature',id:jobId,featured:true});assert.equal(featured.res.statusCode,200);const meta=JSON.parse(featured.db.calls[1].update.contact_info);assert.equal(meta.featured,true);assert.equal(meta.source_url,'https://t.me/jobs/1')
})
test('reviewing raw jobs updates category/contact metadata without requiring invented contact information',()=>{
 const result=adminJobRecord({title:'طبيب',company:'عيادة',description:'مطلوب طبيب أسنان',salary:'',role:'Dentists',city:'Baghdad',schedule:'Part-time'},defaultCatalog)
 const meta=JSON.parse(result.contact_info);assert.equal(meta.parsing_status,'admin_reviewed');assert.equal(meta.role_category,'Dentists');assert.equal(result.contact_phone,null);assert.equal(meta.employment_type,'part_time')
 assert.throws(()=>adminJobRecord({title:'x',role:'malicious'},defaultCatalog))
})
test('overview distinguishes a missing applications table from zero applications',async()=>{
 const {res}=await admin(owner,undefined,'overview',{missing:true});assert.equal(res.statusCode,200);assert.equal(res.body.metrics.users,2);assert.equal(res.body.metrics.active,7);assert.equal(res.body.metrics.applications,null);assert.equal(res.body.platform.migrationRequired,true)
})
test('owner publishing uses the same confirmed-email rule on the server',async()=>{
 const db=database(),res=response();await createPublishHandler({},()=>db)(request('jobs',{title:'طبيب',company:'عيادة',description:'مطلوب طبيب أسنان في بغداد',salary:'حسب الاتفاق',role:'Dentists',city:'Baghdad',schedule:'Full-time',phone:'07701234567'}),res);assert.equal(res.statusCode,201)
})
test('maintenance blocks non-admin submissions and application identity is server assigned',async()=>{
 const professional={...target,app_metadata:{medical_professional_verified:true}},db=database(professional,{settings:{maintenance:true}}),res=response();await createPublishHandler({},()=>db)(request('jobs',{}),res);assert.equal(res.statusCode,503)
 const appdb=database(target),out=response();await createApplicationsHandler({},()=>appdb)(request('applications',{job_id:jobId,cover_letter:'خبرة في مجال طب الأسنان',applicant_id:owner.id,status:'accepted'}),out);assert.equal(out.statusCode,201);const insert=appdb.calls.find(c=>c.table==='job_applications').insert;assert.equal(insert.applicant_id,target.id);assert.equal(insert.status,undefined)
})
test('duplicate applications return an actionable conflict instead of a success',async()=>{
 const db=database(target,{duplicate:true}),res=response();await createApplicationsHandler({},()=>db)(request('applications',{job_id:jobId,cover_letter:'خبرة في طب الأسنان والعمل السريري'}),res);assert.equal(res.statusCode,409)
})
test('professional license submission never self-approves a regular user',async()=>{
 const db=database(target),res=response();await createApplicationsHandler({},()=>db)(request('applications',{action:'license.submit',full_name:'اسم الطبيب',profession:'طبيب',license_number:'123',medical_professional_verified:true,role:'super_admin'}),res);assert.equal(res.statusCode,200);assert.equal(db.updated.app_metadata.medical_professional_verified,false);assert.equal(db.updated.app_metadata.verification_status,'pending');assert.equal(db.updated.app_metadata.role,undefined)
})
test('public platform endpoint returns only display settings and catalog',async()=>{
 const db=database(),res=response();await createPlatformHandler({},()=>db)({method:'GET'},res);assert.equal(res.statusCode,200);assert.deepEqual(Object.keys(res.body).sort(),['catalog','settings']);assert.equal(JSON.stringify(res.body).includes(owner.email),false)
})
