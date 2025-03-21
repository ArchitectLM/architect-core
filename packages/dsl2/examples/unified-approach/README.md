# Unified Component Approach Examples

This directory contains examples demonstrating the unified component approach to defining reactive systems using DSL2. The unified approach simplifies DSL usage by using a single `dsl.component()` method for all component types, with type differentiation through the `type` field.

## Key Benefits

1. **Simplified API**: One method to rule them all - `dsl.component()` handles all component types
2. **Attribute-Based Specialization**: Components are specialized through attributes rather than different methods
3. **Composition Over Inheritance**: Behaviors and implementations can be composed and reused
4. **Implementation-Declaration Separation**: Clear separation between component declarations and implementations
5. **Environment-Specific Configurations**: Systems can specify which implementations to use in different environments

## Examples

### Implementation Composability (`implementation-composability.ts`)

This example demonstrates:

- How to define base actor components with specific behaviors
- Creating implementation components that implement specific actors
- Composing implementations to reuse behavior implementations
- Extending implementations to override or enhance functionality
- Environment-specific system configurations
- Runtime creation based on environment selection

### CLI Runner (`implementation-composability-cli.ts`)

A simple command-line runner that executes the implementation composability example, showing:

- Runtime instantiation with different environment settings
- Execution of actor message handlers with their environment-specific implementations
- Logging output to demonstrate the composition of behaviors

## Running the Examples

To run the implementation composability example:

```bash
# Use ts-node to run the TypeScript file directly
npx ts-node examples/unified-approach/implementation-composability-cli.ts

# Or compile and run with Node.js
npm run build
node dist/examples/unified-approach/implementation-composability-cli.js
```

## Key Concepts

### Component Declaration vs. Implementation

- **Declaration**: Defines the interface, schema, and contract of a component
- **Implementation**: Provides the actual behavior and logic of a component

### Attribute-Based Specialization

Instead of having separate component types for specialized purposes, we use attributes to indicate special capabilities:

```typescript
// Message bus defined as a process with a messageBus attribute
dsl.component('ApplicationBus', {
  type: ComponentType.PROCESS,
  attributes: {
    messageBus: {
      enabled: true,
      messageTypes: [/* ... */],
      deliveryGuarantee: 'at-least-once'
    }
  },
  // ... other process properties
});
```

### Implementation Composition

Implementations can compose other implementations:

```typescript
dsl.component('UserServiceActorImpl', {
  type: ComponentType.IMPLEMENTATION,
  targetComponent: 'UserServiceActor',
  attributes: {
    composedImplementations: [
      { ref: 'ConsoleLoggerImpl' },
      { ref: 'InMemoryMetricsImpl' }
    ]
  },
  // ... handlers
});
```

### Environment-Specific Configurations

Systems can define which implementations to use in different environments:

```typescript
dsl.system('ProductionSystem', {
  attributes: {
    environment: 'production',
    implementations: {
      'LoggerActor': { ref: 'CloudLoggerImpl' },
      'UserActor': { ref: 'ProductionUserImpl' }
    }
  },
  // ... components
});
```

## Migration Path

If you're using the previous approach with specialized methods like `dsl.actor()`, `dsl.process()`, etc., you can migrate to the unified approach by:

1. Replace specialized methods with `dsl.component()` and specify the component type
2. Move specialized functionality to attributes
3. Use the same pattern for implementations
4. Consider environment-specific system configurations for deployment flexibility