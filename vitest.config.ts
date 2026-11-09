import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: the app config loads TanStack Start/Nitro plugins that tests do not need.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
