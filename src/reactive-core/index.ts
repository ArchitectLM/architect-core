/**
 * Reactive Core
 * 
 * This module exports the reactive core system.
 */

// Export types
export * from './types';

// Export core modules
export { ReactiveSystemRuntime } from './lib/runtime';
export { ReactiveEventBus } from './lib/events';
export { ReactiveProcessEngine } from './lib/process';
export { ReactiveFlowEngine } from './lib/flow';

// Export default runtime options
export const DEFAULT_RUNTIME_OPTIONS = {
  debug: false
};