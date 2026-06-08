import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    // date-holidays includes the country rules dataset and is loaded only when requested.
    chunkSizeWarningLimit: 1500,
  },
})
