import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Base path is configurable so the same build works on a custom domain, on a
 * GitHub Pages project path, and from an IPFS gateway (`--base ./`).
 */
export default defineConfig({
  plugins: [react()],
  base: process.env.DEFI_DNA_BASE ?? '/',
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  server: { port: 5173, open: false },
})
