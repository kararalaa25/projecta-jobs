import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')

test('refinement stylesheet is imported after feed enhancements and before final contrast',()=>{
 const main=read('main.jsx')
 assert.match(main,/import '\.\/feed-enhancements\.css'\s*\nimport '\.\/ui-refinement\.css'\s*\nimport '\.\/theme-contrast\.css'/)
})

test('Telegram count chip stays owned by the final contrast layer',()=>{
 const contrast=read('theme-contrast.css'),refinement=read('ui-refinement.css')
 assert.match(contrast,/\.reference-board \.results-heading h2 > span\.results-count--telegram/)
 assert.match(contrast,/background-color: #0B1525/)
 assert.match(contrast,/color: #05CC8C/)
 assert.match(contrast,/font-weight: 800/)
 assert.match(contrast,/font-size: clamp\(18px, 2\.2vw, 26px\)/)
 assert.equal(refinement.includes('results-count--telegram'),false)
})

test('job cards do not introduce a second expired-status text node',()=>{
 const card=read('components/JobCard.jsx')
 assert.equal(card.includes('إعلان منتهي'),false)
 assert.match(card,/className="role-badge neutral">منشور غير موثّق</)
 assert.match(card,/<h3 className="job-card-title" dir="auto">/)
})

test('sync indicators no longer animate forever',()=>{
 const polish=read('ui-polish.css')
 assert.equal(polish.includes('sync-pulse'),false)
 assert.equal(polish.includes('sync-spin'),false)
})

test('refinement layer adds no cascade layer or broad important flags',()=>{
 const refinement=read('ui-refinement.css')
 assert.equal(refinement.includes('@layer'),false)
 assert.equal(/!\s*important/.test(refinement),false)
 for(const token of ['--ui-r-card','--ui-space-4','--ui-text-md','--ui-primary','--ui-focus'])assert.ok(refinement.includes(token),token)
})
