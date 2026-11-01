// Broadcasts invalidate cached views only; payloads never confer verification.
const subscriptions=new WeakMap()
export function subscribeTrustEvents(client,callback){
 if(!client)return()=>{}
 let entry=subscriptions.get(client)
 if(!entry){
  const callbacks=new Set();let last=0,timer=null
  const emit=()=>{last=Date.now();timer=null;for(const listener of callbacks)listener()}
  const channel=client.channel('projecta:trust').on('broadcast',{event:'changed'},()=>{
   const delay=500-(Date.now()-last)
   if(delay<=0)emit();else if(!timer)timer=setTimeout(emit,delay)
  }).subscribe()
  entry={channel,callbacks,cancel:()=>clearTimeout(timer)};subscriptions.set(client,entry)
 }
 entry.callbacks.add(callback)
 return()=>{entry.callbacks.delete(callback);if(!entry.callbacks.size){entry.cancel();subscriptions.delete(client);void client.removeChannel(entry.channel)}}
}
