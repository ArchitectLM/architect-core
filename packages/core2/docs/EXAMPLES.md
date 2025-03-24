# Plugin System Examples

This document provides practical examples of how to use the Core2 plugin system in real-world scenarios. Each example demonstrates common usage patterns and integration techniques.

## Table of Contents

- [Basic Plugin Usage](#basic-plugin-usage)
- [Validation Examples](#validation-examples)
- [Circuit Breaker Examples](#circuit-breaker-examples)
- [Resource Governance Examples](#resource-governance-examples)
- [Plugin Integration Examples](#plugin-integration-examples)
- [Custom Plugin Examples](#custom-plugin-examples)
- [Advanced Usage Patterns](#advanced-usage-patterns)

## Basic Plugin Usage

### Setting Up the Runtime with Plugins

```typescript
import { createRuntime } from '@nocode/core2';
import { createCircuitBreakerPlugin } from '@nocode/core2/plugins/circuit-breaker';
import { createValidationPlugin } from '@nocode/core2/plugins/validation';
import { createResourceGovernancePlugin } from '@nocode/core2/plugins/resource-governance';

// Create runtime
const runtime = createRuntime();

// Create plugins
const circuitBreaker = createCircuitBreakerPlugin({
  failureThreshold: 3,
  resetTimeout: 5000,
  halfOpenMaxAttempts: 2
});

const validation = createValidationPlugin();

const resourceGovernance = createResourceGovernancePlugin({
  defaultPolicy: 'Standard Resources',
  enableRuntimeThrottling: true,
  monitoringInterval: 1000
});

// Register plugins
runtime.extensionSystem.registerExtension(circuitBreaker);
runtime.extensionSystem.registerExtension(validation);
runtime.extensionSystem.registerExtension(resourceGovernance);

// Now the runtime is equipped with validation, circuit breaking, and resource governance
```

### Creating and Executing Tasks

```typescript
// Define a task
const calculationTask = {
  type: 'calculation-task',
  handler: async (input) => {
    const { a, b, operation } = input;
    let result;
    
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) throw new Error('Division by zero');
        result = a / b;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return { result, operation };
  },
  description: 'Performs mathematical calculations',
  version: '1.0.0'
};

// Register the task
runtime.taskRegistry.registerTask(calculationTask);

// Execute the task
async function performCalculation() {
  try {
    const result = await runtime.taskExecutor.executeTask('calculation-task', {
      a: 10,
      b: 5,
      operation: 'multiply'
    });
    
    console.log('Calculation result:', result.value.result);
    // Output: Calculation result: { result: 50, operation: 'multiply' }
  } catch (error) {
    console.error('Calculation failed:', error);
  }
}

performCalculation();
```

## Validation Examples

### Setting Up JSON Schema Validation

```typescript
import { createValidationPlugin } from '@nocode/core2/plugins/validation';

// Create validation plugin
const validation = createValidationPlugin();

// Register with runtime
runtime.extensionSystem.registerExtension(validation);

// Define validation schema for calculation task
const calculationSchema = {
  type: 'object',
  required: ['a', 'b', 'operation'],
  properties: {
    a: { type: 'number' },
    b: { type: 'number' },
    operation: {
      type: 'string',
      enum: ['add', 'subtract', 'multiply', 'divide']
    }
  }
};

// Apply validation to the task
validation.setTaskValidation('calculation-task', {
  schema: calculationSchema,
  mode: 'strict' // 'strict' will throw errors, 'warn' will only log warnings
});

// Now any task execution will be validated against this schema
async function testValidation() {
  try {
    // This will pass validation
    const validResult = await runtime.taskExecutor.executeTask('calculation-task', {
      a: 10,
      b: 5,
      operation: 'add'
    });
    console.log('Valid result:', validResult.value.result);
    
    // This will fail validation (missing operation)
    const invalidResult = await runtime.taskExecutor.executeTask('calculation-task', {
      a: 10,
      b: 5
    });
  } catch (error) {
    console.error('Validation error:', error.message);
    // Output: Validation error: Task validation failed: Missing required property 'operation'
  }
}

testValidation();
```

### Custom Validator Function

```typescript
// Create a custom validator function
function validateDataProcessingInput(input) {
  const { data, batchSize } = input;
  
  const errors = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
  } else if (data.length === 0) {
    errors.push('Data array cannot be empty');
  }
  
  if (typeof batchSize !== 'number') {
    errors.push('Batch size must be a number');
  } else if (batchSize < 1) {
    errors.push('Batch size must be at least 1');
  } else if (batchSize > 100) {
    errors.push('Batch size must not exceed 100');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Apply custom validator
validation.setTaskValidation('data-processing-task', {
  customValidator: validateDataProcessingInput,
  mode: 'strict'
});
```

## Circuit Breaker Examples

### Basic Circuit Breaker Configuration

```typescript
import { createCircuitBreakerPlugin } from '@nocode/core2/plugins/circuit-breaker';

// Create circuit breaker plugin with configuration
const circuitBreaker = createCircuitBreakerPlugin({
  failureThreshold: 3,      // Open after 3 consecutive failures
  resetTimeout: 10000,      // Wait 10 seconds before half-open
  halfOpenMaxAttempts: 2    // Allow 2 test requests in half-open state
});

// Register with runtime
runtime.extensionSystem.registerExtension(circuitBreaker);

// Task that might fail
const unreliableServiceTask = {
  type: 'unreliable-service-task',
  handler: async (input) => {
    // Simulate an unreliable external service
    const response = await fetch('https://external-service.example.com/api');
    if (!response.ok) {
      throw new Error(`Service returned ${response.status}`);
    }
    return await response.json();
  }
};

// Register the task
runtime.taskRegistry.registerTask(unreliableServiceTask);

// Function to test circuit breaker
async function testCircuitBreaker() {
  // Simulate multiple calls to an unreliable service
  for (let i = 0; i < 10; i++) {
    try {
      const result = await runtime.taskExecutor.executeTask('unreliable-service-task', {});
      console.log(`Call ${i + 1} succeeded:`, result.value);
    } catch (error) {
      console.error(`Call ${i + 1} failed:`, error.message);
      
      // Check circuit state after error
      const state = circuitBreaker.getCircuitState('unreliable-service-task');
      console.log(`Circuit state: ${state}`);
      
      // If circuit is open, wait before continuing
      if (state === 'OPEN') {
        console.log('Circuit is open, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 11000)); // Wait longer than resetTimeout
      }
    }
  }
  
  // Get analytics for the circuit
  const analytics = circuitBreaker.getCircuitAnalytics('unreliable-service-task');
  console.log('Circuit analytics:', analytics);
}

testCircuitBreaker();
```

### Manual Circuit Control

```typescript
// Examples of manual circuit control

// Reset a specific circuit
function resetServiceCircuit() {
  circuitBreaker.resetCircuit('unreliable-service-task');
  console.log('Circuit reset, current state:', 
    circuitBreaker.getCircuitState('unreliable-service-task'));
}

// Reset all circuits
function resetAllCircuits() {
  circuitBreaker.resetAllCircuits();
  console.log('All circuits reset');
}

// Force a circuit open (e.g., when you know a service is down)
function forceCircuitOpen() {
  // We can do this by artificially incrementing the failure count
  for (let i = 0; i < circuitBreaker.config.failureThreshold; i++) {
    circuitBreaker.incrementFailureCount('unreliable-service-task');
  }
  
  console.log('Circuit forced open, current state:',
    circuitBreaker.getCircuitState('unreliable-service-task'));
}
```

## Resource Governance Examples

### Setting Resource Policies

```typescript
import { createResourceGovernancePlugin, ResourceType } from '@nocode/core2/plugins/resource-governance';

// Create the resource governance plugin
const resourceGovernance = createResourceGovernancePlugin({
  defaultPolicy: 'Standard Resources',
  enableRuntimeThrottling: true,
  monitoringInterval: 1000
});

// Register with runtime
runtime.extensionSystem.registerExtension(resourceGovernance);

// Define resource policies
resourceGovernance.definePolicy('Low Resources', {
  [ResourceType.CPU]: { limit: 30, priority: 'low' },
  [ResourceType.MEMORY]: { limit: 50, priority: 'low' },
  [ResourceType.CONCURRENCY]: { limit: 2 }
});

resourceGovernance.definePolicy('Standard Resources', {
  [ResourceType.CPU]: { limit: 60, priority: 'normal' },
  [ResourceType.MEMORY]: { limit: 200, priority: 'normal' },
  [ResourceType.CONCURRENCY]: { limit: 5 }
});

resourceGovernance.definePolicy('High Resources', {
  [ResourceType.CPU]: { limit: 80, priority: 'high' },
  [ResourceType.MEMORY]: { limit: 500, priority: 'high' },
  [ResourceType.CONCURRENCY]: { limit: 10 }
});

// Apply a policy (this is applied to the runtime, not just a specific task)
resourceGovernance.applyPolicy('Standard Resources');

// Set task-specific timeouts
resourceGovernance.setTaskTimeout('long-running-task', 30000); // 30 seconds
resourceGovernance.setTaskTimeout('quick-task', 5000); // 5 seconds
```

### Monitoring Resource Usage

```typescript
// Get current resource metrics
function monitorResources() {
  const metrics = resourceGovernance.getResourceMetrics();
  
  console.log('CPU Usage:', metrics.cpu.current, '% (Peak:', metrics.cpu.peak, '%)');
  console.log('Memory Usage:', metrics.memory.current, 'MB (Peak:', metrics.memory.peak, 'MB)');
  console.log('Concurrency:', metrics.concurrency.current, 'of', metrics.concurrency.limit);
  
  // Set up periodic monitoring
  setInterval(() => {
    const updatedMetrics = resourceGovernance.getResourceMetrics();
    console.log('Updated metrics:', updatedMetrics);
  }, 5000);
}

monitorResources();
```

## Plugin Integration Examples

### Validation with Circuit Breaker

```typescript
// This example demonstrates how validation and circuit breaker can work together

// Set up validation
const validationPlugin = createValidationPlugin();
runtime.extensionSystem.registerExtension(validationPlugin);

validationPlugin.setTaskValidation('api-task', {
  schema: {
    type: 'object',
    required: ['url', 'method'],
    properties: {
      url: { type: 'string', format: 'uri' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
      headers: { type: 'object' },
      body: { type: 'object' }
    }
  },
  mode: 'strict'
});

// Set up circuit breaker
const circuitBreakerPlugin = createCircuitBreakerPlugin({
  failureThreshold: 3,
  resetTimeout: 10000
});
runtime.extensionSystem.registerExtension(circuitBreakerPlugin);

// Define API task
const apiTask = {
  type: 'api-task',
  handler: async (input) => {
    const { url, method, headers, body } = input;
    
    const options = {
      method,
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined
    };
    
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    return await response.json();
  }
};

runtime.taskRegistry.registerTask(apiTask);

// Execute task with both plugins active
async function callAPI() {
  try {
    // This will first validate the input,
    // then check if the circuit is closed before executing
    const result = await runtime.taskExecutor.executeTask('api-task', {
      url: 'https://api.example.com/data',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      }
    });
    
    console.log('API result:', result.value);
  } catch (error) {
    if (error.message.includes('validation failed')) {
      console.error('Validation error:', error.message);
    } else if (error.message.includes('circuit is open')) {
      console.error('Circuit is open, service might be down');
    } else {
      console.error('API error:', error.message);
      
      // Check circuit state after error
      const state = circuitBreakerPlugin.getCircuitState('api-task');
      console.log('Circuit state after error:', state);
    }
  }
}

// Call multiple times to test circuit breaker
async function testAPIResilience() {
  for (let i = 0; i < 5; i++) {
    console.log(`API call attempt ${i + 1}`);
    await callAPI();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testAPIResilience();
```

### Full Integration Example

```typescript
// This example shows all three core plugins working together
// to create a resilient, validated, resource-managed workflow

async function processDataWorkflow(data, batchSize) {
  try {
    // Step 1: Validate input
    // (Handled automatically by validation plugin)
    
    // Step 2: Apply resource governance policy based on data size
    if (data.length > 1000) {
      resourceGovernancePlugin.applyPolicy('High Resources');
    } else if (data.length > 100) {
      resourceGovernancePlugin.applyPolicy('Standard Resources');
    } else {
      resourceGovernancePlugin.applyPolicy('Low Resources');
    }
    
    // Step 3: Execute data processing task
    // (Circuit breaker will prevent execution if the service is failing)
    const processingResult = await runtime.taskExecutor.executeTask('processing-task', {
      data,
      batchSize
    });
    
    // Step 4: Execute API task to send results
    // (Circuit breaker manages each task independently)
    const apiResult = await runtime.taskExecutor.executeTask('api-task', {
      url: 'https://api.example.com/results',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        results: processingResult.value.result,
        timestamp: Date.now()
      }
    });
    
    return {
      success: true,
      processingResult: processingResult.value.result,
      apiResult: apiResult.value
    };
  } catch (error) {
    console.error('Workflow error:', error.message);
    
    // Get analytics for debugging
    const processingCircuitState = circuitBreakerPlugin.getCircuitState('processing-task');
    const apiCircuitState = circuitBreakerPlugin.getCircuitState('api-task');
    const resourceMetrics = resourceGovernancePlugin.getResourceMetrics();
    
    return {
      success: false,
      error: error.message,
      diagnostics: {
        processingCircuitState,
        apiCircuitState,
        resourceMetrics
      }
    };
  }
}

// Execute the workflow
async function runWorkflow() {
  const testData = Array.from({ length: 500 }, (_, i) => ({
    id: i,
    value: `test-${i}`
  }));
  
  const result = await processDataWorkflow(testData, 50);
  console.log('Workflow result:', result);
}

runWorkflow();
```

## Custom Plugin Examples

### Logging Plugin

```typescript
import { Extension, ExtensionPointNames } from '@nocode/core2/models/extension-system';

// Create a custom logging plugin
class LoggingPlugin implements Extension {
  id = 'logging-plugin';
  name = 'Logging Plugin';
  description = 'Logs task execution events';
  dependencies: string[] = [];
  
  private logStore: Array<{
    timestamp: number;
    event: string;
    taskType: string;
    data: any;
  }> = [];
  
  getHooks() {
    return [
      {
        pointName: ExtensionPointNames.TASK_BEFORE_EXECUTE,
        hook: async (params) => this.beforeTaskExecution(params),
        priority: 100 // High priority to ensure it runs first
      },
      {
        pointName: ExtensionPointNames.TASK_AFTER_EXECUTE,
        hook: async (params) => this.afterTaskExecution(params),
        priority: 1 // Low priority to ensure it runs last
      },
      {
        pointName: ExtensionPointNames.TASK_ON_ERROR,
        hook: async (params) => this.onTaskError(params),
        priority: 1 // Low priority to ensure it runs last
      }
    ];
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getCapabilities() {
    return ['logging'];
  }
  
  // Implement hook methods
  async beforeTaskExecution(params: any) {
    const { taskType, input } = params;
    this.log('TASK_START', taskType, { input });
    return { success: true, value: params };
  }
  
  async afterTaskExecution(params: any) {
    const { taskType, result } = params;
    this.log('TASK_COMPLETE', taskType, { result });
    return { success: true, value: params };
  }
  
  async onTaskError(params: any) {
    const { taskType, error } = params;
    this.log('TASK_ERROR', taskType, { error: error.message });
    return { success: true, value: params };
  }
  
  // Custom plugin methods
  private log(event: string, taskType: string, data: any) {
    const logEntry = {
      timestamp: Date.now(),
      event,
      taskType,
      data
    };
    
    this.logStore.push(logEntry);
    console.log(`[${new Date(logEntry.timestamp).toISOString()}] ${event} - ${taskType}`, data);
  }
  
  // Public methods for the plugin
  getLogs(taskType?: string) {
    if (taskType) {
      return this.logStore.filter(log => log.taskType === taskType);
    }
    return this.logStore;
  }
  
  clearLogs() {
    this.logStore = [];
  }
}

// Factory function
export function createLoggingPlugin() {
  return new LoggingPlugin();
}

// Usage example
const loggingPlugin = createLoggingPlugin();
runtime.extensionSystem.registerExtension(loggingPlugin);

// Retrieve logs after task execution
async function executeAndGetLogs() {
  await runtime.taskExecutor.executeTask('calculation-task', { 
    a: 5, 
    b: 10, 
    operation: 'add' 
  });
  
  const logs = loggingPlugin.getLogs('calculation-task');
  console.log('Task logs:', logs);
}

executeAndGetLogs();
```

### Metrics Plugin

```typescript
// Create a custom metrics plugin
class MetricsPlugin implements Extension {
  id = 'metrics-plugin';
  name = 'Metrics Plugin';
  description = 'Collects performance metrics for tasks';
  dependencies: string[] = [];
  
  private metrics: Record<string, {
    executions: number;
    failures: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    lastExecuted: number;
  }> = {};
  
  private taskStartTimes: Record<string, number> = {};
  
  getHooks() {
    return [
      {
        pointName: ExtensionPointNames.TASK_BEFORE_EXECUTE,
        hook: async (params) => this.beforeTaskExecution(params),
        priority: 90
      },
      {
        pointName: ExtensionPointNames.TASK_AFTER_EXECUTE,
        hook: async (params) => this.afterTaskExecution(params),
        priority: 10
      },
      {
        pointName: ExtensionPointNames.TASK_ON_ERROR,
        hook: async (params) => this.onTaskError(params),
        priority: 10
      }
    ];
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getCapabilities() {
    return ['metrics'];
  }
  
  // Implement hook methods
  async beforeTaskExecution(params: any) {
    const { taskType } = params;
    const taskId = `${taskType}-${Date.now()}`;
    this.taskStartTimes[taskId] = performance.now();
    params.metricsTaskId = taskId; // Store ID for later hooks
    return { success: true, value: params };
  }
  
  async afterTaskExecution(params: any) {
    const { taskType, metricsTaskId } = params;
    if (metricsTaskId && this.taskStartTimes[metricsTaskId]) {
      const duration = performance.now() - this.taskStartTimes[metricsTaskId];
      this.recordMetrics(taskType, duration, true);
      delete this.taskStartTimes[metricsTaskId];
    }
    return { success: true, value: params };
  }
  
  async onTaskError(params: any) {
    const { taskType, metricsTaskId } = params;
    if (metricsTaskId && this.taskStartTimes[metricsTaskId]) {
      const duration = performance.now() - this.taskStartTimes[metricsTaskId];
      this.recordMetrics(taskType, duration, false);
      delete this.taskStartTimes[metricsTaskId];
    }
    return { success: true, value: params };
  }
  
  // Custom plugin methods
  private recordMetrics(taskType: string, duration: number, success: boolean) {
    if (!this.metrics[taskType]) {
      this.metrics[taskType] = {
        executions: 0,
        failures: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastExecuted: Date.now()
      };
    }
    
    const metric = this.metrics[taskType];
    metric.executions++;
    if (!success) {
      metric.failures++;
    }
    
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.executions;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.lastExecuted = Date.now();
  }
  
  // Public methods
  getTaskMetrics(taskType?: string) {
    if (taskType) {
      return this.metrics[taskType] || null;
    }
    return this.metrics;
  }
  
  resetMetrics(taskType?: string) {
    if (taskType) {
      delete this.metrics[taskType];
    } else {
      this.metrics = {};
    }
  }
}

// Factory function
export function createMetricsPlugin() {
  return new MetricsPlugin();
}

// Usage example
const metricsPlugin = createMetricsPlugin();
runtime.extensionSystem.registerExtension(metricsPlugin);

// Report metrics
async function executeAndReportMetrics() {
  // Execute several tasks
  for (let i = 0; i < 10; i++) {
    try {
      await runtime.taskExecutor.executeTask('calculation-task', {
        a: i,
        b: i * 2,
        operation: i % 2 === 0 ? 'add' : 'multiply'
      });
    } catch (error) {
      console.error('Task execution error:', error);
    }
  }
  
  // Get and display metrics
  const calcMetrics = metricsPlugin.getTaskMetrics('calculation-task');
  console.log('Calculation task metrics:');
  console.log(`Executions: ${calcMetrics.executions}`);
  console.log(`Success rate: ${((calcMetrics.executions - calcMetrics.failures) / calcMetrics.executions * 100).toFixed(2)}%`);
  console.log(`Avg duration: ${calcMetrics.avgDuration.toFixed(2)}ms`);
  console.log(`Min duration: ${calcMetrics.minDuration.toFixed(2)}ms`);
  console.log(`Max duration: ${calcMetrics.maxDuration.toFixed(2)}ms`);
}

executeAndReportMetrics();
```

## Advanced Usage Patterns

### Orchestrating Multiple Plugins

```typescript
// Set up a coordinated plugin system with multiple plugins

// Create and register plugins
const circuitBreaker = createCircuitBreakerPlugin({ failureThreshold: 3 });
const validation = createValidationPlugin();
const resourceGovernance = createResourceGovernancePlugin();
const logging = createLoggingPlugin();
const metrics = createMetricsPlugin();

// Register all plugins
[circuitBreaker, validation, resourceGovernance, logging, metrics]
  .forEach(plugin => runtime.extensionSystem.registerExtension(plugin));

// Plugin coordinator service
class PluginCoordinator {
  constructor(private runtime: Runtime) {}
  
  // Set up task with all plugins configured properly
  setupTask(taskDef, validationSchema, resourcePolicy, circuitConfig) {
    // Register task
    this.runtime.taskRegistry.registerTask(taskDef);
    
    // Set up validation
    validation.setTaskValidation(taskDef.type, {
      schema: validationSchema,
      mode: 'strict'
    });
    
    // Set up resource governance
    if (resourcePolicy) {
      resourceGovernance.setPolicy(
        `${taskDef.type}-policy`,
        resourcePolicy
      );
    }
    
    // Configure circuit breaker for this task
    if (circuitConfig) {
      // No direct configuration method, we modify behavior through plugin creation
      // or through hook parameters
    }
    
    return {
      execute: async (input) => {
        try {
          return await this.runtime.taskExecutor.executeTask(taskDef.type, input);
        } catch (error) {
          // Enhanced error reporting
          const circuitState = circuitBreaker.getCircuitState(taskDef.type);
          const taskMetrics = metrics.getTaskMetrics(taskDef.type);
          const taskLogs = logging.getLogs(taskDef.type);
          
          throw new Error(`Task execution failed: ${error.message}. Circuit state: ${circuitState}. Metrics: ${JSON.stringify(taskMetrics)}. Logs available.`);
        }
      },
      
      getStatus: () => {
        return {
          circuitState: circuitBreaker.getCircuitState(taskDef.type),
          metrics: metrics.getTaskMetrics(taskDef.type),
          resourceUsage: resourceGovernance.getResourceMetrics()
        };
      },
      
      resetCircuit: () => {
        circuitBreaker.resetCircuit(taskDef.type);
      }
    };
  }
  
  // Health check for all plugins
  getSystemHealth() {
    const taskTypes = this.runtime.taskRegistry.getTaskTypes();
    const health = {
      tasks: {},
      plugins: {
        circuitBreaker: true,
        validation: true,
        resourceGovernance: true,
        logging: true,
        metrics: true
      },
      resources: resourceGovernance.getResourceMetrics()
    };
    
    // Check circuit breaker for all tasks
    for (const taskType of taskTypes) {
      health.tasks[taskType] = {
        circuitState: circuitBreaker.getCircuitState(taskType),
        metrics: metrics.getTaskMetrics(taskType)
      };
    }
    
    return health;
  }
}

// Create coordinator
const coordinator = new PluginCoordinator(runtime);

// Set up a task with all plugins
const calculationService = coordinator.setupTask(
  calculationTask,
  calculationSchema,
  {
    cpu: { limit: 50 },
    memory: { limit: 100 },
    concurrency: { limit: 5 }
  },
  { failureThreshold: 5 }
);

// Use the coordinated service
async function useCoordinatedService() {
  // Execute task through coordinator
  const result = await calculationService.execute({
    a: 10,
    b: 5,
    operation: 'multiply'
  });
  
  console.log('Result:', result.value.result);
  
  // Get system health
  const health = coordinator.getSystemHealth();
  console.log('System health:', health);
  
  // Get specific task status
  const status = calculationService.getStatus();
  console.log('Calculation service status:', status);
}

useCoordinatedService();
```

### Reactive Patterns with Plugins

```typescript
// Implement reactive patterns using plugins and event system

// Create an event-driven workflow
async function reactiveWorkflow() {
  // Set up event subscriptions for task events
  runtime.eventBus.subscribe('task.completed', async (event) => {
    const { taskType, result } = event.payload;
    console.log(`Task ${taskType} completed with result:`, result);
    
    // Check circuit state reactively
    const circuitState = circuitBreaker.getCircuitState(taskType);
    if (circuitState !== 'CLOSED') {
      // Circuit was not closed, but task succeeded, so reset it
      circuitBreaker.resetCircuit(taskType);
      console.log(`Reset circuit for ${taskType} after successful execution`);
    }
    
    // Check if this task was part of a workflow and trigger next steps
    if (taskType === 'step-1') {
      // Trigger next workflow step
      await runtime.taskExecutor.executeTask('step-2', { 
        previousResult: result 
      });
    }
  });
  
  runtime.eventBus.subscribe('task.failed', async (event) => {
    const { taskType, error } = event.payload;
    console.log(`Task ${taskType} failed with error:`, error);
    
    // Check for resource issues
    const resources = resourceGovernance.getResourceMetrics();
    if (resources.cpu.current > 80 || resources.memory.current > 80) {
      console.log('Resource contention detected, applying lower resource policy');
      resourceGovernance.applyPolicy('Low Resources');
      
      // Wait for resources to stabilize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Retry the failed task
      console.log('Retrying task with lower resources');
      await runtime.taskExecutor.executeTask(taskType, event.payload.input);
    }
  });
  
  // Start the workflow
  await runtime.taskExecutor.executeTask('step-1', { 
    initialData: 'workflow-start'
  });
}

// Execute the reactive workflow
reactiveWorkflow().catch(error => {
  console.error('Workflow error:', error);
});
```

This document provides a range of examples from basic plugin usage to advanced integration patterns. By following these examples, you'll be able to leverage the full power of the Core2 plugin system to build resilient, well-validated, and resource-efficient applications. 