// Dialog/drawer handoffs may overlap for a render. Restore shared document state
// only when the final owner releases it, regardless of effect cleanup order.
const locks=new WeakMap()
export function acquireOverlayLock({inertRoot=false,doc=document}={}){
 let state=locks.get(doc)
 if(!state){state={scroll:0,roots:0,overflow:doc.body.style.overflow};locks.set(doc,state)}
 if(!state.scroll)state.overflow=doc.body.style.overflow
 state.scroll++;doc.body.style.overflow='hidden'
 if(inertRoot){if(!state.roots){state.root=doc.getElementById('root');state.wasInert=state.root?.inert}state.roots++;if(state.root)state.root.inert=true}
 let released=false
 return()=>{
  if(released)return;released=true
  if(inertRoot&&!--state.roots&&state.root)state.root.inert=state.wasInert
  if(!--state.scroll){doc.body.style.overflow=state.overflow;locks.delete(doc)}
 }
}
