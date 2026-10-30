import {serverClient} from '../server/supabase.js'
import {readPlatform} from '../server/platform.js'
import {headers,json,errorResponse} from '../server/http.js'
export function createPlatformHandler(env=process.env,factory=serverClient){return async(req,res)=>{headers(res);if(req.method!=='GET')return json(res,405,{error:'طريقة الطلب غير مسموحة.'});try{const {settings,catalog}=await readPlatform(factory(env));res.setHeader('Cache-Control','public, s-maxage=10, stale-while-revalidate=10');return json(res,200,{settings,catalog})}catch(error){return errorResponse(res,error)}}}
export default createPlatformHandler()
