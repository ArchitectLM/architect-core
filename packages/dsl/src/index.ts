/**
 * @architectlm/dsl
 * Domain-Specific Language for the ArchitectLM reactive system
 */

// Export models
export * from "./models.js";

// Export parser
export { parseDSLConfig } from "./parser.js";

// Export builder functions
export * from "./builder.js";

/**
 * Optimized DSL API for RAG LLM Agents and Vector Databases
 */

// Export core types
export * from './types.js';

// Export component registry
export { ComponentRegistry } from './component-registry.js';

// Export system loader
export { SystemLoader, LoadedSystem } from './system-loader.js';

// Export vector database adapters
export { 
  ChromaVectorDBAdapter, 
  ChromaVectorDBAdapterConfig 
} from './vector-db-adapter.js';

export { 
  MemoryVectorDBAdapter,
  MemoryVectorDBAdapterOptions
} from './memory-vector-db-adapter.js';

export {
  DefaultVectorDBAdapterFactory,
  vectorDBAdapterFactory
} from './vector-db-factory.js';

// Export component validation
export {
  ValidationResult,
  ComponentValidator,
  SchemaComponentValidator,
  CommandComponentValidator,
  ComponentValidatorFactory,
  componentValidatorFactory
} from './component-validation.js';

// Export compiler
export {
  DSLCompiler,
  dslCompiler,
  SchemaComponentTransformer,
  CommandComponentTransformer,
  ComponentTransformer,
  CompilationOptions,
  DEFAULT_COMPILATION_OPTIONS
} from './compiler.js';

// Export external system adapters (re-exported from extensions)
export {
  ExternalSystemAdapter,
  ExternalSystemAdapterConfig,
  ExternalSystemAdapterFactory,
  MemoryExternalSystemAdapter,
  MemoryExternalSystemAdapterOptions,
  externalSystemAdapterFactory
} from '@architectlm/extensions';

// Export system API
export { System, SystemAPI } from './system-api.js';

// Export event-driven component registry
export { 
  EventDrivenComponentRegistry, 
  DSLEventType as ComponentRegistryEventType 
} from './event-driven-component-registry.js';

// Export DSL extension system
export {
  DSLExtensionSystem,
  DSL_EXTENSION_POINTS,
  ValidationContext,
  CompilationContext,
  TransformationContext
} from './dsl-extension-system.js';

// Export DSL plugin system
export {
  DSLPluginSystem,
  DSLPlugin,
  createDSLPluginSystem
} from './dsl-plugin-system.js';

// Export event-driven DSL compiler
export {
  EventDrivenDSLCompiler,
  DSLEventType as CompilerEventType,
  EventDrivenDSLCompilerOptions
} from './event-driven-dsl-compiler.js';

// Export DSL plugins
export * from './plugins/index.js';
