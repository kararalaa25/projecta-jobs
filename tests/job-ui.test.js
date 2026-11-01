import test from 'node:test'
import assert from 'node:assert/strict'
import {specialtyClass,normalizeSearch,jobSearchText,matchesSearch} from '../src/job-ui.js'

test('specialty colors cover the catalog, legacy nursing roles and unknown categories',()=>{
 for(const [role,color] of [['Dentists','dentistry'],['Pharmacists','pharmacy'],['Medical Reps','reps'],['Assistants & Techs','nursing'],['Dental Assistants','nursing'],['General Physicians','gp'],['Receptionists / Admin','operations'],['Unsorted','general'],['Custom specialty','general']])assert.equal(specialtyClass(role),'specialty-'+color)
})
test('instant search tolerates Arabic diacritics, alef variants, whitespace and English case',()=>{
 assert.equal(normalizeSearch('  أَسْنَان  إربيل  '),'اسنان اربيل')
 const text=jobSearchText({title:'طَبِيب أسنان',company:'Care Clinic',description:'فرصة للعمل',role:'Dentists',roles:['Medical Reps'],city:'Erbil',governorates:['Baghdad']})
 for(const query of ['اسنان','أَسْنَان','  CARE   clinic ','طبيب اربيل','Dentists','المندوبون','بغداد','   '])assert.equal(matchesSearch(text,query),true,query)
 for(const query of ['صيدلي','Care Basra','أسنان ممرض'])assert.equal(matchesSearch(text,query),false,query)
 assert.equal(matchesSearch(jobSearchText({}),''),true)
})
test('the same query matches both job feeds while preserving distinct feed membership',()=>{
 const common={title:'صيدلاني',company:'Clinic',role:'Pharmacists',city:'Baghdad'}
 for(const source of ['manual','telegram'])assert.equal(matchesSearch(jobSearchText({...common,source}),'بغداد صيادلة'),true)
})
