import {createHmac,createHash,timingSafeEqual} from 'node:crypto'
import {HttpError,uuid} from './http.js'
const secret=env=>{if(!env.TELEGRAM_LINK_SECRET||env.TELEGRAM_LINK_SECRET.length<32)throw new HttpError(503,'خدمة ربط التليجرام غير مهيأة.');return env.TELEGRAM_LINK_SECRET}
export const tokenHash=token=>createHash('sha256').update(token).digest('hex')
export function safeEqual(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))}
export function issueLink(userId,env,now=Date.now()){
 uuid(userId);const id=Buffer.from(userId.replaceAll('-',''),'hex').toString('base64url'),expires=Math.floor(now/1000)+600,payload=`${id}_${expires.toString(36)}`,signature=createHmac('sha256',secret(env)).update(payload).digest('base64url').slice(0,22)
 return {token:`${payload}_${signature}`,expiresAt:new Date(expires*1000).toISOString()}
}
export function verifyLink(token,env,now=Date.now()){
 if(!/^[A-Za-z0-9_-]{22}_[a-z0-9]{6,8}_[A-Za-z0-9_-]{22}$/.test(token||''))return null
 const id=token.slice(0,22),rest=token.slice(23),split=rest.indexOf('_'),expiry=rest.slice(0,split),sig=rest.slice(split+1),payload=`${id}_${expiry}`
 if(parseInt(expiry,36)*1000<now||!safeEqual(sig,createHmac('sha256',secret(env)).update(payload).digest('base64url').slice(0,22)))return null
 const hex=Buffer.from(id,'base64url').toString('hex');if(hex.length!==32)return null
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
