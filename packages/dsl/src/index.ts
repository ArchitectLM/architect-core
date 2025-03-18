/**
 * @architectlm/dsl
 * Domain-Specific Language for the ArchitectLM reactive system
 */

// Export models
export * from "./models.ts";

// Export parser
export { parseDSLConfig } from "./parser.ts";

// Export builder functions
export * from "./builder.ts";

/**
 * Optimized DSL API for RAG LLM Agents and Vector Databases
 */

// Export core types
export * from './types.ts';

// Export component registry
export { ComponentRegistry } from './component-registry.ts';

// Export system loader
export type { LoadedSystem } from './system-loader/types.ts';
export { SystemLoader } from './system-loader/system-loader.ts';

// Export vector database adapters
export type { ChromaVectorDBAdapterConfig } from './vector-db-adapter.ts';
export { ChromaVectorDBAdapter } from './vector-db-adapter.ts';

export type { MemoryVectorDBAdapterOptions } from './memory-vector-db-adapter.ts';
export { MemoryVectorDBAdapter } from './memory-vector-db-adapter.ts';

export {
  DefaultVectorDBAdapterFactory,
  vectorDBAdapterFactory
} from './vector-db-factory.ts';

// Export component validation
export type { 
  ValidationResult,
  ComponentValidator
} from './component-validation.ts';
export {
  SchemaComponentValidator,
  CommandComponentValidator,
  ComponentValidatorFactory,
  componentValidatorFactory
} from './component-validation.ts';

// Export compiler
export type { 
  CompilationOptions,
  ComponentTransformer
} from './compiler.ts';
export {
  DSLCompiler,
  dslCompiler,
  SchemaComponentTransformer,
  CommandComponentTransformer,
  DEFAULT_COMPILATION_OPTIONS
} from './compiler.ts';

// Export external system adapters (re-exported from extensions)
export type {
  ExternalSystemAdapter,
  ExternalSystemAdapterConfig,
  MemoryExternalSystemAdapterOptions
} from '@architectlm/extensions';
export {
  ExternalSystemAdapterFactory,
  MemoryExternalSystemAdapter,
  externalSystemAdapterFactory
} from '@architectlm/extensions';

// Export system API
export { System, SystemAPI } from './system-api.ts';

// Export event-driven component registry
export { 
  EventDrivenComponentRegistry, 
  DSLEventType as ComponentRegistryEventType 
} from './event-driven-component-registry.ts';

// Export DSL extension system
export type { 
  ValidationContext,
  CompilationContext,
  TransformationContext
} from './dsl-extension-system.ts';
export { 
  DSL_EXTENSION_POINTS,
  DSLExtensionSystem
} from './dsl-extension-system.ts';

// Export DSL plugin system
export type { DSLPlugin } from './dsl-plugin-system.ts';
export {
  DSLPluginSystem,
  createDSLPluginSystem
} from './dsl-plugin-system.ts';

// Export event-driven DSL compiler
export type { EventDrivenDSLCompilerOptions } from './event-driven-dsl-compiler.ts';
export {
  EventDrivenDSLCompiler,
  DSLEventType as CompilerEventType
} from './event-driven-dsl-compiler.ts';

// Export DSL plugins
export * from './plugins/index.ts';

// Export enhanced types
export * from './enhanced-types.ts';

// Export Zod validation
export * from './zod-validation.js';
