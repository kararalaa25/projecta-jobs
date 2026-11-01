// Summarize one or more Lighthouse JSON reports without treating lab scores as field data.
import {readFile} from 'node:fs/promises'
const paths=process.argv.slice(2)
if(!paths.length){console.error('Usage: node scripts/performance/report.mjs <lighthouse-report.json> [...]');process.exit(1)}
const median=values=>{const sorted=values.toSorted((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2}
const ids={'FCP ms':'first-contentful-paint','LCP ms':'largest-contentful-paint','TBT ms':'total-blocking-time','CLS':'cumulative-layout-shift','Speed Index ms':'speed-index','Transferred bytes':'total-byte-weight'}
const reports=await Promise.all(paths.map(async path=>JSON.parse(await readFile(path,'utf8'))))
for(const report of reports)if(report.runtimeError)throw Error(report.runtimeError.message)
const metrics=Object.fromEntries(Object.entries(ids).map(([label,id])=>[label,median(reports.map(report=>report.audits[id].numericValue))]))
console.log(JSON.stringify({runs:reports.length,medianScore:Math.round(median(reports.map(report=>report.categories.performance.score))*100),...metrics},null,2))
