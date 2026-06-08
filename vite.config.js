import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  build: {
    // date-holidays includes the country rules dataset and is loaded only when requested.
    chunkSizeWarningLimit: 1500,
  },
})
