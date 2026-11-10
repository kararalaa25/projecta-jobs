import test from 'node:test'
import assert from 'node:assert/strict'
import catalog from '../config/iraq.json' with {type:'json'}
import {isPlatformOffer,belongsToFeed} from '../config/job-feeds.js'
import {matchGovernorates,matchEmploymentType} from '../config/job-matching.js'
import {toJob} from '../src/jobs.js'
import {createJobsHandler} from '../api/jobs.js'
const offer={id:'direct',source:'manual',title:'طبيب أسنان',description:'مطلوب طبيب أسنان للعمل في كربلاء',salary_range:'حسب الاتفاق',location_city:'Karbala',contact_info:JSON.stringify({phone:'07701234567'}),status:'active'}
test('feed membership never mixes imported, incomplete, unknown-source or device-local jobs into official offers',()=>{
 assert.equal(isPlatformOffer(offer),true)
 const official=toJob(offer),telegram=toJob({...offer,source:'telegram'})
 assert.equal(belongsToFeed(official,'jobs'),true);assert.equal(belongsToFeed(official,'telegram'),false)
 assert.equal(belongsToFeed(telegram,'telegram'),true);assert.equal(belongsToFeed(telegram,'jobs'),false)
 for(const missing of ['title','description','salary_range','location_city','contact_info']){
  const row={...offer,[missing]:null};assert.equal(isPlatformOffer(row),false,missing)
  assert.equal(belongsToFeed(toJob(row),'jobs'),false,missing)
 }
 for(const source of [undefined,'scraped','telegram'])assert.equal(isPlatformOffer({...offer,source}),false)
 assert.equal(belongsToFeed({type:'jobs',title:'legacy device post'},'jobs'),false)
 assert.equal(belongsToFeed({type:'candidates'},'candidates'),true)
})
test('Arabic and English location matching covers all governorate aliases with explicit-location priority',()=>{
 for(const g of catalog.governorates)for(const alias of g.aliases)assert.ok(matchGovernorates('الموقع: '+alias).includes(g.id),alias)
 assert.equal(matchGovernorates('شركة في بغداد، الموقع: الكوت')[0],'Wasit')
 assert.deepEqual(matchGovernorates('العمل في الحلة'),['Babylon'])
 assert.deepEqual(matchGovernorates('بدون عنوان معروف'),[])
})
test('Telegram raw posts receive usable specialty, province and schedule filters without fictional defaults',()=>{
 const mapped=toJob({...offer,source:'telegram',role_category:'',location_city:'',description:'مطلوب صيدلاني للعمل في الحلة بدوام جزئي هاتف 07701234567',contact_info:JSON.stringify({parsing_status:'unparsed',employment_type:null})})
 assert.equal(mapped.role,'Pharmacists');assert.equal(mapped.city,'Babylon');assert.equal(mapped.schedule,'Part-time')
 const unknown=toJob({source:'telegram',description:'مطلوب موظف للعمل في مؤسسة صحية حسب الاتفاق',employment_type:'full_time'})
 assert.equal(unknown.role,'Unsorted');assert.equal(unknown.city,'City not specified');assert.equal(unknown.schedule,'Schedule not specified')
 const metadataOnly=toJob({source:'telegram',description:'مطلوب للعمل في مؤسسة صحية حسب الاتفاق',contact_info:JSON.stringify({role_categories:['Dentists']})});assert.equal(metadataOnly.role,'Dentists')
 for(const [text,expected] of [['دوام كامل','Full-time'],['part-time','Part-time'],['دوام كامل أو دوام جزئي',null],['دوام مسائي',null]])assert.equal(matchEmploymentType(text),expected)
})
test('API feed filters are applied before pagination and reject invalid feed parameters',async()=>{
 for(const [feed,source] of [['platform','manual'],['telegram','telegram']]){
  const filters=[];let range
  const q={select(){return this},eq(k,v){filters.push([k,v]);return this},gt(){return this},order(){return this},range(...v){range=v;return this},async abortSignal(){return {data:[{...offer,source},{...offer,id:'incomplete',source,salary_range:null}]}}}
  const res={setHeader(){},end(raw){this.body=JSON.parse(raw)}}
  await createJobsHandler({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'},()=>({from(){return q}}))({method:'GET',url:'/api/jobs?feed='+feed+'&offset=200'},res)
  assert.equal(res.statusCode,200);assert.ok(filters.some(([k,v])=>k==='source'&&v===source));assert.deepEqual(range,[200,399])
  assert.equal(res.body.jobs.length,feed==='platform'?1:2)
 }
 const res={setHeader(){},end(raw){this.body=JSON.parse(raw)}}
 await createJobsHandler({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'},()=>{throw Error('must not query')})({method:'GET',url:'/api/jobs?feed=private'},res)
 assert.equal(res.statusCode,400)
})
