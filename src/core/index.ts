/**
 * Core module exports
 */
// Export core types
export * from './types';

// Export event bus
export * from './event-bus';

// Export legacy API (for backward compatibility)
export * from './process';
export * from './task';
export * from './system';
export * from './runtime';

// Export extensions (with explicit re-export to avoid conflicts)
import * as ExtensionsModule from './extensions';
export { ExtensionsModule };

// Export new fluent API builders
export * from './builders';

// Export enhanced plugin system
export { 
  definePlugin, 
  Plugin, 
  PluginManager,
  PluginHooks,
  PluginService
} from './dsl/plugin';

// Export plugin-enabled runtime
export {
  PluginRuntime,
  createPluginRuntime,
  HookFunction
} from './plugin-runtime'; 