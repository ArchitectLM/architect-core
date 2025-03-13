/**
 * ArchitectLM - A reactive system framework
 */

// Export core types and functions
export * from './core';

// Export runtime
export * from './runtime';

// Export testing utilities
export * from './testing';

// Legacy API functions (for backward compatibility)
export { defineSystem } from './core/system';
export { defineProcess } from './core/process';
export { defineTask } from './core/task';
export { defineTest } from './testing/test';
export { createRuntime } from './runtime/runtime';

// New fluent API
export { Process, Task, System, Test } from './core/builders'; 