import {createWhatsAppPreferencesHandler} from './api/whatsapp/preferences.js'
import {createTelegramLinkHandler} from './api/telegram/link.js'
import {createTelegramWebhookHandler} from './api/telegram/webhook.js'
import { defineConfig, loadEnv } from 'vite'
import deploymentConfig from './vercel.json' with {type:'json'}
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {createResumesHandler} from './api/resumes.js'
import {createAdminHandler} from './api/admin.js'
import {createPlatformHandler} from './api/platform.js'
import {createTelegramStatusHandler} from './api/telegram-status.js'
import {createApplicationsHandler} from './api/applications.js'
import { createJobsHandler } from './api/jobs.js'
import {createVerificationsHandler} from './api/verifications.js'
import {createDirectoryHandler} from './api/directory.js'
import {serverClient} from './server/supabase.js'
import {createProfileTrustHandler} from './api/profile-trust.js'
import { createPublishHandler } from './api/publish-job.js'

export default defineConfig(({ mode }) => {
  // These values remain inside Node; only VITE_ values are available to the browser.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // Public commit metadata lets release checks distinguish a new deploy from a cached page.
  const release = /^[a-f0-9]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA || '') ? env.VERCEL_GIT_COMMIT_SHA : 'development'
  const releaseMetadata = {name:'release-metadata',transformIndexHtml(){return [{tag:'meta',attrs:{name:'projecta-release',content:release},injectTo:'head'}]}}
  // Reuse the deployment policy locally, before API and static handlers.
  const securityHeaders=Object.fromEntries(deploymentConfig.headers[0].headers.map(({key,value})=>[key,value]))
  const setSecurityHeaders=(development=false)=>(req,res,next)=>{
    for(const [key,value] of Object.entries(securityHeaders)){
      // Vite HMR uses a local WebSocket; this exception never enters production.
      res.setHeader(key,development&&key==='Content-Security-Policy'?value.replace("connect-src 'self'", "connect-src 'self' ws://localhost:* ws://127.0.0.1:*"):value)
    }
    next()
  }
  const localSecurityHeaders={name:'local-security-headers',configureServer(server){server.middlewares.use(setSecurityHeaders(true))},configurePreviewServer(server){server.middlewares.use(setSecurityHeaders())}}
  const localJobs = {
    name: 'local-job-feed',
    configureServer(server) { server.middlewares.use('/api/whatsapp/preferences',createWhatsAppPreferencesHandler(env));server.middlewares.use('/api/telegram/link',createTelegramLinkHandler(env));server.middlewares.use('/api/telegram/webhook',createTelegramWebhookHandler(env));server.middlewares.use('/api/resumes',createResumesHandler(env));server.middlewares.use('/api/admin',createAdminHandler(env));server.middlewares.use('/api/platform',createPlatformHandler(env));server.middlewares.use('/api/telegram-status',createTelegramStatusHandler(env));server.middlewares.use('/api/applications',createApplicationsHandler(env));server.middlewares.use('/api/jobs', createJobsHandler(env)); server.middlewares.use('/api/profile-trust',createProfileTrustHandler(env));server.middlewares.use('/api/directory',createDirectoryHandler(()=>serverClient(env)));server.middlewares.use('/api/verifications',createVerificationsHandler(env)); server.middlewares.use('/api/publish-job', createPublishHandler(env)) },
    configurePreviewServer(server) { server.middlewares.use('/api/whatsapp/preferences',createWhatsAppPreferencesHandler(env));server.middlewares.use('/api/telegram/link',createTelegramLinkHandler(env));server.middlewares.use('/api/telegram/webhook',createTelegramWebhookHandler(env));server.middlewares.use('/api/resumes',createResumesHandler(env));server.middlewares.use('/api/admin',createAdminHandler(env));server.middlewares.use('/api/platform',createPlatformHandler(env));server.middlewares.use('/api/telegram-status',createTelegramStatusHandler(env));server.middlewares.use('/api/applications',createApplicationsHandler(env));server.middlewares.use('/api/jobs', createJobsHandler(env)); server.middlewares.use('/api/profile-trust',createProfileTrustHandler(env));server.middlewares.use('/api/directory',createDirectoryHandler(()=>serverClient(env)));server.middlewares.use('/api/verifications',createVerificationsHandler(env)); server.middlewares.use('/api/publish-job', createPublishHandler(env)) },
  }
  return { build: { rollupOptions: { output: { manualChunks: { react: ['react','react-dom/client'], supabase: ['@supabase/supabase-js'] } } } }, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '') }, plugins: [react(), tailwindcss(), localSecurityHeaders, localJobs, releaseMetadata] }
})
