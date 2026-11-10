import {profileTrust} from '../config/profile-trust.js'
import {check,HttpError,uuid,missingSchema} from './http.js'
import {normalizeIraqiPhone,telegramHandle} from '../src/contacts.js'
import {signedResumeDownload} from './resumes.js'
const company=job=>{try{return String(JSON.parse(job.contact_info||'{}').company_name||'جهة العمل').slice(0,150)}catch{return 'جهة العمل'}}
const jobView=job=>({id:job.id,title:job.title||'إعلان غير متاح',company:company(job),status:job.status,created_at:job.created_at,expires_at:job.expires_at,archive_reason:job.archive_reason})
// Keep account history available while the additive lifecycle migration is pending.
export async function accountJobQuery(db,configure){
 const fields='id,title,contact_info,status,created_at'
 let result=await configure(db.from('job_offers').select(fields+',expires_at,archive_reason'))
 if(missingSchema(result.error))result=await configure(db.from('job_offers').select(fields))
 return check(result)
}
export async function accountApplications(db,user,url){
 const view=url.searchParams.get('view')||'mine',offset=Number(url.searchParams.get('offset')||0)
 if(!Number.isInteger(offset)||offset<0||offset>100000)throw new HttpError(400,'رقم صفحة غير صالح.')
 if(view==='summary'){
  const [applications,jobs]=await Promise.all([db.from('job_applications').select('id',{count:'exact',head:true}).eq('applicant_id',user.id),db.from('job_offers').select('id',{count:'exact',head:true}).eq('publisher_id',user.id)])
  check(applications);check(jobs);return {applications:applications.count||0,postedJobs:jobs.count||0}
 }
 if(view==='mine'){
  const result=await db.from('job_applications').select('id,job_id,status,created_at').eq('applicant_id',user.id).order('created_at',{ascending:false}).range(offset,offset+19),rows=check(result)
  const ids=[...new Set(rows.map(row=>row.job_id))],jobs=ids.length?await accountJobQuery(db,q=>q.in('id',ids)):[],map=new Map(jobs.map(job=>[job.id,jobView(job)]))
  return {rows:rows.map(row=>({...row,job:map.get(row.job_id)||{id:row.job_id,title:'إعلان غير متاح',company:'جهة العمل'}})),hasMore:rows.length===20}
 }
 if(view==='posted'){
  const rows=await accountJobQuery(db,q=>q.eq('publisher_id',user.id).order('created_at',{ascending:false}).range(offset,offset+19));return {rows:rows.map(jobView),hasMore:rows.length===20}
 }
 if(!['applicants','cv'].includes(view))throw new HttpError(400,'عرض غير صالح.')
 const job=await accountJobQuery(db,q=>q.eq('id',uuid(url.searchParams.get('job_id'))).eq('publisher_id',user.id).maybeSingle())
 if(!job)throw new HttpError(404,'الإعلان غير موجود أو لا تملك صلاحية عرض طلباته.')
 if(view==='cv'){
  const application=check(await db.from('job_applications').select('applicant_id,resume_asset_id').eq('id',uuid(url.searchParams.get('application_id'))).eq('job_id',job.id).maybeSingle())
  if(!application?.resume_asset_id)throw new HttpError(404,'لا توجد سيرة ذاتية مرفقة.')
  const asset=check(await db.from('resume_assets').select('id,user_id,object_path,filename,state,mime_type').eq('id',application.resume_asset_id).eq('user_id',application.applicant_id).eq('state','ready').maybeSingle())
  if(!asset)throw new HttpError(404,'الملف غير متاح.')
  return {...await signedResumeDownload(db,asset),mimeType:asset.mime_type}
 }
 const result=await db.from('job_applications').select('id,applicant_id,status,created_at,cover_letter,resume_asset_id').eq('job_id',job.id).order('created_at',{ascending:false}).range(offset,offset+19),rows=check(result)
 const applicants=[]
 // Bound identity lookups to one page; do not return Auth claims or private licenses.
 for(const row of rows){const identity=check(await db.auth.admin.getUserById(row.applicant_id)).user,phone=normalizeIraqiPhone(identity?.user_metadata?.phone||identity?.phone)
  applicants.push({id:row.id,status:row.status,created_at:row.created_at,cover_letter:row.cover_letter,hasCv:Boolean(row.resume_asset_id),verification:profileTrust(identity),specialty:String(identity?.user_metadata?.profession||identity?.app_metadata?.professional_specialty||'').slice(0,100),telegram:telegramHandle(identity?.user_metadata?.telegram||identity?.user_metadata?.telegram_username),name:String(identity?.user_metadata?.full_name||identity?.user_metadata?.name||'متقدم').slice(0,150),phone:phone?.local||null,email:identity?.email_confirmed_at?identity.email:null})}
 return {job:jobView(job),rows:applicants,hasMore:rows.length===20,pipelineAvailable:Boolean(job.expires_at)}
}
