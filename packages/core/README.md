# Core2 Package

## Overview

The Core2 package provides a robust, extensible runtime system with a plugin-based architecture designed for building scalable and resilient applications. At its heart is a powerful plugin system that allows developers to add, modify, and enhance functionality through modular extensions.

## Key Features

- **Plugin Architecture**: Extend functionality through a comprehensive plugin system
- **Task Execution**: Process tasks with validation, monitoring, and failure handling
- **Resource Management**: Control resource allocation and prevent overuse
- **Fault Tolerance**: Built-in circuit breaker pattern prevents cascading failures
- **Input Validation**: Schema-based validation ensures data integrity
- **Extensibility**: Create custom plugins to add specialized capabilities

## Core Plugins

### Circuit Breaker

Prevents cascading failures by detecting problematic services or tasks and temporarily cutting off execution when failure rates exceed thresholds.

```typescript
// Usage example
const circuitBreaker = createCircuitBreakerPlugin({
  failureThreshold: 3,
  resetTimeout: 5000
});
```

### Validation

Ensures inputs and outputs conform to specified schemas, preventing invalid data from entering the system.

```typescript
// Usage example
const validation = createValidationPlugin();
validation.setTaskValidation('calculation-task', {
  schema: calculationSchema,
  mode: 'strict'
});
```

### Resource Governance

Manages system resources by monitoring utilization and applying policies to prevent resource exhaustion.

```typescript
// Usage example
const resourceGovernance = createResourceGovernancePlugin({
  defaultPolicy: 'Standard Resources',
  enableRuntimeThrottling: true
});
```

## Getting Started

### Installation

```bash
# Navigate to the package directory
cd packages/core2

# Install dependencies
npm install
```

### Basic Usage

```typescript
import { createRuntime } from '@nocode/core2';
import { createCircuitBreakerPlugin } from '@nocode/core2/plugins/circuit-breaker';
import { createValidationPlugin } from '@nocode/core2/plugins/validation';

// Create runtime
const runtime = createRuntime();

// Create plugins
const circuitBreaker = createCircuitBreakerPlugin();
const validation = createValidationPlugin();

// Register plugins
runtime.extensionSystem.registerExtension(circuitBreaker);
runtime.extensionSystem.registerExtension(validation);

// Register a task
runtime.taskRegistry.registerTask({
  type: 'hello-world',
  handler: async (input) => {
    return { message: `Hello, ${input.name}!` };
  }
});

// Execute task
const result = await runtime.taskExecutor.executeTask('hello-world', { name: 'World' });
console.log(result.value.result.message); // "Hello, World!"
```

## Testing

The Core2 package includes comprehensive test suites for all components:

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/plugins/circuit-breaker.test.ts

# Run tests with coverage
npm test -- --coverage
```

### Test Types

- **Unit Tests**: Tests for individual components and plugins
- **Integration Tests**: Tests for interactions between multiple plugins
- **End-to-End Tests**: Tests for complete workflows through the runtime

### Test Utilities

The package provides several utilities to simplify testing:

- **Test Runtime**: `asTestRuntime()` helper provides access to internal runtime components
- **Mock Timers**: Vitest's timer mocking for testing time-dependent features
- **Spy Functions**: Mock implementations with vi.spyOn() to verify interactions

## Development Guide

### Creating a New Plugin

1. **Implement the Extension Interface**:

```typescript
import { Extension } from '../models/extension-system';

export class MyPlugin implements Extension {
  id = 'my-plugin';
  name = 'My Plugin';
  description = 'Provides custom functionality';
  dependencies: string[] = [];
  
  getHooks() {
    return [/* hook registrations */];
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getCapabilities() {
    return ['my-capability'];
  }
  
  // Custom plugin methods...
}

export function createMyPlugin(config?: any) {
  return new MyPlugin();
}
```

2. **Register Extension Points**:

```typescript
getHooks() {
  return [
    {
      pointName: ExtensionPointNames.TASK_BEFORE_EXECUTE,
      hook: async (params, context) => this.beforeTaskExecution(params, context),
      priority: 10
    }
  ];
}
```

3. **Test Your Plugin**:

```typescript
describe('My Plugin', () => {
  let plugin: MyPlugin;
  
  beforeEach(() => {
    plugin = createMyPlugin();
  });
  
  it('should implement required interface', () => {
    expect(plugin.id).toBeDefined();
    expect(plugin.getHooks()).toBeInstanceOf(Array);
  });
  
  it('should provide expected functionality', async () => {
    // Test implementation
  });
});
```

### Plugin Best Practices

- **Single Responsibility**: Each plugin should focus on one specific aspect of functionality
- **Error Handling**: Gracefully handle errors to prevent affecting other plugins
- **Configuration**: Provide sensible defaults but allow customization
- **Documentation**: Document plugin interfaces, configuration options, and examples
- **Testing**: Create comprehensive tests for normal, edge, and failure cases

## Integration Testing

The integration tests demonstrate how multiple plugins work together:

```typescript
// Example from core-plugins-integration.test.ts
describe('Core Plugins Integration', () => {
  // ...setup code...
  
  it('should handle a realistic workflow with multiple tasks', async () => {
    // Execute a workflow using multiple plugins
    const result = await executeWorkflow();
    
    // Verify parts of the workflow completed correctly
    expect(result.calculation.result).toBe(50);
    expect(result.processing.itemCount).toBe(50);
    
    // Verify that all plugins were involved
    expect(validateSpy).toHaveBeenCalled();
    expect(applyPolicySpy).toHaveBeenCalled();
    expect(circuitStateSpy).toHaveBeenCalled();
  });
});
```

## Debugging

### Troubleshooting Tips

1. **Plugin Registration Issues**:
   - Check if the plugin implements all required methods
   - Verify unique plugin IDs

2. **Task Execution Failures**:
   - Inspect validation results
   - Check circuit breaker state
   - Review resource availability

3. **Integration Issues**:
   - Verify plugin order/priority
   - Ensure dependencies are correctly declared
   - Check execution timing for async operations

### Debugging Plugins

```typescript
// Get circuit breaker analytics
const analytics = circuitBreakerPlugin.getCircuitAnalytics('my-task');
console.log('Circuit state:', analytics.state);
console.log('Failure count:', analytics.failureCount);

// Check validation details
const validationDetails = validationPlugin.getValidationDetails('my-task');
console.log('Has validation:', validationDetails.hasValidation);
console.log('Schema:', validationDetails.schema);

// Monitor resource usage
const resources = resourceGovernancePlugin.getResourceMetrics();
console.log('CPU usage:', resources.cpu.current);
console.log('Memory usage:', resources.memory.current);
```

## Documentation

For more detailed information, refer to:

- [Plugin System Documentation](./docs/PLUGINS.md)
- [API Reference](./docs/API.md)
- [Extension Point Reference](./docs/EXTENSION_POINTS.md)
- [Contributing Guide](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
