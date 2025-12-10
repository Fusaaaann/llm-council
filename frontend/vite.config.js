import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // Get API base URL (same logic as your source file)
  const apiBase = env.FRONTEND_BASE_URL || 'http://localhost:5173'
  
  // Extract hostname (always has a value due to fallback)
  const apiHost = new URL(apiBase).hostname

  return {
    server: {
      watch: {
        usePolling: true
      },
      allowedHosts: [apiHost]
    },
    plugins: [react()],
  }
})
