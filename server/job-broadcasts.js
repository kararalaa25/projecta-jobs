import {createHmac,timingSafeEqual} from 'node:crypto'
import {profileTrust,hasVerifiedCredentials} from '../config/profile-trust.js'
import {isJobFresh} from '../config/job-lifecycle.js'
import {publicJobOffer} from './public-jobs.js'
import {check} from './http.js'
const providers={telegram:'TELEGRAM_JOB_WEBHOOK_URL',whatsapp:'WHATSAPP_JOB_WEBHOOK_URL'}
export function authorizedDispatcher(authorization,secret){
 if(typeof secret!=='string'||secret.length<32)return false
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(authorization||'')
 return expected.length===actual.length&&timingSafeEqual(expected,actual)
}
function targets(env){
 if(typeof env.JOB_BROADCAST_WEBHOOK_SECRET!=='string'||env.JOB_BROADCAST_WEBHOOK_SECRET.length<32)return []
 return Object.entries(providers).flatMap(([channel,key])=>{
  try{const url=new URL(env[key]);return url.protocol==='https:'&&!url.username&&!url.password?[{channel,url:url.href}]:[]}catch{return []}
 })
}
// Receivers must deduplicate Idempotency-Key before posting to their communities.
// Delivery is at-least-once; an HTTP timeout can happen after a receiver commits.
export async function dispatchJobBroadcasts(db,env=process.env,{jobId=null,fetcher=fetch}={}){
 const destinations=targets(env)
 if(!destinations.length)return {configured:false,delivered:0,failed:0,cancelled:0}
 const rows=check(await db.rpc('projecta_claim_job_broadcasts',{p_channels:destinations.map(item=>item.channel),p_job:jobId}))||[]
 const result={configured:true,delivered:0,failed:0,cancelled:0}
 await Promise.all(rows.map(async event=>{
  let outcome='failed'
  try{
   const offer=check(await db.from('job_offers').select('*').eq('id',event.job_id).maybeSingle())
   const identity=offer?.publisher_id?check(await db.auth.admin.getUserById(offer.publisher_id)).user:null
   const verification=profileTrust(identity)
   if(!offer||offer.status!=='active'||offer.source!=='manual'||!isJobFresh(offer)||!hasVerifiedCredentials(verification))outcome='cancelled'
   else{
    const payload=JSON.stringify({id:event.id,type:'job.verified.published',version:1,channel:event.channel,occurred_at:event.created_at,job:publicJobOffer(offer),verification})
    const timestamp=String(Math.floor(Date.now()/1000)),signature=createHmac('sha256',env.JOB_BROADCAST_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex')
    const response=await fetcher(destinations.find(item=>item.channel===event.channel).url,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':event.id,'X-Projecta-Timestamp':timestamp,'X-Projecta-Signature':`sha256=${signature}`},body:payload,redirect:'error',signal:AbortSignal.timeout(5000)})
    // Do not read or log receiver responses, which may contain private tokens.
    try{await response.body?.cancel()}catch{}
    if(response.ok)outcome='delivered'
   }
  }catch{/* A bounded lease and persistent retry state retain failed events. */}
  check(await db.rpc('projecta_finish_job_broadcast',{p_id:event.id,p_lease:event.lease_token,p_outcome:outcome}))
  result[outcome==='delivered'?'delivered':outcome==='cancelled'?'cancelled':'failed']++
 }))
 return result
}
