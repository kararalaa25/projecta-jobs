import {serverClient} from '../server/supabase.js'
import {normalizeTalent} from '../src/talent/data.js'
import {normalizeCourse} from '../src/training/data.js'
import {listingTrust} from '../server/profile-trust.js'

export function publicTalent(row,verification){
 const profile=normalizeTalent({id:row.id,name:row.name,headline:row.headline,role:row.specialty,city:row.governorate,qualification:row.qualification,bio:row.bio,experience:row.experience_years,skills:row.skill_tags,workTypes:row.shift_preferences,availability:row.availability,phone:row.contact_consent===true?row.phone:null,whatsappEnabled:row.contact_consent===true&&row.whatsapp_enabled===true,updatedAt:row.updated_at},'platform')
 return profile?{...profile,verification}:null
}
export function publicCourse(row){return normalizeCourse({id:row.id,title:row.title,role:row.specialty,city:row.governorate,kind:row.kind,startsAt:row.starts_at,endsAt:row.ends_at,instructor:row.instructor_name,credentials:row.instructor_credentials,venue:row.venue,description:row.description,phone:row.phone,whatsappEnabled:row.whatsapp_enabled,registrationUrl:row.registration_url},'platform')}
export function createDirectoryHandler(client=()=>serverClient()){
 return async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body))}
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'Method not allowed'})}
  const params=new URL(req.url||'/','http://localhost').searchParams,kind=params.get('kind'),offset=Number(params.get('offset')||0)
  if(!['talent','courses'].includes(kind)||!Number.isInteger(offset)||offset<0||offset>2400)return send(400,{error:'Invalid directory request'})
  try{
   const db=client(),fields=kind==='courses'?'id,title,specialty,governorate,kind,starts_at,ends_at,instructor_name,instructor_credentials,venue,description,registration_url,phone,whatsapp_enabled':'id,user_id,name,headline,specialty,governorate,qualification,bio,experience_years,skill_tags,shift_preferences,availability,phone,whatsapp_enabled,contact_consent,updated_at'
   const {data,error}=await db.from(kind).select(fields).eq('publication_status','published').order(kind==='courses'?'starts_at':'updated_at',{ascending:kind==='courses'}).order('id').range(offset,offset+23).abortSignal(AbortSignal.timeout(6000))
   if(error)throw error
   const rows=data||[]
   const trust=kind==='talent'?new Map((await listingTrust(db,rows.map(row=>({id:row.id,publisher_id:row.user_id,source:'manual'})))).map(item=>[item.id,item.verification])):null
   return send(200,{items:rows.map(row=>kind==='courses'?publicCourse(row):publicTalent(row,trust.get(row.id))).filter(Boolean),hasMore:rows.length===24})
  }catch{return send(503,{error:'تعذر تحميل الدليل المنشور حالياً.'})}
 }
}
export default createDirectoryHandler()
