const fields=['id','title','role_category','employment_type','location_city','salary_range','description','contact_info','source','created_at','renewed_at','expires_at','contact_phone','contact_telegram','contact_whatsapp']
const metaScalars=['phone','telegram','whatsapp','company_name','source_url','parsing_status','role_category','governorate','employment_type','source_posted_at','featured']
const metaArrays=['role_categories','governorates','target_audience']
export function publicJobOffer(row){
 const result=Object.fromEntries(fields.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]))
 if(Object.hasOwn(result,'contact_info')){
  let meta={};try{meta=JSON.parse(row.contact_info)||{}}catch{}
  const safe={}
  for(const key of metaScalars)if(['string','boolean'].includes(typeof meta[key])||meta[key]===null)safe[key]=meta[key]
  for(const key of metaArrays)if(Array.isArray(meta[key]))safe[key]=meta[key].filter(v=>typeof v==='string').slice(0,30)
  result.contact_info=JSON.stringify(safe)
 }
 return result
}
