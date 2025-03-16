/**
 * ArchitectLM - A reactive system framework
 */

// Export core types and functions
export * from './core';

// Legacy API functions (for backward compatibility)
export { defineSystem } from './core/system';
export { defineProcess } from './core/process';
export { defineTask } from './core/task';

// New fluent API
export { Process, Task, System, Test } from './core/builders'; 