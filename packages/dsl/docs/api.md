# API Reference

This document provides detailed information about the key classes, interfaces, and methods in the DSL framework.

## Table of Contents

- [Component Types](#component-types)
- [Component Registry](#component-registry)
- [System Loader](#system-loader)
- [DSL Compiler](#dsl-compiler)
- [Plugin System](#plugin-system)
- [Extension System](#extension-system)
- [Vector Database](#vector-database)
- [Caching](#caching)
- [Types](#types)

## Component Types

The framework defines several component types in the `ComponentType` enum:

```typescript
enum ComponentType {
  SCHEMA = 'SCHEMA',
  COMMAND = 'COMMAND',
  EVENT = 'EVENT',
  QUERY = 'QUERY',
  WORKFLOW = 'WORKFLOW',
  PLUGIN = 'PLUGIN',
  EXTENSION = 'EXTENSION'
}
```

## Component Registry

The component registry is responsible for storing and retrieving component definitions.

### `ComponentRegistry`

Base class for component registries.

```typescript
class ComponentRegistry {
  register(component: Component): void;
  getComponent(name: string): Component | undefined;
  findComponents(criteria: ComponentSearchCriteria): Component[];
  serialize(): string;
  deserialize(data: string): void;
}
```

### `EventDrivenComponentRegistry`

An event-driven implementation of the component registry.

```typescript
class EventDrivenComponentRegistry extends ComponentRegistry {
  constructor(eventBus: ReactiveEventBus);
  register(component: Component): void;
  getComponent(name: string): Component | undefined;
  findComponents(criteria: ComponentSearchCriteria): Component[];
}
```

## System Loader

The system loader is responsible for loading and managing system definitions and their components.

### `SystemLoader`

```typescript
class SystemLoader {
  constructor(registry: ComponentRegistry, options?: SystemLoaderOptions);
  loadSystem(systemDef: SystemDefinition): LoadedSystem;
  getSystem(name: string): LoadedSystem | undefined;
  getComponent(name: string): Promise<Component>;
  getSystemComponent(systemName: string, componentName: string): Promise<Component>;
  invalidateComponentCache(componentName: string): void;
  clearCache(): void;
  loadComponentFromPath(filePath: string): Promise<Component>;
  detectCircularDependencies(startComponentName: string): string[][];
}
```

### `SystemLoaderOptions`

```typescript
interface SystemLoaderOptions {
  useLazyLoading?: boolean;
  eventBus?: ReactiveEventBus;
  cacheOptions?: {
    ttl?: number;
    maxEntries?: number;
    slidingExpiration?: boolean;
  };
  criticalPathComponents?: Partial<Record<ComponentType, string[]>>;
  validateOnLoad?: boolean;
  preloadAllInBackground?: boolean;
}
```

### `LoadedSystem`

```typescript
interface LoadedSystem {
  name: string;
  description?: string;
  components: {
    schemas: ComponentRef[];
    commands: ComponentRef[];
    events: ComponentRef[];
    queries: ComponentRef[];
    workflows: ComponentRef[];
  };
  loadedComponents: Map<string, Component>;
  validationStatus: {
    isValid: boolean;
    errors: string[];
    lastValidated: Date;
  };
}
```

## DSL Compiler

The DSL compiler is responsible for compiling component definitions into executable code.

### `EventDrivenDSLCompiler`

```typescript
class EventDrivenDSLCompiler {
  constructor(
    registry: ComponentRegistry,
    options?: {
      eventBus?: ReactiveEventBus;
      plugins?: DSLPlugin[];
      cache?: {
        enabled?: boolean;
        ttl?: number;
        maxEntries?: number;
      };
    }
  );
  
  compileComponent(componentName: string): Promise<string>;
  executeCommand(commandName: string, input: any): Promise<any>;
  validateComponent(component: Component): Promise<ValidationResult<Component>>;
  registerPlugin(plugin: DSLPlugin): void;
  hasComponentInCache(componentName: string): boolean;
  invalidateCache(componentName: string): void;
  clearCache(): void;
  getCacheStats(): {
    hits: number;
    misses: number;
    size: number;
    components: string[];
  };
}
```

## Plugin System

The plugin system allows for extending the functionality of the DSL framework.

### `DSLPlugin`

```typescript
interface DSLPlugin {
  name: string;
  version: string;
  description: string;
  supportedComponentTypes: ComponentType[];
  hooks?: Record<string, Function>;
  onComponentValidation?: (
    component: BaseComponent,
    validationResult: { isValid: boolean; errors: string[] }
  ) => { isValid: boolean; errors: string[] } | Promise<{ isValid: boolean; errors: string[] }>;
  onComponentCompilation?: (
    component: BaseComponent,
    code: string
  ) => string | Promise<string>;
  onSystemValidation?: (
    system: SystemDefinition,
    validationResult: { isValid: boolean; errors: string[] }
  ) => { isValid: boolean; errors: string[] } | Promise<{ isValid: boolean; errors: string[] }>;
  onCommandExecution?: (
    command: CommandComponent,
    input: any,
    next: (input: any) => Promise<any>
  ) => Promise<any>;
}
```

### `DSLPluginSystem`

```typescript
class DSLPluginSystem {
  registerPlugin(plugin: DSLPlugin): void;
  getPlugin(name: string): DSLPlugin | undefined;
  getPluginsForComponentType(type: ComponentType): DSLPlugin[];
  validateComponent(
    component: Component,
    initialResult: ValidationResult<Component>
  ): Promise<ValidationResult<Component>>;
  compileComponent(
    component: Component,
    code: string
  ): Promise<string>;
  executeCommand(
    command: CommandComponent,
    input: any,
    next: (input: any) => Promise<any>
  ): Promise<any>;
}
```

## Extension System

The extension system provides a way to extend the behavior of the DSL framework.

### `DSLExtensionSystem`

```typescript
class DSLExtensionSystem {
  constructor(extensionSystem: ExtensionSystem);
  initialize(): void;
  validateComponent(
    component: Component,
    validationResult: ValidationResult<Component>
  ): Promise<ValidationResult<Component>>;
  compileComponent(
    component: Component,
    code: string
  ): Promise<string>;
  executeCommand(
    command: CommandComponent,
    input: any,
    next: (input: any) => Promise<any>
  ): Promise<any>;
}
```

### `ExtensionSystem`

```typescript
class ExtensionSystem {
  registerExtension(extension: Extension): void;
  getExtension(name: string): Extension | undefined;
  getExtensionsForPoint(extensionPoint: string): Extension[];
  executeExtensions(
    extensionPoint: string,
    context: any
  ): Promise<any>;
}
```

## Vector Database

The vector database integration allows for storing and searching components semantically.

### `VectorDBAdapter`

```typescript
interface VectorDBAdapter {
  storeComponent(component: Component): Promise<string>;
  storeImplementation(implementation: ComponentImplementation): Promise<string>;
  storeRelationship(
    fromComponent: string,
    toComponent: string,
    relationshipType: string,
    description?: string
  ): Promise<string>;
  searchComponents(
    query: string,
    filters?: Partial<Component>
  ): Promise<Component[]>;
  getRelatedComponents(
    componentName: string,
    relationshipType?: string
  ): Promise<Component[]>;
}
```

### `ChromaVectorDBAdapter`

```typescript
class ChromaVectorDBAdapter implements VectorDBAdapter {
  constructor(config: {
    url: string;
    collectionName: string;
    maxChunkSize?: number;
    chunkOverlap?: number;
  });
  
  storeComponent(component: Component): Promise<string>;
  storeImplementation(implementation: ComponentImplementation): Promise<string>;
  storeRelationship(
    fromComponent: string,
    toComponent: string,
    relationshipType: string,
    description?: string
  ): Promise<string>;
  searchComponents(
    query: string,
    filters?: Partial<Component>
  ): Promise<Component[]>;
  getRelatedComponents(
    componentName: string,
    relationshipType?: string
  ): Promise<Component[]>;
}
```

### `VectorDBFactory`

```typescript
class VectorDBFactory {
  static createAdapter(
    type: 'chroma' | 'pinecone' | 'custom',
    config: any
  ): VectorDBAdapter;
}
```

## Caching

The framework includes a sophisticated caching system for improved performance.

### `ComponentCache`

```typescript
class ComponentCache<T> {
  constructor(options?: {
    ttl?: number;
    maxEntries?: number;
    slidingExpiration?: boolean;
  });
  
  set(key: any, value: T): void;
  get(key: any): T | undefined;
  has(key: any): boolean;
  remove(key: any): void;
  clear(): void;
  getStats(): {
    hits: number;
    misses: number;
    size: number;
  };
}
```

## Types

### `Component`

```typescript
interface Component {
  type: ComponentType;
  name: string;
  description?: string;
  version?: string;
  tags?: string[];
  authors?: string[];
  relatedComponents?: ComponentRelationship[];
  [key: string]: any;
}
```

### `SchemaComponent`

```typescript
interface SchemaComponent extends Component {
  type: ComponentType.SCHEMA;
  definition: any;
  extends?: string;
}
```

### `CommandComponent`

```typescript
interface CommandComponent extends Component {
  type: ComponentType.COMMAND;
  input?: ComponentRef;
  output?: ComponentRef;
  plugins?: Record<string, PluginRef>;
}
```

### `EventComponent`

```typescript
interface EventComponent extends Component {
  type: ComponentType.EVENT;
  payload?: ComponentRef;
}
```

### `QueryComponent`

```typescript
interface QueryComponent extends Component {
  type: ComponentType.QUERY;
  input?: ComponentRef;
  output?: ComponentRef;
}
```

### `WorkflowComponent`

```typescript
interface WorkflowComponent extends Component {
  type: ComponentType.WORKFLOW;
  steps: WorkflowStep[];
}
```

### `ComponentRef`

```typescript
interface ComponentRef {
  ref: string;
  required?: boolean;
}
```

### `ComponentRelationship`

```typescript
interface ComponentRelationship {
  ref: string;
  relationship: string;
  description?: string;
}
```

### `SystemDefinition`

```typescript
interface SystemDefinition {
  name: string;
  description?: string;
  components: {
    schemas?: ComponentRef[];
    commands?: ComponentRef[];
    events?: ComponentRef[];
    queries?: ComponentRef[];
    workflows?: ComponentRef[];
  };
}
```

### `ValidationResult`

```typescript
interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  component?: T;
}
```

### `ComponentImplementation`

```typescript
interface ComponentImplementation {
  componentName: string;
  implementation: Function;
  metadata?: {
    complexity?: string;
    estimatedLatency?: string;
    sideEffects?: string[];
    testCases?: {
      description: string;
      input: any;
      expectedOutput: any;
    }[];
    [key: string]: any;
  };
}
``` 