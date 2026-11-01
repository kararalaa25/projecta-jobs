import test from 'node:test'
import assert from 'node:assert/strict'
import {validateHeaderName,validateHeaderValue} from 'node:http'
import configuration from '../vercel.json' with {type:'json'}

test('security response headers cover all routes and contain valid HTTP values',()=>{
 const rule=configuration.headers.find(rule=>rule.source==='/(.*)')
 assert.ok(rule,'All-route policy must also cover assets and API responses')
 const headers=Object.fromEntries(rule.headers.map(({key,value})=>{validateHeaderName(key);validateHeaderValue(key,value);return [key,value]}))
 assert.equal(Object.keys(headers).length,rule.headers.length)
 assert.equal(headers['X-Frame-Options'],'DENY')
 assert.equal(headers['X-Content-Type-Options'],'nosniff')
 assert.equal(headers['Referrer-Policy'],'strict-origin-when-cross-origin')
 assert.equal(headers['Permissions-Policy'],'camera=(), microphone=(), geolocation=()')
 const directives=new Map(headers['Content-Security-Policy'].split(';').map(value=>value.trim().split(/\s+/)).filter(parts=>parts[0]).map(([name,...sources])=>[name,sources]))
 assert.deepEqual(directives.get('frame-ancestors'),["'none'"])
 for(const directive of ['script-src','style-src'])assert.ok(directives.get(directive).includes("'unsafe-inline'"))
 assert.ok(directives.get('style-src').includes('https://fonts.googleapis.com'))
 assert.ok(directives.get('font-src').includes('https://fonts.gstatic.com'))
 assert.deepEqual(directives.get('connect-src'),["'self'",'https://*.supabase.co','wss://*.supabase.co'])
 assert.ok(directives.get('img-src').includes('https:'))
 assert.deepEqual(directives.get('worker-src'),["'self'",'blob:'])
})
