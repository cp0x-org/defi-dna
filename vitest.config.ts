import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'adapters/**/*.test.ts', 'apps/web/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
