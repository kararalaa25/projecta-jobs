import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync} from 'node:fs'
mkdirSync('work/verification',{recursive:true})
const catalog=JSON.parse(readFileSync('config/iraq.json','utf8'))
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[]
page.on('pageerror',error=>{errors.push(error.message);console.error('Browser:',error.message)})
const jobId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',expiredId='33333333-3333-4333-8333-333333333333',telegramId='44444444-4444-4444-8444-444444444444'
let pipelineStatus='submitted',renewals=0,pipelineHarness=false
let releaseJobs
const jobGate=new Promise(resolve=>{releaseJobs=resolve})
let jobsRequests=0,delayJobs=false,failJobs=false,releaseDelayedJobs,statusWithoutDate=false,failStatus=false
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
 if(url.pathname==='/api/jobs'){
  await jobGate
  jobsRequests++
  if(failJobs){failJobs=false;return route.fulfill({status:500,json:{error:'feed offline'}})}
  if(delayJobs)await new Promise(resolve=>{releaseDelayedJobs=resolve})
  return route.fulfill({json:{jobs:[row,{...row,id:otherId,title:'إعلان غير موثق',contact_info:JSON.stringify({company_name:'جهة غير موثقة',phone:'07801234567'})},{...row,id:expiredId,title:'إعلان منتهي',expires_at:'2020-01-01'},{...row,id:telegramId,title:'وظيفة تليجرام للاختبار',source:'telegram',contact_info:JSON.stringify({company_name:'مجتمع التليجرام',phone:'07701234567',parsing_status:'parsed'})}],hasMore:false}})}
 if(url.pathname==='/api/telegram-status'){
  if(failStatus){failStatus=false;return route.fulfill({status:503,json:{}})}
  return route.fulfill({json:{status:'ok',lastCheckedAt:statusWithoutDate?null:new Date(Date.now()-60000).toISOString(),intervalSeconds:300}})
 }
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
// Dock destinations are scoped to .mobile-nav because the feed tab strip shares the labels.
const dock=page.locator('.mobile-nav'),dockButton=index=>dock.locator('button').nth(index)
const dockView=()=>page.locator('main.marketplace').getAttribute('data-mobile-view')
const dockCurrent=index=>dockButton(index).getAttribute('aria-current')
const tabSelected=index=>page.locator('.tabs [role=tab]').nth(index).getAttribute('aria-selected')
const anchorBox=id=>page.evaluate(id=>{const el=document.getElementById(id);return {top:el.getBoundingClientRect().top,header:document.querySelector('.reference-header.header').getBoundingClientRect().bottom,offset:parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)+parseFloat(getComputedStyle(el).scrollMarginTop)}},id)
const assertAnchored=async id=>{
 await page.waitForFunction(id=>{const el=document.getElementById(id);if(!el)return false;const offset=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)+parseFloat(getComputedStyle(el).scrollMarginTop);return Math.abs(el.getBoundingClientRect().top-offset)<=2},id)
 const box=await anchorBox(id)
 assert.ok(box.top>=box.header-1&&Math.abs(box.top-box.offset)<=2,`${id} must anchor below the sticky header: ${JSON.stringify(box)}`)
}
assert.deepEqual(await dock.locator('button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))),['الرئيسية','وظائف التليجرام','نشر فرصة عمل','الباحثون عن عمل','طلباتي ونشاطي'])
assert.equal(await dock.isVisible(),true,'dock visible at 375px')
assert.equal(await dockView(),'jobs')
assert.equal(await dockCurrent(0),'true')
assert.equal(await tabSelected(0),'true')
await dockButton(1).click()
await page.waitForFunction(()=>window.scrollY>0)
await page.locator('.job-card').filter({hasText:'وظيفة تليجرام للاختبار'}).first().waitFor()
assert.equal(await dockView(),'telegram')
assert.equal(await dockCurrent(1),'true')
assert.equal(await dockCurrent(0),null)
assert.equal(await tabSelected(1),'true')
assert.equal(await page.locator('.job-card').count(),1)
assert.equal(await page.evaluate(()=>window.scrollY>0),true)
assert.equal(await page.evaluate(()=>document.activeElement.id),'results-heading')
await assertAnchored('job-board')
await dockButton(3).click()
await page.locator('.candidate-card').first().waitFor()
assert.equal(await dockView(),'candidates')
assert.equal(await dockCurrent(3),'true')
assert.equal(await dockCurrent(1),null)
assert.equal(await tabSelected(2),'true')
assert.ok((await page.locator('#results-heading').innerText()).includes('تعرّف إلى كفاءاتنا'))
assert.equal(await page.locator('.candidate-card').filter({hasText:'د. اختبار موثق'}).first().isVisible(),true)
assert.equal(await page.evaluate(()=>document.activeElement.id),'results-heading')
await assertAnchored('job-board')
await page.setViewportSize({width:375,height:420})
await dockButton(4).click()
await page.locator('[data-panel="activity"]').waitFor()
assert.equal(await dockView(),'activity')
assert.equal(await dockCurrent(4),'true')
assert.equal(await page.locator('[data-panel="activity"]').isVisible(),true)
assert.equal(await page.locator('[data-panel="feed"]').isVisible(),false)
await page.waitForFunction(()=>document.activeElement?.id==='mobile-activity-title')
assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-activity-title')
await page.waitForFunction(()=>{const el=document.getElementById('mobile-activity-title');if(!el)return false;const offset=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)+parseFloat(getComputedStyle(el).scrollMarginTop);return Math.abs(el.getBoundingClientRect().top-offset)<=2})
const activityTitle=await page.evaluate(()=>{const el=document.getElementById('mobile-activity-title'),box=el.getBoundingClientRect();return {top:box.top,bottom:box.bottom,header:document.querySelector('.reference-header.header').getBoundingClientRect().bottom,scrollY:window.scrollY,scrollable:document.documentElement.scrollHeight>innerHeight,margin:parseFloat(getComputedStyle(el).scrollMarginTop),offset:parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)+parseFloat(getComputedStyle(el).scrollMarginTop)}})
assert.equal(activityTitle.margin,12,'activity heading uses the mobile-only 12px clearance')
assert.equal(activityTitle.scrollable,true,'activity panel is scrollable at 375x420')
assert.ok(activityTitle.scrollY>0,'scrolling into the activity heading actually moved the page')
assert.ok(activityTitle.top>=0&&activityTitle.bottom<=812,'activity heading stays in the viewport')
assert.ok(activityTitle.top>=activityTitle.header-1&&Math.abs(activityTitle.top-activityTitle.offset)<=2,`activity heading anchors below the sticky header: ${JSON.stringify(activityTitle)}`)
assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-activity-title')
await page.setViewportSize({width:375,height:812})
await dockButton(0).click()
await page.waitForFunction(()=>window.scrollY<2)
await page.locator('.job-card').first().waitFor()
assert.equal(await dockView(),'jobs')
assert.equal(await dockCurrent(0),'true')
assert.equal(await tabSelected(0),'true')
assert.equal(await page.evaluate(()=>window.scrollY<2),true)
assert.equal(await page.locator('.job-card').count(),2)
assert.equal(await page.getByText('وظيفة تليجرام للاختبار',{exact:true}).count(),0)
await page.evaluate(()=>{window.__dockSentinel='stable'})
await dockButton(2).click()
const postDialog=page.getByRole('dialog')
await postDialog.waitFor()
assert.equal(await dockView(),'jobs','posting keeps the current dock destination')
assert.equal(await dockCurrent(0),'true')
await page.keyboard.press('Escape')
await postDialog.waitFor({state:'detached'})
assert.equal(await page.evaluate(()=>window.__dockSentinel),'stable','post action does not reload the page')
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
await page.locator('.job-card').first().screenshot({path:'work/verification/mobile-job-card.png',animations:'disabled'})
await page.screenshot({path:'work/verification/mobile-jobs.png',fullPage:true,animations:'disabled'})
await page.getByRole('tab',{name:'الباحثون عن عمل'}).click()
assert.equal(await page.locator('.candidate-card').count(),1)
assert.ok((await page.locator('.listing-time').innerText()).includes('نُشر'))
await page.setViewportSize({width:1440,height:900})
assert.equal(await page.locator('.mobile-nav').isVisible(),false,'dock hidden at 1440px')
await page.evaluate(()=>document.getElementById('job-board').scrollIntoView({behavior:'instant',block:'start'}))
const desktopAnchor=await anchorBox('job-board')
assert.ok(desktopAnchor.top>=desktopAnchor.header-1&&Math.abs(desktopAnchor.top-desktopAnchor.offset)<=2,`desktop board anchors below sticky header: ${JSON.stringify(desktopAnchor)}`)
await page.getByRole('tab',{name:'وظائف المنصة',exact:false}).click()
assert.equal(await page.locator('.quick-apply').first().isVisible(),false)
assert.equal(await page.getByRole('switch',{name:'عضوية موثقة فقط'}).isVisible(),true)
assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl')
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
await page.screenshot({path:'work/verification/desktop-jobs.png',fullPage:true,animations:'disabled'})
for(const width of [375,767,768,1280,1440]){
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

// ── Telegram count chip and manual feed refresh ─────────────────────────
const waitForJobsRequests=async target=>{
 for(let attempt=0;attempt<100;attempt++){
  if(jobsRequests>=target)return
  await new Promise(resolve=>setTimeout(resolve,20))
 }
 throw Error(`expected ${target} jobs requests, saw ${jobsRequests}`)
}
const readChip=()=>page.locator('.results-count--telegram').evaluate(node=>{const style=getComputedStyle(node),box=node.getBoundingClientRect();return {display:style.display,color:style.color,background:style.backgroundColor,weight:parseInt(style.fontWeight,10),size:parseFloat(style.fontSize),left:box.left,right:box.right}})
await page.getByRole('switch',{name:'عضوية موثقة فقط'}).uncheck()
await page.getByRole('tab',{name:'وظائف التليجرام'}).click()
const chip=page.locator('.results-count--telegram')
await chip.waitFor()
let style=await readChip()
assert.equal(style.display,'inline-flex')
assert.equal(style.color,'rgb(5, 204, 140)','exact Telegram green on navy')
assert.equal(style.background,'rgb(11, 21, 37)','navy chip keeps green at AA contrast')
assert.ok(style.weight>=700,`chip weight ${style.weight} must be bold`)
assert.ok(style.size>=18,`chip size ${style.size}px must be readable`)
assert.ok((await chip.innerText()).includes('١'),'chip still announces the count')
if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='dark')await page.getByRole('switch',{name:'التبديل إلى الوضع الداكن'}).click()
await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark')
style=await readChip()
assert.equal(style.color,'rgb(5, 204, 140)','dark theme keeps exact green')
assert.equal(style.background,'rgb(11, 21, 37)','dark theme keeps navy chip')
await page.getByRole('switch',{name:'التبديل إلى الوضع الفاتح'}).click()
await page.waitForFunction(()=>document.documentElement.dataset.theme==='light')
assert.ok((await page.locator('.sync-last-check').innerText()).includes('متزامن مع تيليجرام'),'backend status ok is treated as live')
const syncRefresh=page.locator('.sync-refresh')
statusWithoutDate=true
await syncRefresh.click()
await page.waitForFunction(()=>document.querySelector('.sync-last-check')?.textContent?.trim()==='متزامن مع تيليجرام')
assert.equal((await page.locator('.sync-last-check').innerText()).includes('آخر تحديث قبل'),false,'no dangling relative-time suffix without a valid timestamp')
await page.waitForFunction(()=>!document.querySelector('.sync-refresh')?.disabled)
statusWithoutDate=false
await syncRefresh.click()
await page.waitForFunction(()=>document.querySelector('.sync-last-check')?.textContent?.includes('آخر تحديث قبل'))
await page.waitForFunction(()=>!document.querySelector('.sync-refresh')?.disabled)
failStatus=true
await syncRefresh.click()
await page.locator('.telegram-sync-status.unknown').waitFor()
assert.ok((await page.locator('.telegram-sync-status').innerText()).includes('تعذر الوصول إلى حالة المزامنة'))
assert.equal(await page.locator('.telegram-sync-status time').count(),1,'a failed refresh preserves the previous timestamp')
await page.getByRole('tab',{name:'وظائف المنصة',exact:false}).click()
assert.equal(await chip.count(),0,'non-Telegram headings have no special count chip')
assert.equal(await page.locator('.reference-board .results-heading h2 > span').count(),1)
await page.getByRole('tab',{name:'وظائف التليجرام'}).click()
await chip.waitFor()
for(const width of [320,375,768,1024,1440]){
 await page.setViewportSize({width,height:900})
 const responsive=await readChip()
 assert.equal(responsive.display,'inline-flex',`chip stays inline-flex at ${width}px`)
 assert.equal(responsive.color,'rgb(5, 204, 140)',`chip keeps exact green at ${width}px`)
 assert.equal(responsive.background,'rgb(11, 21, 37)',`chip keeps navy at ${width}px`)
 assert.ok(responsive.left>=-1&&responsive.right<=width+1,`chip inside viewport at ${width}px`)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`no horizontal overflow at ${width}px`)
}
await page.setViewportSize({width:375,height:812})
const search=page.getByRole('searchbox',{name:'البحث في الإعلانات'})
const citySelect=page.getByRole('combobox',{name:'تصفية حسب المحافظة'})
await search.fill('تليجرام')
await citySelect.selectOption('Baghdad')
await page.locator('.job-card').filter({hasText:'وظيفة تليجرام للاختبار'}).first().waitFor()
const beforeCards=await page.locator('.job-card').count(),cardText=await page.locator('.job-card').first().innerText()
assert.equal(beforeCards,1)
const beforeRequests=jobsRequests,refreshButton=page.locator('.feed-status-compact button')
delayJobs=true
await refreshButton.click()
await page.waitForFunction(()=>document.querySelector('.feed-status-compact')?.getAttribute('aria-busy')==='true')
await waitForJobsRequests(beforeRequests+1)
assert.equal(await refreshButton.isDisabled(),true,'button disabled while refresh is in flight')
assert.ok((await page.locator('.feed-status-compact').innerText()).includes('جارٍ التحديث'))
await refreshButton.evaluate(node=>node.click())
await new Promise(resolve=>setTimeout(resolve,150))
assert.equal(jobsRequests,beforeRequests+1,'double click issues exactly one additional request')
assert.equal(await search.inputValue(),'تليجرام','search survives refresh')
assert.equal(await citySelect.inputValue(),'Baghdad','city filter survives refresh')
assert.equal(await page.locator('.job-card').count(),beforeCards,'old cards stay visible while loading')
assert.equal(await page.locator('.job-card').first().innerText(),cardText)
assert.equal(await page.locator('.job-card-skeleton').count(),0,'no skeleton replaces existing cards')
delayJobs=false
releaseDelayedJobs()
await page.waitForFunction(()=>document.querySelector('.feed-status-compact')?.getAttribute('aria-busy')==='false')
assert.equal(await refreshButton.isDisabled(),false)
failJobs=true
await refreshButton.click()
await waitForJobsRequests(beforeRequests+2)
await page.getByRole('button',{name:'إعادة محاولة تحميل الفرص'}).waitFor()
assert.ok((await page.locator('.feed-status-compact').innerText()).includes('تعذر تحميل الفرص'))
assert.equal(await page.locator('.job-card').count(),beforeCards,'failed refresh keeps existing cards')
assert.equal(await page.locator('.job-card').first().innerText(),cardText)
await page.getByRole('button',{name:'إعادة محاولة تحميل الفرص'}).click()
await waitForJobsRequests(beforeRequests+3)
await page.waitForFunction(()=>document.querySelector('.feed-status-compact')?.getAttribute('aria-busy')==='false')
assert.ok((await refreshButton.innerText()).includes('تحديث'),'retry restores the normal refresh label')
await search.fill('')
await citySelect.selectOption('All cities')
await page.setViewportSize({width:1280,height:900})

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
assert.equal(await page.locator('.app-timeline-state').innerText(),'مُرشَّح للقائمة القصيرة')
pipelineStatus='archived'
await page.evaluate(()=>window.refreshApplications())
await page.waitForFunction(()=>document.querySelector('.app-timeline-state')?.textContent?.trim()==='تمت الأرشفة')
// ── Refinement contract: flat dock, tokenized surfaces, icon-only chrome ──
const mainSource=readFileSync('src/main.jsx','utf8')
const adminSource=readFileSync('src/admin/AdminApp.jsx','utf8')
const talentSource=readFileSync('src/talent/TalentDirectory.jsx','utf8')
for(const marker of ['<Radio size={14} strokeWidth={1.75} aria-hidden="true"/> مباشر','<RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/> تحديث تلقائي','<X size={16}/>'])assert.ok(mainSource.includes(marker),`main icon marker missing: ${marker}`)
for(const marker of ['<BadgeCheck size={14} strokeWidth={1.75} aria-hidden="true"/> معتمد','<Star size={14} strokeWidth={1.75} aria-hidden="true"/> مميز','<ExternalLink size={14} strokeWidth={1.75} aria-hidden="true"/> فتح السيرة الذاتية','<ExternalLink size={14} strokeWidth={1.75} aria-hidden="true"/> عرض مستند الترخيص'])assert.ok(adminSource.includes(marker),`admin icon marker missing: ${marker}`)
assert.ok(talentSource.includes('<X size={16} strokeWidth={1.75} aria-hidden="true"/>'),'talent notice uses the X icon')
for(const [source,symbol] of [[mainSource,'●'],[mainSource,'◌'],[adminSource,'✓'],[adminSource,'★'],[adminSource,'↗'],[talentSource,'×']])assert.equal(source.includes(symbol),false,`legacy chrome symbol ${symbol} must be gone`)

pipelineHarness=false
await page.goto('http://localhost:5173',{waitUntil:'domcontentloaded'})
await page.locator('.job-card').first().waitFor()
await page.setViewportSize({width:375,height:812})
const flatDock=page.locator('.mobile-nav.liquid-nav')
assert.equal(await flatDock.locator(':scope > button').count(),5,'dock keeps exactly five controls')
assert.equal(await flatDock.locator('svg.mobile-nav-surface').count(),0)
assert.equal(await flatDock.locator('.liquid-nav-indicator').count(),0)
assert.equal(await flatDock.locator('.mobile-post-orb').count(),0)
const dockStyle=await flatDock.evaluate(node=>{const style=getComputedStyle(node);return {boxShadow:style.boxShadow,backdrop:style.backdropFilter,image:style.backgroundImage,radius:style.borderRadius}})
assert.deepEqual(dockStyle,{boxShadow:'none',backdrop:'none',image:'none',radius:'12px'})
const buttonWidths=await flatDock.locator(':scope > button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width))
assert.ok(Math.max(...buttonWidths)-Math.min(...buttonWidths)<=1,'all five dock controls are equal width')
const connection=page.locator('.feed-connection')
assert.equal(await connection.locator('svg').count(),1,'feed status uses one lucide icon')
const connectionText=(await connection.innerText()).trim()
assert.ok(connectionText==='مباشر'||connectionText==='تحديث تلقائي',`feed status text preserved: ${connectionText}`)
const connectionIcon=await connection.locator('svg').evaluate(node=>({hidden:node.getAttribute('aria-hidden'),width:node.getAttribute('width'),height:node.getAttribute('height'),stroke:node.getAttribute('stroke-width')}))
assert.deepEqual(connectionIcon,{hidden:'true',width:'14',height:'14',stroke:'1.75'})

// ── AA contrast guard: the three refinement failures, measured at 375px ──
const aaRGB=value=>value.match(/[\d.]+/g).slice(0,3).map(Number)
const aaLuminance=value=>{const [r,g,b]=aaRGB(value).map(v=>{const c=v/255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
const aaRatio=(a,b)=>{const [hi,lo]=[aaLuminance(a),aaLuminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05)}
const readAA=()=>page.evaluate(()=>{
 const effectiveBg=node=>{for(let current=node;current;current=current.parentElement){const bg=getComputedStyle(current).backgroundColor;if(bg&&!/^rgba\(0, 0, 0, 0\)$/.test(bg))return bg}return null}
 const read=selector=>{const node=document.querySelector(selector),style=getComputedStyle(node);return {color:style.color,background:effectiveBg(node)}}
 return {setup:read('.matching-setup-action'),dock:read('.mobile-nav.liquid-nav>button.active'),heading:read('.mobile-activity-panel h2')}
})
const assertAA=async theme=>{
 await page.waitForTimeout(500)
 for(const [name,{color,background}] of Object.entries(await readAA())){
  const ratio=aaRatio(color,background)
  assert.ok(ratio>=4.5,`${theme} ${name} contrast ${ratio.toFixed(2)}:1 (${color} on ${background})`)
 }
}
// The header switch is drawer-only at 375px, so flip the root theme token directly.
const setAATheme=theme=>page.evaluate(value=>{document.documentElement.dataset.theme=value},theme)
await setAATheme('light')
await assertAA('light')
await setAATheme('dark')
await assertAA('dark')
await setAATheme('light')

await page.setViewportSize({width:1280,height:900})
const cardStyle=await page.locator('.job-card').first().evaluate(node=>{const style=getComputedStyle(node);return {radius:style.borderRadius,shadow:style.boxShadow,image:style.backgroundImage}})
assert.equal(cardStyle.radius,'12px')
assert.equal(cardStyle.shadow,'none')
assert.equal(cardStyle.image,'none')
assert.equal(await page.getByRole('combobox',{name:'تصفية حسب المحافظة'}).evaluate(node=>getComputedStyle(node).borderRadius),'8px','controls use the tokenized radius')
const landing=await page.evaluate(()=>{
 const style=selector=>getComputedStyle(document.querySelector(selector))
 return {
  boardImage:style('.reference-board').backgroundImage,
  heroImage:style('.reference-hero.career-hero').backgroundImage,
  heroAnimation:style('.reference-hero.career-hero').animationName,
  backdropDisplay:style('.career-hero-backdrop').display,
  overlayDisplay:style('.hero-gradient-overlay').display,
  overlayImage:style('.hero-gradient-overlay').backgroundImage,
  overlayColor:style('.hero-gradient-overlay').backgroundColor,
  glassFilter:style('.reference-glass-panel').backdropFilter,
  headerFilter:style('.reference-header.header').backdropFilter,
  headerDirection:style('.reference-header.header').direction,
  navDirection:style('.reference-header .desktop-nav').direction,
  hasBrand:Boolean(document.querySelector('.reference-header.header .brand')),
  heroTitle:document.querySelector('#career-title')?.textContent||'',
 }
})
assert.equal(landing.boardImage,'none')
assert.equal(landing.heroImage,'none')
assert.equal(landing.heroAnimation,'none')
assert.equal(landing.backdropDisplay,'block','brand hero image stays visible')
assert.equal(landing.overlayDisplay,'block','flat hero scrim stays visible')
assert.equal(landing.overlayImage,'none','hero scrim is flat, not a gradient')
assert.equal(landing.overlayColor,'rgba(11, 21, 37, 0.78)')
assert.equal(landing.glassFilter,'none')
assert.equal(landing.headerFilter,'none')
assert.equal(landing.headerDirection,'ltr')
assert.equal(landing.navDirection,'rtl')
assert.equal(landing.hasBrand,true)
assert.ok(landing.heroTitle.includes('خطوتك القادمة'))
for(const label of ['وظائف المنصة','وظائف التليجرام','ابدأ بخطوتك المناسبة','عن بروجكتا'])assert.ok(await page.getByText(label,{exact:false}).count()>0,`landing copy preserved: ${label}`)
const readEyebrow=()=>page.locator('.reference-hero .career-eyebrow').evaluate(node=>{const style=getComputedStyle(node);return {color:style.color,background:style.backgroundColor}})
const channels=value=>value.match(/[\d.]+/g).slice(0,3).map(Number)
const luminance=value=>{const [r,g,b]=channels(value).map(v=>{const c=v/255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b}
const contrast=(a,b)=>{const [lighter,darker]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (lighter+0.05)/(darker+0.05)}
await page.waitForFunction(()=>document.documentElement.dataset.theme==='light')
await page.waitForTimeout(500)
const lightEyebrow=await readEyebrow()
assert.equal(lightEyebrow.color,'rgb(11, 21, 37)','light eyebrow text uses --pc-ink')
assert.equal(lightEyebrow.background,'rgb(255, 255, 255)','light eyebrow pill uses --pc-surface')
assert.ok(contrast(lightEyebrow.color,lightEyebrow.background)>=4.5,'light eyebrow meets WCAG AA')
await page.getByRole('switch',{name:'التبديل إلى الوضع الداكن'}).click()
await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark')
await page.waitForTimeout(500)
const darkEyebrow=await readEyebrow()
assert.equal(darkEyebrow.color,'rgb(238, 244, 251)','dark eyebrow text uses --pc-ink')
assert.equal(darkEyebrow.background,'rgb(22, 38, 58)','dark eyebrow pill uses --pc-surface')
assert.ok(contrast(darkEyebrow.color,darkEyebrow.background)>=4.5,'dark eyebrow meets WCAG AA')
await page.getByRole('switch',{name:'التبديل إلى الوضع الفاتح'}).click()
await page.waitForFunction(()=>document.documentElement.dataset.theme==='light')
await page.waitForTimeout(500)
assert.deepEqual(errors,[])
await browser.close()
console.log('PASS: mobile quick apply + full application, touch/keyboard tooltip, verified job/candidate filters, timestamps, desktop visibility, RTL, 320/375/767/768/1024/1280/1440px layouts, Telegram count chip colors in light and dark, live sync status and failure copy, coalesced manual refresh with preserved filters/cards, retry recovery, filter sheet keyboard/resize/reset/apply, skeletons, empty recovery, reduced motion, employer stages and realtime updates')
