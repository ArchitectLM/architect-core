# Domain-Specific Language (DSL) Framework

This package provides a powerful and extensible framework for creating domain-specific languages (DSLs) that enable low-code/no-code development experiences.

## Architecture Overview

The DSL framework is built around a component-based architecture that allows for flexible composition and extension. The core architecture consists of:

### Core Components

- **Component Registry**: Central repository for all component definitions
- **System Loader**: Loads and manages system definitions and their components
- **DSL Compiler**: Compiles component definitions into executable code
- **Plugin System**: Provides extension points for customizing behavior
- **Event-Driven Architecture**: Enables reactive programming patterns

### Key Features

- **Component-Based Design**: Build systems from reusable components
- **Lazy Loading**: Load components on-demand for better performance
- **Caching**: Optimize performance with intelligent caching
- **Validation**: Validate components and systems at multiple levels
- **Extensibility**: Extend functionality through plugins and extensions
- **Vector Database Integration**: Store and search components semantically

## Component Types

The framework supports several component types:

- **Schema**: Define data structures and validation rules
- **Command**: Define executable operations
- **Event**: Define messages that can be published and subscribed to
- **Query**: Define data retrieval operations
- **Workflow**: Define multi-step processes

## Usage Examples

### Defining a Component

```typescript
import { ComponentType } from '@architectlm/dsl';

// Define a schema component
const userSchema = {
  type: ComponentType.SCHEMA,
  name: 'User',
  description: 'User schema',
  definition: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' }
    },
    required: ['id', 'name']
  }
};

// Define a command component
const createUserCommand = {
  type: ComponentType.COMMAND,
  name: 'CreateUser',
  description: 'Create a new user',
  input: { ref: 'User' },
  output: { ref: 'User' }
};
```

### Registering Components

```typescript
import { ComponentRegistry } from '@architectlm/dsl';

// Create a registry
const registry = new ComponentRegistry();

// Register components
registry.register(userSchema);
registry.register(createUserCommand);

// Find components by type
const schemas = registry.findComponents({ type: ComponentType.SCHEMA });
```

### Defining a System

```typescript
import { SystemDefinition } from '@architectlm/dsl';

// Define a system
const ecommerceSystem: SystemDefinition = {
  name: 'E-Commerce',
  description: 'E-commerce system',
  components: {
    schemas: [
      { ref: 'User', required: true },
      { ref: 'Product', required: true },
      { ref: 'Order', required: true }
    ],
    commands: [
      { ref: 'CreateUser', required: true },
      { ref: 'CreateProduct', required: true },
      { ref: 'PlaceOrder', required: true }
    ],
    events: [
      { ref: 'UserCreated' },
      { ref: 'ProductCreated' },
      { ref: 'OrderPlaced' }
    ]
  }
};
```

### Loading a System

```typescript
import { SystemLoader } from '@architectlm/dsl';

// Create a system loader
const loader = new SystemLoader(registry, {
  useLazyLoading: true,
  validateOnLoad: true
});

// Load the system
const system = loader.loadSystem(ecommerceSystem);

// Get a component from the system
const userComponent = await loader.getSystemComponent('E-Commerce', 'User');
```

### Using the DSL Compiler

```typescript
import { EventDrivenDSLCompiler } from '@architectlm/dsl';

// Create a compiler
const compiler = new EventDrivenDSLCompiler(registry);

// Compile a component
const compiledComponent = await compiler.compileComponent('User');

// Execute a command
const result = await compiler.executeCommand('CreateUser', {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Using Plugins

```typescript
import { schemaValidationPlugin } from '@architectlm/dsl';

// Create a compiler with plugins
const compiler = new EventDrivenDSLCompiler(registry, {
  plugins: [schemaValidationPlugin]
});
```

## Advanced Features

### Caching

The framework includes a sophisticated caching system that improves performance by caching compiled components and validation results.

```typescript
// Configure caching
const compiler = new EventDrivenDSLCompiler(registry, {
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxEntries: 1000
  }
});

// Get cache statistics
const stats = compiler.getCacheStats();
```

### Circular Dependency Detection

The system loader can detect circular dependencies between components:

```typescript
// Detect circular dependencies
const circularDeps = loader.detectCircularDependencies('Order');
```

### Vector Database Integration

Store and search components semantically using vector database integration:

```typescript
import { ChromaVectorDBAdapter, VectorDBFactory } from '@architectlm/dsl';

// Create a vector database adapter
const adapter = VectorDBFactory.createAdapter('chroma', {
  url: 'http://localhost:8000',
  collectionName: 'components'
});

// Store a component
await adapter.storeComponent(userSchema);

// Search for components
const results = await adapter.searchComponents('user schema');
```

## Extension Points

The framework provides several extension points:

### Plugins

Plugins can hook into various lifecycle events:

- `onComponentValidation`: Validate components
- `onComponentCompilation`: Modify compiled code
- `onSystemValidation`: Validate systems
- `onCommandExecution`: Intercept command execution

### Custom Component Types

You can define custom component types by extending the base types.

### Custom Loaders

You can create custom loaders for specific use cases.

## Error Handling

The framework provides comprehensive error handling:

- Validation errors
- Compilation errors
- Execution errors
- System loading errors

## Best Practices

- **Component Design**: Keep components small and focused
- **Dependency Management**: Avoid circular dependencies
- **Validation**: Validate components at design time
- **Testing**: Write tests for components and systems
- **Documentation**: Document component interfaces and behaviors

## API Reference

For detailed API documentation, see the [API Reference](./docs/api.md).

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
