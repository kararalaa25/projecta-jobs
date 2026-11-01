// Production-build performance fixture: local files and deterministic APIs only.
// Never forwards requests to Supabase or mutates application data.
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {gzipSync} from 'node:zlib'
const root=resolve(process.argv[2]||'dist'),port=Number(process.argv[3]||5191)
const jobs=Array.from({length:36},(_,index)=>({id:`44444444-4444-4444-8444-${String(index+1).padStart(12,'0')}`,source:'manual',status:'active',title:'طبيب أسنان عام',description:'فرصة محلية لاختبار الأداء في بغداد. خبرة في الرعاية الوقائية والترميمية والتواصل مع المرضى.',role_category:'Dentists',location_city:'Baghdad',employment_type:'full_time',salary_range:'غير محدد',contact_info:JSON.stringify({company_name:'عيادة اختبار الأداء',phone:'07700000000',role_category:'Dentists',employment_type:'Full-time'}),created_at:new Date(Date.UTC(2026,9,30,12,0,index)).toISOString()}))
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif'}
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost')
 if(url.pathname.startsWith('/api/')){
  const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||200)
  const data=url.pathname==='/api/jobs'?{jobs:jobs.slice(offset,offset+limit),hasMore:offset+limit<jobs.length,total:jobs.length}:url.pathname==='/api/platform'?{settings:{}}:url.pathname==='/api/directory'?{items:[],hasMore:false}:url.pathname==='/api/profile-trust'?{jobs:[]}:url.pathname==='/api/telegram-status'?{status:'ok',intervalSeconds:300,lastCheckedAt:'2026-10-30T12:00:00Z'}:{error:'Local performance fixture'}
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return
 }
 let file=resolve(root,`.${decodeURIComponent(url.pathname)}`)
 if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403);res.end();return}
 if(!extname(file))file=resolve(root,'index.html')
 try{
  const body=await readFile(file),type=types[extname(file)]||'application/octet-stream',compress=/text\/|svg/.test(type)&&req.headers['accept-encoding']?.includes('gzip')
  res.writeHead(200,{'content-type':type,'cache-control':file.endsWith('.html')?'no-store':'public, max-age=31536000, immutable',...(compress?{'content-encoding':'gzip','vary':'Accept-Encoding'}:{})});res.end(compress?gzipSync(body):body)
 }catch{res.writeHead(404);res.end()}
}).listen(port,'127.0.0.1',()=>console.log(`Local performance fixture: http://127.0.0.1:${port} (${root})`))
