import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { progressApiPlugin } from './vite-plugins/progressApi.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), progressApiPlugin()],
})
