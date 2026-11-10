export const JOB_LIFETIME_MS=30*24*60*60*1000
export function jobExpiresAt(job){
 const expiry=job.expires_at||job.expiresAt
 if(expiry)return Date.parse(expiry)
 const published=job.renewed_at||job.renewedAt||job.created_at||job.publishedAt||job.createdAt
 return published?Date.parse(published)+JOB_LIFETIME_MS:NaN
}
export function isJobFresh(job,now=Date.now()){
 const expires=jobExpiresAt(job)
 // Legacy records without a usable timestamp cannot establish freshness.
 return Number.isFinite(expires)&&expires>now
}
