/**
 * Runtime Core
 * 
 * This module exports all the runtime core functionality.
 */

// Export types
export * from './types';

// Export core modules
export { ReactiveSystemRuntime } from './lib/runtime';
export { 
  loadSystemFromDsl,
  migrateSystem,
  saveSystemToDsl,
  convertFlowToDsl,
  convertDslToFlow,
  generateTaskCode,
  generateFlowCode
} from './lib/dsl-integration';
export { CodeGenerator } from './lib/code-generation';

/**
 * Default runtime options
 */
export const DEFAULT_RUNTIME_OPTIONS = {
  taskExecutionOptions: {
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffFactor: 2,
    timeout: 30000
  },
  flowExecutionOptions: {
    continueOnError: false,
    maxParallelExecutions: 5
  },
  codeGenerationOptions: {
    language: 'typescript',
    includeComments: true,
    includeTests: true,
    includeErrorHandling: true
  }
}; 