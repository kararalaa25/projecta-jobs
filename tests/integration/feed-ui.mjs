import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync} from 'node:fs'
mkdirSync('work/verification',{recursive:true})
const catalog=JSON.parse(readFileSync('config/iraq.json','utf8'))
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[]
page.on('pageerror',error=>{errors.push(error.message);console.error('Browser:',error.message)})
const jobId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',expiredId='33333333-3333-4333-8333-333333333333'
let pipelineStatus='submitted',renewals=0,pipelineHarness=false
let releaseJobs
const jobGate=new Promise(resolve=>{releaseJobs=resolve})
const created=new Date(Date.now()-6*86400000).toISOString()
const row={id:jobId,title:'طبيب أسنان لعيادة مرخصة',description:'مطلوب طبيب أسنان للعمل في عيادة بغداد',role_category:'Dentists',employment_type:'full_time',location_city:'Baghdad',salary_range:'1500000',source:'manual',created_at:created,expires_at:new Date(Date.now()+24*86400000).toISOString(),contact_info:JSON.stringify({company_name:'عيادة اختبار مرخصة',phone:'07701234567',telegram:'clinic_jobs'})}
const candidate={id:'published-doctor',source:'platform',name:'د. اختبار موثق',headline:'طبيب أسنان',role:'Dentists',city:'Baghdad',qualification:'بكالوريوس طب أسنان',bio:'خبرة طبية',experience:6,skills:['ترميم الأسنان'],workTypes:['Full-time'],availability:'available',phone:null,whatsappEnabled:false,updatedAt:created,verification:{status:'verified',kind:'dentist',credentials:['syndicate_membership']}}
await page.route('**/*',async route=>{
 const url=new URL(route.request().url())
 if(url.origin!=='http://localhost:5173')return route.abort()
 if(pipelineHarness&&url.pathname==='/src/supabase.js')return route.fulfill({contentType:'application/javascript',body:"export const supabase={auth:{},channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){}}"})
 if(url.pathname==='/work/feed-test'){pipelineHarness=true;return route.fulfill({contentType:'text/html',body:`<html lang="ar" dir="rtl"><body><div id="root"></div><script type="module">
 import RefreshRuntime from '/@react-refresh';
 RefreshRuntime.injectIntoGlobalHook(window);
 window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
 window.__vite_plugin_react_preamble_installed__=true;
 </script><script type="module">
 import React from '/node_modules/.vite/deps/react.js';
 import ReactDOMClient from '/node_modules/.vite/deps/react-dom_client.js';
 import {supabase} from '/src/supabase.js';
 import AccountApplications from '/src/account/AccountApplications.jsx';
 import '/src/style.css';import '/src/account/account.css';
 supabase.auth.getSession=async()=>({data:{session:{access_token:'browser-test'}}});
 supabase.channel=()=>({on(type,filter,listener){window.refreshApplications=listener;return this},subscribe(){return this}});
 supabase.removeChannel=async()=>{};
 ReactDOMClient.createRoot(document.getElementById('root')).render(React.createElement(AccountApplications,{publisher:new URLSearchParams(location.search).has('publisher')}));
 </script></body></html>`})}
 if(url.pathname==='/api/applications'){
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON()
   if(body.action==='application.status')pipelineStatus=body.status
   if(body.action==='job.renew')renewals++
   return route.fulfill({json:{id:jobId,status:pipelineStatus}})
  }
  const view=url.searchParams.get('view')
  if(view==='posted')return route.fulfill({json:{rows:[{id:jobId,title:row.title,company:'عيادة اختبار',status:'active',created_at:created,expires_at:row.expires_at}],hasMore:false}})
  if(view==='applicants')return route.fulfill({json:{job:{title:row.title,company:'عيادة اختبار'},rows:[{id:'application',name:'طبيب اختبار',status:pipelineStatus,created_at:created,cover_letter:'نبذة مهنية للاختبار',hasCv:false,verification:candidate.verification}],hasMore:false}})
  return route.fulfill({json:{rows:[{id:'application',job:{title:row.title,company:'عيادة اختبار'},status:pipelineStatus,created_at:created}],hasMore:false}})
 }
 if(url.pathname==='/api/jobs'){await jobGate;return route.fulfill({json:{jobs:[row,{...row,id:otherId,title:'إعلان غير موثق',contact_info:JSON.stringify({company_name:'جهة غير موثقة',phone:'07801234567'})},{...row,id:expiredId,title:'إعلان منتهي',expires_at:'2020-01-01'}],hasMore:false}})}
 if(url.pathname==='/api/profile-trust')return route.fulfill({json:{jobs:(url.searchParams.get('ids')||'').split(',').map(id=>({id,verification:id===jobId?{status:'verified',kind:'clinic',credentials:['facility_license']}:{status:'unverified',kind:'professional',credentials:[]}}))}})
 if(url.pathname==='/api/directory')return route.fulfill({json:{items:url.searchParams.get('kind')==='talent'?[candidate]:[],hasMore:false}})
 if(url.pathname==='/api/platform')return route.fulfill({json:{settings:{},catalog:[...catalog.roles.map((r,i)=>({id:r.id,label:r.ar,kind:'role',active:true,position:i})),...catalog.governorates.map((g,i)=>({id:g.id,label:g.ar,kind:'location',active:true,position:i}))]}})
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:{},status:200})
 return route.continue()
})
await page.goto('http://localhost:5173',{waitUntil:'domcontentloaded'})
await page.locator('.job-card-skeleton').first().waitFor()
releaseJobs()
await page.locator('.job-card').first().waitFor()
assert.equal(await page.locator('.job-card').count(),2)
assert.equal(await page.getByText('إعلان منتهي',{exact:true}).count(),0)
const badge=page.getByRole('button',{name:'مركز طبي / عيادة مرخصة',exact:true})
await badge.click()
assert.equal(await page.getByRole('tooltip').count(),1,'facility tooltip is touch accessible')
await badge.press('Escape')
assert.equal(await page.getByRole('tooltip').count(),0)
assert.equal(await page.locator('.quick-apply').first().isVisible(),true)
assert.equal(await page.locator('.full-apply-label').first().isVisible(),true)
const href=await page.locator('.quick-apply').first().getAttribute('href')
assert.ok(href.includes('https://wa.me/9647701234567?text='))
await page.getByRole('switch',{name:'عضوية موثقة فقط'}).check()
assert.equal(await page.locator('.job-card').count(),1)
const filterTrigger=page.getByRole('button',{name:'إظهار خيارات التصفية'})
await filterTrigger.click()
const sheet=page.getByRole('dialog',{name:'تصفية الفرص'})
await sheet.waitFor()
assert.equal(await page.evaluate(()=>document.getElementById('root').inert),true)
assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden')
assert.equal(await sheet.getByRole('switch').count(),0,'the prominent verified toggle is not duplicated in the sheet')
const applyFilters=sheet.getByRole('button',{name:/تطبيق/})
await applyFilters.focus();await page.keyboard.press('Tab')
assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'إغلاق النافذة')
await page.keyboard.press('Escape')
assert.equal(await filterTrigger.evaluate(node=>node===document.activeElement),true)
await filterTrigger.click()
await sheet.getByRole('combobox',{name:'المحافظة في قائمة التصفية'}).selectOption('Basra')
assert.ok((await applyFilters.innerText()).includes('٠'))
await applyFilters.click()
await page.getByRole('heading',{name:'لم نعثر على نتائج مطابقة'}).waitFor()
assert.equal(await page.evaluate(()=>document.getElementById('root').inert),false)
assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden')
await page.getByRole('button',{name:'مسح عوامل التصفية',exact:true}).click()
assert.equal(await page.locator('.job-card').count(),2)
await filterTrigger.click()
await sheet.getByRole('combobox',{name:'المحافظة في قائمة التصفية'}).selectOption('Basra')
await sheet.getByRole('button',{name:'مسح الكل',exact:true}).click()
assert.ok((await applyFilters.innerText()).includes('٢'))
await applyFilters.click()
await page.getByRole('switch',{name:'عضوية موثقة فقط'}).check()
assert.equal(await page.locator('.job-card').count(),1)
await page.locator('.job-card').first().screenshot({path:'work/verification/mobile-job-card.png'})
await page.screenshot({path:'work/verification/mobile-jobs.png',fullPage:true})
await page.getByRole('tab',{name:'الباحثون عن عمل'}).click()
assert.equal(await page.locator('.candidate-card').count(),1)
assert.ok((await page.locator('.listing-time').innerText()).includes('نُشر'))
await page.setViewportSize({width:1280,height:900})
await page.getByRole('tab',{name:'وظائف المنصة',exact:false}).click()
assert.equal(await page.locator('.quick-apply').first().isVisible(),false)
assert.equal(await page.getByRole('switch',{name:'عضوية موثقة فقط'}).isVisible(),true)
assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl')
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
await page.screenshot({path:'work/verification/desktop-jobs.png',fullPage:true})
for(const width of [375,767,768,1280]){
 await page.setViewportSize({width,height:900})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}px`)
 assert.equal(await page.getByRole('button',{name:'إظهار خيارات التصفية'}).isVisible(),width<768)
}
await page.setViewportSize({width:375,height:812})
await filterTrigger.click()
await sheet.waitFor()
await page.screenshot({path:'work/verification/mobile-filter-sheet.png',animations:'disabled'})
await page.setViewportSize({width:1280,height:900})
await sheet.waitFor({state:'detached'})
assert.equal(await page.evaluate(()=>document.getElementById('root').inert),false)
await page.emulateMedia({reducedMotion:'reduce'})
await badge.focus()
assert.equal(await page.getByRole('tooltip').evaluate(node=>getComputedStyle(node).animationName),'none')
await badge.press('Escape')

await page.goto('http://localhost:5173/talent',{waitUntil:'networkidle'})
await page.getByRole('switch',{name:'عضوية موثقة فقط'}).check()
assert.equal(await page.locator('.talent-card').count(),1)
assert.ok((await page.locator('.candidate-freshness').innerText()).includes('نُشر'))
assert.ok(new URL(page.url()).searchParams.get('verified')==='1')
await page.goto('http://localhost:5173/work/feed-test?publisher=1',{waitUntil:'networkidle'})
await page.getByRole('button',{name:'تجديد الإعلان لمدة ٣٠ يوماً'}).click()
assert.equal(renewals,1)
await page.getByRole('button',{name:'عرض المتقدمين'}).click()
await page.getByRole('combobox',{name:'حالة طلب طبيب اختبار'}).selectOption('shortlisted')
await page.getByText('مُرشَّح للقائمة القصيرة',{exact:true}).first().waitFor()
assert.equal(pipelineStatus,'shortlisted')
await page.goto('http://localhost:5173/work/feed-test',{waitUntil:'networkidle'})
assert.equal(await page.locator('.application-state').innerText(),'مُرشَّح للقائمة القصيرة')
pipelineStatus='archived'
await page.evaluate(()=>window.refreshApplications())
await page.getByText('تمت الأرشفة',{exact:true}).waitFor()
assert.deepEqual(errors,[])
await browser.close()
console.log('PASS: mobile quick apply + full application, touch/keyboard tooltip, verified job/candidate filters, timestamps, desktop visibility, RTL, 375/767/768/1280px layouts, filter sheet keyboard/resize/reset/apply, skeletons, empty recovery, reduced motion, employer stages and realtime updates')
