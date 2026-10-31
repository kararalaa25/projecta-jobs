import {fetchJobs,fetchJobsByIds} from './jobs.js'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Snapshot responses may race an INSERT/UPDATE/DELETE. Apply events that arrived
// after the request started so a late snapshot cannot erase a live update.
export function reconcileSnapshot(jobs,changes,since){
 const result=new Map(jobs.map(job=>[job.id,job]))
 for(const [id,change] of changes)if(change.version>since){result.delete(id);if(change.job)result.set(id,change.job)}
 return [...result.values()]
}
export function startJobFeed({client,onSnapshot,onUpsert,onRemove,onLoad,onConnection,fetchAll=fetchJobs,fetchByIds=fetchJobsByIds,win=window,doc=document,interval=60000}){
 const lifecycle=new AbortController(),changes=new Map(),pending=new Map(),versions=new Map()
 let version=0,loading=null,batchTimer=null,flushing=false,closed=false,lastRefresh=0
 const record=(id,job)=>{changes.set(id,{version:++version,job});if(job)onUpsert(job);else onRemove(id)}
 const refresh=()=>{
  if(closed||loading)return loading
  const since=version;lastRefresh=Date.now();onLoad('loading')
  loading=fetchAll(lifecycle.signal).then(jobs=>{if(!closed){onSnapshot(reconcileSnapshot(jobs,changes,since));onLoad('ready')}}).catch(error=>{if(!closed&&error.name!=='AbortError')onLoad('error')}).finally(()=>{loading=null})
  return loading
 }
 const schedule=()=>{if(!closed&&!batchTimer&&!flushing)batchTimer=win.setTimeout(flush,100)}
 async function flush(){
  batchTimer=null;if(closed||flushing||!pending.size)return
  flushing=true
  const batch=[...pending.entries()].slice(0,100);for(const [id] of batch)pending.delete(id)
  try{
   const jobs=await fetchByIds(batch.map(([id])=>id),lifecycle.signal),found=new Map(jobs.map(job=>[job.id,job]))
   if(!closed)for(const [id,sequence] of batch)if(versions.get(id)===sequence)record(id,found.get(id)||null)
  }catch(error){if(!closed&&error.name!=='AbortError')void refresh()}
  finally{flushing=false;if(pending.size)schedule()}
 }
 const change=payload=>{
  // Only an identifier is trusted from the socket. Fetch public fields through
  // the same sanitizer and classifier as the normal feed, without CDN caching.
  const id=payload.new?.id||payload.old?.id
  if(!UUID.test(id||''))return
  const sequence=(versions.get(id)||0)+1;versions.set(id,sequence)
  if(payload.eventType==='DELETE'){pending.delete(id);record(id,null)}
  else{pending.set(id,sequence);schedule()}
 }
 const channel=client?.channel('public:jobs').on('postgres_changes',{event:'*',schema:'public',table:'job_offers',select:['id','source','status']},change).subscribe(status=>{
  if(closed)return
  onConnection(status==='SUBSCRIBED'?'live':'reconnecting')
  if(status==='SUBSCRIBED')void refresh()
 })
 if(!client)onConnection('reconnecting')
 const foreground=()=>{if(doc.visibilityState!=='hidden'&&Date.now()-lastRefresh>15000)void refresh()}
 const timer=win.setInterval(()=>{if(doc.visibilityState!=='hidden')void refresh()},interval)
 win.addEventListener('online',foreground);win.addEventListener('focus',foreground);doc.addEventListener('visibilitychange',foreground)
 void refresh()
 return()=>{closed=true;lifecycle.abort();win.clearInterval(timer);if(batchTimer)win.clearTimeout(batchTimer);win.removeEventListener('online',foreground);win.removeEventListener('focus',foreground);doc.removeEventListener('visibilitychange',foreground);if(channel)void client.removeChannel(channel)}
}
