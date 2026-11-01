// Legacy job_offers ownership references job_users, not auth.users directly.
// Keep this compatibility row minimal: it is not an authentication/verification
// source, and must not copy private email, license or account contact data.
export async function ensurePublisher(db,user,publicName='ناشر بروجكتا'){
 const result=await db.from('job_users').upsert({id:user.id,full_name:publicName.trim().slice(0,100)||'ناشر بروجكتا',email:`publisher-${user.id}@accounts.projecta.invalid`},{onConflict:'id',ignoreDuplicates:true})
 if(result.error)throw result.error
}
