import {serverClient} from '../server/supabase.js'
import {headers,json} from '../server/http.js'

export function publicSyncStatus(row,now=Date.now()){
 const parsed=Date.parse(row?.last_success_at)
 const valid=Number.isFinite(parsed)&&parsed<=now+60000
 const lastCheckedAt=valid?new Date(parsed).toISOString():null
 const checking=Date.parse(row?.lease_until)>now
 const delayed=Boolean(row?.last_error)||(valid&&now-parsed>15*60000)
 return {lastCheckedAt,intervalSeconds:300,status:checking?'checking':delayed?'delayed':valid?'ok':'unknown'}
}
export function createTelegramStatusHandler(env=process.env,factory=serverClient){
 return async(req,res)=>{
  headers(res);res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store')
  if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{error:'Method not allowed'})}
  try{
   const result=await factory(env).from('telegram_sync_control').select('last_success_at,last_error,lease_until').eq('id',1).limit(1).abortSignal(AbortSignal.timeout(10000))
   if(result.error)throw result.error
   return json(res,200,publicSyncStatus(result.data?.[0]))
  }catch{
   return json(res,503,{lastCheckedAt:null,intervalSeconds:300,status:'unknown'})
  }
 }
}
export default createTelegramStatusHandler()
