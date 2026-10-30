import catalog from '../config/iraq.json' with {type:'json'}
import {missingSchema,check} from './http.js'
export const defaultCatalog=[...catalog.roles.map((r,i)=>({id:r.id,label:r.ar,kind:'role',position:i,active:true})),...catalog.governorates.map((g,i)=>({id:g.id,label:g.ar,kind:'location',position:i,active:true}))]
export const defaultSettings={banner_enabled:false,banner_text:'',maintenance:false}
export async function readPlatform(db){
 const [settings,entries]=await Promise.all([db.from('platform_settings').select('value').eq('id','global').maybeSingle(),db.from('admin_catalog').select('id,label,kind,position,active').order('position')])
 for(const r of [settings,entries])if(r.error&&!missingSchema(r.error))throw r.error
 return {settings:settings.error?defaultSettings:{...defaultSettings,...settings.data?.value},catalog:entries.error?defaultCatalog:entries.data,migrationRequired:Boolean(settings.error||entries.error)}
}
// Database transaction records the change and audit event together. Service role only.
export async function adminMutation(db,actor,action,payload){return check(await db.rpc('projecta_admin_mutation',{actor_id:actor.id,operation:action,payload}))}
