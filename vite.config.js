import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {createAdminHandler} from './api/admin.js'
import {createPlatformHandler} from './api/platform.js'
import {createApplicationsHandler} from './api/applications.js'
import { createJobsHandler } from './api/jobs.js'
import { createPublishHandler } from './api/publish-job.js'

export default defineConfig(({ mode }) => {
  // These values remain inside Node; only VITE_ values are available to the browser.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const localJobs = {
    name: 'local-job-feed',
    configureServer(server) { server.middlewares.use('/api/admin',createAdminHandler(env));server.middlewares.use('/api/platform',createPlatformHandler(env));server.middlewares.use('/api/applications',createApplicationsHandler(env));server.middlewares.use('/api/jobs', createJobsHandler(env)); server.middlewares.use('/api/publish-job', createPublishHandler(env)) },
    configurePreviewServer(server) { server.middlewares.use('/api/admin',createAdminHandler(env));server.middlewares.use('/api/platform',createPlatformHandler(env));server.middlewares.use('/api/applications',createApplicationsHandler(env));server.middlewares.use('/api/jobs', createJobsHandler(env)); server.middlewares.use('/api/publish-job', createPublishHandler(env)) },
  }
  return { build: { rollupOptions: { output: { manualChunks: { react: ['react','react-dom/client'], supabase: ['@supabase/supabase-js'] } } } }, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || '') }, plugins: [react(), tailwindcss(), localJobs] }
})
