import catalog from './iraq.json' with {type:'json'}
import {normalizeIraqiPhone} from '../src/contacts.js'

export function isPlatformOffer(row){
 if(row.source!=='manual')return false
 let meta={};try{meta=JSON.parse(row.contact_info)||{}}catch{}
 const required=[row.title,row.description,row.salary_range,row.location_city]
 return required.every(value=>typeof value==='string'&&value.trim())&&
  catalog.governorates.some(g=>g.id===row.location_city||g.ar===row.location_city||g.aliases.includes(row.location_city))&&
  Boolean(normalizeIraqiPhone(row.contact_phone||meta?.phone))
}

export function belongsToFeed(job,feed){
 if(feed==='telegram')return job.type==='jobs'&&job.source==='telegram'
 if(feed==='jobs')return job.type==='jobs'&&job.source==='manual'&&job.official===true
 return feed==='candidates'&&job.type==='candidates'
}
