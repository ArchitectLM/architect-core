import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/*.ts'],
      exclude: ['**/*.test.ts', '**/tests/**'],
    },
  },
  resolve: {
    // Allow direct imports from TypeScript files
    conditions: ['import', 'node', 'default'],
    extensions: ['.ts', '.js', '.json'],
  },
});
