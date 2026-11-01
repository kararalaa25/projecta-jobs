import {publicProfileTrust} from '../config/profile-trust.js'

export async function listingTrust(db,rows){
 const ids=[...new Set(rows.filter(row=>row.source==='manual'&&row.publisher_id).map(row=>row.publisher_id))]
 const summaries=new Map()
 let cursor=0
 async function worker(){
  while(cursor<ids.length){
   const id=ids[cursor++]
   try{
    const {data,error}=await db.auth.admin.getUserById(id)
    summaries.set(id,error||!data?.user?{status:'unavailable',kind:'professional',credentials:[]}:publicProfileTrust(data.user))
   }catch{summaries.set(id,{status:'unavailable',kind:'professional',credentials:[]})}
  }
 }
 await Promise.all(Array.from({length:Math.min(4,ids.length)},worker))
 return rows.map(row=>({id:row.id,verification:row.source==='manual'&&row.publisher_id
  ?summaries.get(row.publisher_id):{status:'unverified',kind:'professional',credentials:[]}}))
}
