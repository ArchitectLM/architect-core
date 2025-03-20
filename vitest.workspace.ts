import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Define the DSL package configuration
  {
    test: {
      name: 'dsl',
      root: './packages/dsl',
      environment: 'node',
      include: ['**/*.test.ts'],
    }
  },
  // You can add other packages here as needed
]) 