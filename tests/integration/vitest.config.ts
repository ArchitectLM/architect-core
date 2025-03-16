import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts', '**/*.test.ts'],
    },
  },
});
