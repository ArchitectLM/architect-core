/**
 * @deprecated SCHEDULED FOR REMOVAL. Import from factory.ts instead.
 * This entire file will be removed in the next major version.
 * Migrate all imports to use `import { createRuntime, RuntimeFactoryOptions } from './factory';`
 */

// Re-export the createRuntime function with alias for backward compatibility
import { createRuntime, RuntimeFactoryOptions } from './factory';

/**
 * @deprecated SCHEDULED FOR REMOVAL. Use RuntimeFactoryOptions directly.
 * This type alias will be removed in the next major version.
 */
export type ModernRuntimeOptions = RuntimeFactoryOptions;

/**
 * @deprecated SCHEDULED FOR REMOVAL. Use createRuntime instead.
 * This function will be removed in the next major version.
 */
export const createModernRuntime = (options?: RuntimeFactoryOptions) => {
  console.warn(
    'WARNING: The modern-factory.ts file is deprecated and SCHEDULED FOR REMOVAL. ' +
    'Please import createRuntime from factory.ts instead immediately. ' +
    'This file will be removed in the next major version.'
  );
  
  return createRuntime(options);
}; 