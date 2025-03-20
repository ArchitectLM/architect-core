/**
 * @architectlm/dsl
 * 
 * Domain-Specific Language for the ArchitectLM reactive system
 */

// Core exports
import { DSL } from './core/dsl.js';
export { DSL } from './core/dsl.js';

// Model exports
export {
  ComponentType,
  ComponentDefinition,
  SchemaComponentDefinition,
  CommandComponentDefinition,
  QueryComponentDefinition,
  EventComponentDefinition,
  WorkflowComponentDefinition,
  SystemDefinition,
  WorkflowDefinition,
  ComponentImplementation
} from './models/component.js';

// Runtime integration exports
export { RuntimeAdapter } from './runtime/adapter.js';
export { createDefaultExtensionSystem } from './runtime/extension-system.js';
export { createDefaultEventBus } from './runtime/event-bus.js';

// Export a factory function for creating a DSL instance
export function createDSL(): DSL {
  return new DSL();
} 