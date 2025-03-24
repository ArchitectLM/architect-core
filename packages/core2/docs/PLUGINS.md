# Core Plugins System Documentation

## Overview

The Core Plugins System is a powerful extension mechanism that enhances the runtime with modular functionality. The system follows a flexible, typed, and resilient architecture that allows plugins to:

- Validate inputs and outputs
- Prevent cascading failures with circuit breakers
- Manage system resources
- Add custom functionality to the runtime

This document provides comprehensive information about the plugin architecture, implementation details, testing strategies, and integration patterns.

## Plugin Architecture

### Core Concepts

The plugin system is built around several key concepts:

1. **Extensions**: Plugins implement the `Extension` interface and register with the system's `ExtensionSystem`. 
2. **Extension Points**: Defined hooks where plugins can inject custom behavior.
3. **Runtime**: The central execution environment that hosts plugins and provides core services.
4. **Task System**: A task-based execution model that plugins can enhance or modify.

### Extension Interface

All plugins implement the `Extension` interface, which requires:

```typescript
interface Extension {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  getHooks(): Array<ExtensionHookRegistration>;
  getVersion(): string;
  getCapabilities(): string[];
}
```

Plugins register hooks to customize system behavior at specific extension points defined in `ExtensionPointNames`.

## Core Plugins

### 1. Circuit Breaker Plugin

The Circuit Breaker plugin implements the circuit breaker pattern to prevent cascading failures in the system.

#### States

- **CLOSED**: Normal operation, tasks execute as expected
- **OPEN**: Circuit is broken, tasks are rejected immediately
- **HALF_OPEN**: Testing state, allowing limited tasks to determine if the issue is resolved

#### Key Features

- Task-specific circuit isolation
- Configurable failure thresholds
- Timed automatic recovery attempts
- Manual circuit reset capabilities
- Detailed circuit analytics

#### Example Usage

```typescript
// Create the plugin
const circuitBreakerPlugin = createCircuitBreakerPlugin({
  failureThreshold: 3,
  resetTimeout: 5000,
  halfOpenMaxAttempts: 2
});

// Register with extension system
extensionSystem.registerExtension(circuitBreakerPlugin);

// Direct usage
const circuitState = circuitBreakerPlugin.getCircuitState('my-task');
if (circuitState === CircuitBreakerState.OPEN) {
  console.log('Circuit is open, task execution blocked');
}

// Reset a specific circuit
circuitBreakerPlugin.resetCircuit('my-task');

// Reset all circuits
circuitBreakerPlugin.resetAllCircuits();
```

### 2. Validation Plugin

The Validation plugin validates inputs before task execution and transitions in processes.

#### Key Features

- JSON Schema validation
- Custom validator functions
- Task input validation
- Process transition validation
- Strict or warning-only modes
- Validation rule management

#### Example Usage

```typescript
// Create the plugin
const validationPlugin = createValidationPlugin();

// Register with extension system
extensionSystem.registerExtension(validationPlugin);

// Set up validation for a task
validationPlugin.setTaskValidation('calculation-task', {
  schema: calculationSchema,
  mode: 'strict'
});

// Validate input manually
const result = validationPlugin.validateTaskInput('calculation-task', input);
if (!result.valid) {
  console.error('Validation failed:', result.errors);
}

// Clear validation for a task
validationPlugin.clearTaskValidation('calculation-task');
```

### 3. Resource Governance Plugin

The Resource Governance plugin manages system resources and enforces policies on resource usage.

#### Key Features

- Resource utilization monitoring (CPU, memory, network, etc.)
- Policy-based resource allocation
- Task prioritization
- Task timeouts
- Throttling strategies
- Resource reservation

#### Example Usage

```typescript
// Create the plugin
const resourceGovernancePlugin = createResourceGovernancePlugin({
  defaultPolicy: 'Standard Resources',
  enableRuntimeThrottling: true,
  monitoringInterval: 1000
});

// Register with extension system
extensionSystem.registerExtension(resourceGovernancePlugin);

// Apply a resource policy
resourceGovernancePlugin.applyPolicy('High CPU Policy');

// Set task timeout
resourceGovernancePlugin.setTaskTimeout('long-running-task', 30000);

// Get resource metrics
const metrics = resourceGovernancePlugin.getResourceMetrics();
console.log('CPU utilization:', metrics.cpu.current);
```

## Creating Custom Plugins

### Plugin Implementation Steps

1. **Implement the Extension Interface**

```typescript
import { Extension, ExtensionPointName, ExtensionPointNames } from '../models/extension-system';

export class MyCustomPlugin implements Extension {
  id = 'my-custom-plugin';
  name = 'My Custom Plugin';
  description = 'Provides custom functionality';
  dependencies: string[] = [];
  
  // Implement required methods
  getHooks() {
    return [
      {
        pointName: ExtensionPointNames.TASK_BEFORE_EXECUTE,
        hook: async (params, context) => this.beforeTaskExecution(params, context),
        priority: 10
      }
    ];
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getCapabilities() {
    return ['my-custom-capability'];
  }
  
  // Custom plugin method
  async beforeTaskExecution(params: any, context: any) {
    // Custom implementation
    return { success: true, value: params };
  }
}

// Factory function
export function createMyCustomPlugin(config?: any) {
  return new MyCustomPlugin();
}
```

2. **Register with Extension System**

```typescript
const customPlugin = createMyCustomPlugin();
extensionSystem.registerExtension(customPlugin);
```

### Best Practices

- **Isolated Functionality**: Each plugin should focus on one clear responsibility
- **Defensive Implementation**: Handle errors gracefully and avoid affecting other plugins
- **Typed Interfaces**: Use proper TypeScript types for parameters and return values
- **Clear Configuration**: Provide configuration options with sensible defaults
- **Comprehensive Testing**: Create tests for normal operation, edge cases, and failure scenarios

## Testing Plugins

### Unit Testing

Create unit tests for individual plugin functionality:

```typescript
describe('My Custom Plugin', () => {
  let plugin: MyCustomPlugin;
  
  beforeEach(() => {
    plugin = createMyCustomPlugin();
  });
  
  it('should implement required Extension interface', () => {
    expect(plugin.id).toBeDefined();
    expect(plugin.getHooks).toBeDefined();
    expect(plugin.getVersion).toBeDefined();
    expect(plugin.getCapabilities).toBeDefined();
  });
  
  it('should provide correct functionality', async () => {
    const result = await plugin.beforeTaskExecution({ taskType: 'test' }, { state: {} });
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing

Create integration tests that demonstrate plugins working together:

```typescript
describe('Plugin Integration', () => {
  let runtime: Runtime;
  let customPlugin: MyCustomPlugin;
  let validationPlugin: ValidationPlugin;
  
  beforeEach(() => {
    // Set up runtime and plugins
    runtime = createRuntime({...});
    customPlugin = createMyCustomPlugin();
    validationPlugin = createValidationPlugin();
    
    // Register plugins
    runtime.extensionSystem.registerExtension(customPlugin);
    runtime.extensionSystem.registerExtension(validationPlugin);
  });
  
  it('should work together with other plugins', async () => {
    // Test interaction between plugins
    // ...
  });
});
```

### Testing Strategy

We use the following testing approach:

1. **Unit Tests**: Test each plugin in isolation
2. **Integration Tests**: Test plugins working together
3. **Mocks & Stubs**: Mock dependencies for predictable testing
4. **Test-Driven Development**: Write tests before implementation for new features

### Testing Tools

- **Vitest**: Fast and feature-rich testing framework
- **Mock Timers**: For testing time-dependent functions like circuit breaker
- **Spy Functions**: To verify method calls and interactions

## Integration Example

The following example shows how to integrate multiple plugins to create a robust workflow:

```typescript
// Create plugins
const circuitBreakerPlugin = createCircuitBreakerPlugin({
  failureThreshold: 3,
  resetTimeout: 5000
});

const validationPlugin = createValidationPlugin();

const resourceGovernancePlugin = createResourceGovernancePlugin({
  defaultPolicy: 'Standard Resources'
});

// Create runtime
const runtime = createRuntime({
  components: {
    extensionSystem,
    eventBus
  }
});

// Register plugins
runtime.extensionSystem.registerExtension(circuitBreakerPlugin);
runtime.extensionSystem.registerExtension(validationPlugin);
runtime.extensionSystem.registerExtension(resourceGovernancePlugin);

// Set up validation
validationPlugin.setTaskValidation('calculation-task', {
  schema: calculationSchema,
  mode: 'strict'
});

// Execute tasks
const result = await runtime.taskExecutor.executeTask('calculation-task', {
  a: 5,
  b: 3,
  operation: 'add'
});
```

## Debugging and Troubleshooting

### Common Issues

1. **Plugin Registration Failures**
   - Check if the plugin implements all required Extension interface methods
   - Verify that the plugin ID is unique

2. **Hook Execution Errors**
   - Examine hook parameters to ensure they match expected types
   - Check for async/await usage in hook implementations

3. **Circuit Breaker Opens Unexpectedly**
   - Review failure threshold configuration
   - Check error handling in task implementations
   - Consider implementing retry logic

4. **Validation Failures**
   - Validate schemas against actual input structures
   - Check for required fields and correct data types

### Debugging Tools

- **Plugin Analytics**: Use `getCircuitAnalytics()`, `getValidationDetails()`, etc.
- **Runtime Inspection**: Examine the runtime state during execution
- **Logging**: Add detailed logging to track plugin lifecycle

## Advanced Topics

### Plugin Dependencies

Plugins can declare dependencies on other plugins:

```typescript
export class DependentPlugin implements Extension {
  id = 'dependent-plugin';
  dependencies = ['circuit-breaker', 'validation'];
  // ... other implementation
}
```

### Custom Extension Points

Define custom extension points for specific needs:

```typescript
// Define custom extension point
ExtensionPointNames.MY_CUSTOM_POINT = 'my:customPoint';

// Define parameters
interface ExtensionPointParameters {
  [ExtensionPointNames.MY_CUSTOM_POINT]: {
    customData: string;
    timestamp: number;
  };
}

// Register hook
plugin.registerHook(ExtensionPointNames.MY_CUSTOM_POINT, async (params, context) => {
  // Handle custom extension point
});
```

### Performance Considerations

- Consider hook execution order and priority
- Use efficient validation patterns
- Cache results when appropriate
- Monitor resource usage with the resource governance plugin

## Conclusion

The Core Plugins System provides a powerful and flexible way to extend the runtime with custom functionality. By following the patterns and practices described in this documentation, you can create robust, well-tested plugins that enhance the system's capabilities while maintaining reliability and performance.

For more specific information, refer to the individual plugin documentation or the API reference. 