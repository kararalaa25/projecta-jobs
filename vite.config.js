import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createJobsHandler } from './api/jobs.js'

export default defineConfig(({ mode }) => {
  // These values remain inside Node; only VITE_ values are available to the browser.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const localJobs = {
    name: 'local-job-feed',
    configureServer(server) { server.middlewares.use('/api/jobs', createJobsHandler(env)) },
    configurePreviewServer(server) { server.middlewares.use('/api/jobs', createJobsHandler(env)) },
  }
  return { plugins: [react(), tailwindcss(), localJobs] }
})
