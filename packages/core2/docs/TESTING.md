# Testing Plugins

This guide provides comprehensive information about testing plugins in the Core2 package, covering both unit and integration testing approaches, as well as advanced testing patterns and best practices.

## Table of Contents

- [Testing Fundamentals](#testing-fundamentals)
- [Testing Environment](#testing-environment)
- [Unit Testing Plugins](#unit-testing-plugins)
- [Integration Testing](#integration-testing)
- [Mocking Strategies](#mocking-strategies)
- [Testing with Time](#testing-with-time)
- [Error Handling Tests](#error-handling-tests)
- [Performance Testing](#performance-testing)
- [Test Patterns and Best Practices](#test-patterns-and-best-practices)
- [Debugging Tests](#debugging-tests)

## Testing Fundamentals

### Testing Philosophy

When testing plugins, the primary goals are to verify:

1. **Correctness**: Does the plugin function according to its specification?
2. **Resilience**: Does the plugin handle errors and edge cases properly?
3. **Integration**: Does the plugin work correctly with the runtime and other plugins?
4. **Performance**: Does the plugin perform its functions efficiently?

### Test Types

The Core2 package employs several types of tests:

- **Unit Tests**: Test individual methods and functions in isolation
- **Integration Tests**: Test interactions between components
- **Plugin Tests**: Test specific plugin functionality
- **System Tests**: Test the entire system with multiple plugins

## Testing Environment

### Testing Tools

The Core2 package uses the following testing tools:

- **Vitest**: Fast TypeScript-native testing framework
- **Test Runtime**: Helper utilities to access internal runtime components
- **Mock Utilities**: Functions for creating mock objects and spies

### Setting Up Test Environment

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRuntime } from '../../src/implementations/factory';
import { asTestRuntime } from '../helpers/test-runtime';

describe('Plugin Tests', () => {
  let runtime;
  let testRuntime;
  
  beforeEach(() => {
    // Set up fake timers
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    // Create runtime
    runtime = createRuntime();
    
    // Access internal runtime components
    testRuntime = asTestRuntime(runtime);
  });
  
  afterEach(() => {
    // Clean up
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  // Test cases go here...
});
```

## Unit Testing Plugins

### Testing Individual Methods

```typescript
import { createCircuitBreakerPlugin, CircuitBreakerState } from '../../src/plugins/circuit-breaker';

describe('CircuitBreakerPlugin', () => {
  let circuitBreakerPlugin;
  
  beforeEach(() => {
    circuitBreakerPlugin = createCircuitBreakerPlugin({
      failureThreshold: 3,
      resetTimeout: 100
    });
  });
  
  it('should implement required Extension interface', () => {
    expect(circuitBreakerPlugin.id).toBeDefined();
    expect(circuitBreakerPlugin.getHooks()).toBeInstanceOf(Array);
    expect(circuitBreakerPlugin.getVersion()).toBeDefined();
    expect(circuitBreakerPlugin.getCapabilities()).toBeInstanceOf(Array);
  });
  
  it('should initialize circuit state to CLOSED', () => {
    const state = circuitBreakerPlugin.getCircuitState('test-task');
    expect(state).toBe(CircuitBreakerState.CLOSED);
  });
  
  it('should open circuit after exceeding failure threshold', async () => {
    // Simulate failures
    await circuitBreakerPlugin.onTaskError({taskType: 'test-task'}, {});
    await circuitBreakerPlugin.onTaskError({taskType: 'test-task'}, {});
    await circuitBreakerPlugin.onTaskError({taskType: 'test-task'}, {});
    
    // Check circuit state
    const state = circuitBreakerPlugin.getCircuitState('test-task');
    expect(state).toBe(CircuitBreakerState.OPEN);
  });
});
```

### Testing Hook Registrations

```typescript
it('should register required hooks', () => {
  const hooks = circuitBreakerPlugin.getHooks();
  
  // Check that the plugin registers all required hooks
  const hookPointNames = hooks.map(h => h.pointName);
  expect(hookPointNames).toContain(ExtensionPointNames.TASK_BEFORE_EXECUTE);
  expect(hookPointNames).toContain(ExtensionPointNames.TASK_AFTER_EXECUTE);
  expect(hookPointNames).toContain(ExtensionPointNames.TASK_ON_ERROR);
});
```

## Integration Testing

### Testing Multiple Plugins Together

```typescript
describe('Core Plugins Integration', () => {
  let runtime;
  let circuitBreakerPlugin;
  let validationPlugin;
  let resourceGovernancePlugin;
  
  beforeEach(() => {
    // Create plugins
    circuitBreakerPlugin = createCircuitBreakerPlugin({...});
    validationPlugin = createValidationPlugin();
    resourceGovernancePlugin = createResourceGovernancePlugin({...});
    
    // Create runtime
    runtime = createRuntime({...});
    
    // Register plugins
    runtime.extensionSystem.registerExtension(circuitBreakerPlugin);
    runtime.extensionSystem.registerExtension(validationPlugin);
    runtime.extensionSystem.registerExtension(resourceGovernancePlugin);
  });
  
  it('should validate inputs before applying resource governance', async () => {
    // Create spies to track method calls
    const validateSpy = vi.spyOn(validationPlugin, 'validateTaskInput');
    const applyPolicySpy = vi.spyOn(resourceGovernancePlugin, 'applyPolicy');
    
    // Configure validation to fail
    validateSpy.mockReturnValueOnce({ valid: false, errors: ['Invalid input'] });
    
    // Try to execute task with invalid input
    await expect(runtime.taskExecutor.executeTask('test-task', {}))
      .rejects.toThrow(/validation failed/i);
    
    // Verify validation was called but resource governance wasn't
    expect(validateSpy).toHaveBeenCalled();
    expect(applyPolicySpy).not.toHaveBeenCalled();
  });
  
  it('should prevent task execution when circuit is open', async () => {
    // Configure circuit breaker to return OPEN state
    vi.spyOn(circuitBreakerPlugin, 'getCircuitState')
      .mockReturnValue(CircuitBreakerState.OPEN);
    
    // Try to execute task
    await expect(runtime.taskExecutor.executeTask('test-task', {}))
      .rejects.toThrow(/circuit is open/i);
  });
});
```

### Testing Plugin Interactions and Order

```typescript
it('should execute plugins in the correct order', async () => {
  const callOrder = [];
  
  // Mock plugin methods to track call order
  vi.spyOn(validationPlugin, 'validateTaskInput')
    .mockImplementation(() => {
      callOrder.push('validation');
      return { valid: true };
    });
    
  vi.spyOn(circuitBreakerPlugin, 'beforeTaskExecution')
    .mockImplementation(() => {
      callOrder.push('circuit-breaker');
      return { success: true, value: {} };
    });
    
  vi.spyOn(resourceGovernancePlugin, 'applyPolicy')
    .mockImplementation(() => {
      callOrder.push('resource-governance');
    });
  
  // Execute task
  await runtime.taskExecutor.executeTask('test-task', {});
  
  // Verify correct order
  expect(callOrder).toEqual(['validation', 'circuit-breaker', 'resource-governance']);
});
```

## Mocking Strategies

### Mocking Runtime Components

```typescript
// Mock task registry
testRuntime.taskRegistry = {
  registerTask: vi.fn(),
  unregisterTask: vi.fn(),
  getTask: vi.fn().mockImplementation((taskType) => {
    // Return mock tasks based on taskType
    const tasks = {
      'calculation-task': calculationTask,
      'processing-task': processingTask
    };
    return tasks[taskType];
  }),
  hasTask: vi.fn().mockReturnValue(true)
};

// Mock task executor
testRuntime.taskExecutor = {
  executeTask: vi.fn().mockImplementation(async (taskType, input) => {
    // Mock implementation
    return {
      success: true,
      value: {
        id: `task-${Date.now()}`,
        result: { processed: true }
      }
    };
  }),
  cancelTask: vi.fn()
};
```

### Mocking Event Bus

```typescript
// Mock event bus
const eventBus = {
  subscribe: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
  publishAll: vi.fn(),
  unsubscribe: vi.fn()
};

// Create runtime with mock event bus
const runtime = createRuntime({
  components: {
    eventBus
  }
});
```

### Mocking Extension System

```typescript
// Mock extension system
const extensionSystem = {
  registerExtension: vi.fn(),
  registerExtensionPoint: vi.fn(),
  executeExtensionPoint: vi.fn().mockImplementation(async (pointName, params) => {
    // Mock extension point execution
    return { 
      success: true, 
      results: [{ success: true, value: params }] 
    };
  }),
  getExtensions: vi.fn().mockReturnValue([])
};

// Create runtime with mock extension system
const runtime = createRuntime({
  components: {
    extensionSystem
  }
});
```

## Testing with Time

### Using Mock Timers

```typescript
describe('Circuit Breaker Time-Dependent Tests', () => {
  beforeEach(() => {
    // Use fake timers
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('should transition from OPEN to HALF_OPEN after resetTimeout', async () => {
    const circuitBreaker = createCircuitBreakerPlugin({
      failureThreshold: 3,
      resetTimeout: 5000
    });
    
    // Open the circuit
    circuitBreaker.incrementFailureCount('test-task', 3);
    expect(circuitBreaker.getCircuitState('test-task')).toBe(CircuitBreakerState.OPEN);
    
    // Advance time past the reset timeout
    vi.advanceTimersByTime(5500);
    
    // Circuit should now be HALF_OPEN
    expect(circuitBreaker.getCircuitState('test-task')).toBe(CircuitBreakerState.HALF_OPEN);
  });
});
```

### Testing Async Operations

```typescript
it('should handle async operations with timer mocking', async () => {
  // Create a mock async operation
  const asyncOperation = vi.fn().mockImplementation(() => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve('result');
      }, 1000);
    });
  });
  
  // Start the async operation
  const promise = asyncOperation();
  
  // Advance timers
  vi.advanceTimersByTime(1000);
  
  // Await the result
  const result = await promise;
  expect(result).toBe('result');
});
```

## Error Handling Tests

### Testing Error Propagation

```typescript
it('should propagate errors from plugins', async () => {
  // Make validation plugin throw an error
  vi.spyOn(validationPlugin, 'validateTaskInput').mockImplementation(() => {
    throw new Error('Validation error');
  });
  
  // Execute task should propagate the error
  await expect(runtime.taskExecutor.executeTask('test-task', {}))
    .rejects.toThrow('Validation error');
});
```

### Testing Recovery

```typescript
it('should recover from errors in task execution', async () => {
  let errorCount = 0;
  
  // Mock task that fails twice then succeeds
  const taskHandler = vi.fn().mockImplementation(async () => {
    if (errorCount < 2) {
      errorCount++;
      throw new Error('Task error');
    }
    return { status: 'success' };
  });
  
  // Register task
  testRuntime.taskRegistry.getTask.mockReturnValue({
    type: 'retry-task',
    handler: taskHandler
  });
  
  // Configure to retry 3 times
  const result = await runtime.taskExecutor.executeTask('retry-task', {}, {
    retry: { maxAttempts: 3 }
  });
  
  // Should succeed after retries
  expect(result.success).toBe(true);
  expect(taskHandler).toHaveBeenCalledTimes(3);
});
```

## Performance Testing

### Measuring Execution Time

```typescript
it('should execute tasks efficiently', async () => {
  const startTime = performance.now();
  
  // Execute a batch of tasks
  const tasks = [];
  for (let i = 0; i < 100; i++) {
    tasks.push(runtime.taskExecutor.executeTask('simple-task', { index: i }));
  }
  
  await Promise.all(tasks);
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  
  // Set a reasonable performance expectation
  expect(executionTime).toBeLessThan(500);
});
```

### Testing Resource Usage

```typescript
it('should limit resource usage according to policy', async () => {
  // Configure resource governance plugin
  resourceGovernancePlugin.setPolicy('limited-policy', {
    cpu: { limit: 50 },
    memory: { limit: 100 },
    concurrency: { limit: 5 }
  });
  
  // Apply the policy
  resourceGovernancePlugin.applyPolicy('limited-policy');
  
  // Execute tasks that will exceed concurrency limit
  const tasks = [];
  for (let i = 0; i < 10; i++) {
    tasks.push(runtime.taskExecutor.executeTask('resource-task', { index: i }));
  }
  
  // Some should be rejected due to concurrency limits
  const results = await Promise.allSettled(tasks);
  const rejected = results.filter(r => r.status === 'rejected');
  
  // We expect 5 to be rejected (10 tasks - 5 concurrency limit)
  expect(rejected.length).toBe(5);
});
```

## Test Patterns and Best Practices

### Arrange-Act-Assert Pattern

```typescript
it('should follow AAA pattern', async () => {
  // Arrange - set up the test conditions
  const input = { a: 5, b: 3, operation: 'add' };
  const expectedResult = { result: 8, operation: 'add' };
  
  // Act - perform the action being tested
  const result = await runtime.taskExecutor.executeTask('calculation-task', input);
  
  // Assert - verify the outcome
  expect(result.success).toBe(true);
  expect(result.value.result).toEqual(expectedResult);
});
```

### Testing Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should handle empty input', async () => {
    await expect(runtime.taskExecutor.executeTask('calculation-task', {}))
      .rejects.toThrow(/validation failed/i);
  });
  
  it('should handle division by zero', async () => {
    const input = { a: 5, b: 0, operation: 'divide' };
    await expect(runtime.taskExecutor.executeTask('calculation-task', input))
      .rejects.toThrow(/division by zero/i);
  });
  
  it('should handle maximum concurrency', async () => {
    // Set concurrency limit to 1
    resourceGovernancePlugin.setPolicy('test-policy', {
      concurrency: { limit: 1 }
    });
    resourceGovernancePlugin.applyPolicy('test-policy');
    
    // Execute two tasks concurrently
    const task1 = runtime.taskExecutor.executeTask('long-task', {});
    const task2 = runtime.taskExecutor.executeTask('long-task', {});
    
    // Second task should be rejected or queued
    await expect(Promise.all([task1, task2]))
      .rejects.toThrow(/concurrency limit exceeded/i);
  });
});
```

### Snapshot Testing

```typescript
it('should maintain consistent structure', () => {
  // Get analytics data
  const analytics = circuitBreakerPlugin.getCircuitAnalytics('test-task');
  
  // Compare with snapshot
  expect(analytics).toMatchSnapshot();
});
```

## Debugging Tests

### Troubleshooting Test Failures

Common issues and solutions:

1. **Async Timing Issues**
   - Use `vi.useFakeTimers()` to control time-dependent operations
   - Ensure promises are properly awaited
   - Use `Promise.resolve()` to create reliable async sequences

2. **Mock Implementation Problems**
   - Verify mock functions are called with expected parameters
   - Check that mocks return appropriate values for each test case
   - Restore mocks with `vi.restoreAllMocks()` between tests

3. **State Leakage Between Tests**
   - Reset plugin state in beforeEach/afterEach
   - Create new plugin instances for each test
   - Avoid shared mutable state

### Diagnostic Techniques

```typescript
// Add debug logging to a test
it('should execute with proper sequence', async () => {
  const callSequence = [];
  
  // Track method calls
  vi.spyOn(validationPlugin, 'validateTaskInput').mockImplementation(() => {
    callSequence.push('validate');
    console.log('Validation called with:', JSON.stringify(arguments));
    return { valid: true };
  });
  
  vi.spyOn(circuitBreakerPlugin, 'beforeTaskExecution').mockImplementation(() => {
    callSequence.push('circuit');
    console.log('Circuit breaker called');
    return { success: true, value: {} };
  });
  
  // Execute and log result
  const result = await runtime.taskExecutor.executeTask('test-task', {});
  console.log('Execution result:', JSON.stringify(result));
  
  // Log and assert
  console.log('Call sequence:', callSequence);
  expect(callSequence).toEqual(['validate', 'circuit']);
});
```

## Conclusion

Effective plugin testing requires a combination of unit tests for individual components and integration tests for plugin interactions. By using the patterns and techniques described in this guide, you can create comprehensive test suites that ensure your plugins work correctly in isolation and as part of the complete system.

Remember that good tests not only verify correctness but also serve as documentation of expected behavior. When writing tests, focus on clarity and maintainability to create a test suite that helps both current and future developers understand how the plugins should function. 