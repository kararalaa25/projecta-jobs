// Email ownership is checked only on identities confirmed by Supabase.
export const OWNER_EMAILS = Object.freeze(['kararalkhafaji892@gmail.com','kararalkhafaji20@gmail.com'])
export const hasConfirmedIdentity = user => Boolean(user?.email_confirmed_at || user?.phone_confirmed_at)
export const isSuspended = user => Boolean((user?.app_metadata?.suspended === true && (!user.app_metadata.suspended_until || Date.parse(user.app_metadata.suspended_until)>Date.now())) || (user?.banned_until && Date.parse(user.banned_until)>Date.now()))
export const isOwner = user => Boolean(user?.email_confirmed_at && OWNER_EMAILS.includes(String(user.email||'').trim().toLowerCase()))
export const isSuperAdmin = user => Boolean(!isSuspended(user) && (isOwner(user) || (hasConfirmedIdentity(user) && user?.app_metadata?.role==='super_admin')))
export const canPublish = user => Boolean(!isSuspended(user) && (isSuperAdmin(user) || (hasConfirmedIdentity(user) && user?.app_metadata?.medical_professional_verified===true)))
