import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    watch: false,
    isolate: true,
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      threads: {
        singleThread: true
      },
      forks: {
        isolate: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [...configDefaults.coverage.exclude || [], '**/tests/**']
    }
  },
});
