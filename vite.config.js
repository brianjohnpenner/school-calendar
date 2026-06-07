import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  base: process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}/` : '/',
  build: {
    // date-holidays includes the country rules dataset and is loaded only when requested.
    chunkSizeWarningLimit: 1500,
  },
})
