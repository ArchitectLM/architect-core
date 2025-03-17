# @architectlm/dsl

Domain-Specific Language for the ArchitectLM reactive system.

## Overview

The DSL package provides a domain-specific language for defining components in the ArchitectLM reactive system. It includes:

- Component models for schemas, commands, events, and more
- Component validation and compilation
- Integration with vector databases and external systems
- Event-driven architecture for component management
- Extension system for customizing component processing
- Plugin system for adding new functionality

## Key Features

### Event-Driven Component Registry

The event-driven component registry provides a reactive way to manage components, emitting events when components are registered, updated, or removed.

```typescript
import { EventDrivenComponentRegistry, ReactiveEventBus } from '@architectlm/dsl';

const eventBus = new ReactiveEventBus();
const registry = new EventDrivenComponentRegistry(eventBus);

// Subscribe to component events
eventBus.subscribe('DSL_COMPONENT_REGISTERED', (event) => {
  console.log(`Component registered: ${event.payload.component.name}`);
});

// Register a component
registry.registerComponent({
  type: 'SCHEMA',
  name: 'User',
  description: 'User schema',
  definition: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' }
    }
  }
});
```

### DSL Extension System

The DSL extension system allows for extending the component processing pipeline with custom functionality.

```typescript
import { 
  DSLExtensionSystem, 
  createExtensionSystem, 
  DSL_EXTENSION_POINTS 
} from '@architectlm/dsl';

const extensionSystem = createExtensionSystem();
const dslExtensionSystem = new DSLExtensionSystem(extensionSystem);

// Initialize the extension system
dslExtensionSystem.initialize();

// Register an extension for component validation
extensionSystem.registerExtension({
  name: 'schema-validator',
  extensionPoint: DSL_EXTENSION_POINTS.VALIDATE_COMPONENT,
  execute: (context) => {
    // Custom validation logic
    if (context.component.type === 'SCHEMA') {
      // Validate schema component
      if (!context.component.definition.properties) {
        context.validationResult.isValid = false;
        context.validationResult.errors.push('Schema must have properties');
      }
    }
    return context;
  }
});
```

### DSL Plugin System

The DSL plugin system provides a way to add new functionality to the DSL through plugins.

```typescript
import { 
  DSLPluginSystem, 
  createDSLPluginSystem, 
  ComponentType 
} from '@architectlm/dsl';

const pluginSystem = createDSLPluginSystem();

// Register a plugin
pluginSystem.registerPlugin({
  name: 'schema-validation-plugin',
  version: '1.0.0',
  description: 'Provides enhanced validation for schema components',
  supportedComponentTypes: [ComponentType.SCHEMA],
  extensions: [],
  interceptors: [],
  onComponentValidation: (component, validationResult) => {
    // Custom validation logic
    return validationResult;
  }
});
```

### Event-Driven DSL Compiler

The event-driven DSL compiler provides a reactive way to compile components, emitting events during the compilation process.

```typescript
import { 
  EventDrivenDSLCompiler, 
  DSLExtensionSystem, 
  DSLPluginSystem, 
  ReactiveEventBus 
} from '@architectlm/dsl';

const eventBus = new ReactiveEventBus();
const extensionSystem = createExtensionSystem();
const dslExtensionSystem = new DSLExtensionSystem(extensionSystem);
const dslPluginSystem = createDSLPluginSystem();

const compiler = new EventDrivenDSLCompiler({
  eventBus,
  dslExtensionSystem,
  dslPluginSystem
});

// Register a component
await compiler.registerComponent({
  type: 'SCHEMA',
  name: 'User',
  description: 'User schema',
  definition: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' }
    }
  }
});

// Compile a component
const code = await compiler.compileComponent('User');
console.log(code);
```

## Installation

```bash
npm install @architectlm/dsl
```

## License

MIT
