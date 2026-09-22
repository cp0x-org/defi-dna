import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['adapters/**/*.test.ts', 'apps/web/src/**/*.test.tsx'], environment: 'node' },
})
