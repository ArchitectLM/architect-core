# Reactive Core Architecture

## Overview

The Reactive Core is a lightweight, event-driven architecture that separates core functionality from implementation details using a plugin system. This approach provides several key benefits:

1. **Modularity**: Functionality is broken down into composable plugins
2. **Extensibility**: New capabilities can be added without modifying core code
3. **Testability**: Components can be tested in isolation
4. **Performance**: Lightweight core with optimized reactive processing
5. **Flexibility**: Optional plugins can be included or excluded based on requirements

## Architecture Principles

The architecture follows these core principles:

1. **Separation of Concerns**: The core runtime provides only essential infrastructure, while plugins implement specific functionality
2. **Event-Driven Communication**: Components communicate through events rather than direct method calls
3. **Dependency Injection**: Services are injected rather than created within components
4. **Reactive Programming**: Asynchronous processing with backpressure support
5. **Extension Points**: Well-defined extension points for customization

## Core Components

### Runtime

The runtime acts as a facade for all functionality, coordinating between plugins and providing a consistent API. It has been redesigned to be reactive and lightweight, delegating most logic to specialized plugins.

- **ReactiveRuntime**: A new implementation that delegates all functionality to plugins
- **Minimal Core**: Only manages plugin lifecycle and provides API routing

### EventBus

The event bus enables decoupled communication between components and serves as the central nervous system of the architecture.

- **Event Publishing/Subscription**: Components can publish and subscribe to events without direct coupling
- **Event Routing**: Events can be routed to different channels based on content
- **Backpressure Support**: Prevents system overload during high-volume processing

### Extension System

The extension system provides a way to extend core functionality without modifying the core itself.

- **Extension Points**: Well-defined points where custom logic can be inserted
- **Extension Registration**: Extensions can be registered at startup or dynamically
- **Extension Context**: Context is passed through the extension chain

## Plugins

The functionality previously embedded in the core implementations has been moved to dedicated plugins:

### Core Plugins

1. **ProcessManagementPlugin**
   - Manages process definitions and lifecycles
   - Handles process state transitions
   - Provides process versioning

2. **TaskManagementPlugin**
   - Manages task definitions and execution
   - Schedules and cancels tasks
   - Tracks task execution status

3. **EventPersistencePlugin**
   - Persists events to storage
   - Provides event replay capability
   - Correlates events by ID

4. **TransactionPlugin**
   - Manages transaction lifecycles
   - Provides commit/rollback operations
   - Tracks transaction contexts

5. **TaskDependenciesPlugin**
   - Manages dependencies between tasks
   - Ensures proper execution order
   - Detects circular dependencies

6. **RetryPlugin**
   - Automatically retries failed tasks
   - Supports different backoff strategies
   - Configurable retry policies

7. **ProcessRecoveryPlugin**
   - Enables checkpoint and restore of processes
   - Handles process versioning during recovery
   - Ensures data consistency during recovery

### Additional Plugins

1. **WorkflowOptimizationPlugin**
   - Analyzes and optimizes workflow execution
   - Identifies bottlenecks and redundant operations
   - Suggests performance improvements

2. **ResourceGovernancePlugin**
   - Manages resource allocation for tasks
   - Enforces resource limits
   - Prevents resource starvation

3. **ValidationPlugin**
   - Validates process and task definitions
   - Validates process transitions
   - Validates task inputs and outputs

4. **ObservabilityPlugin**
   - Provides metrics and monitoring
   - Generates trace information
   - Enables debug logging

5. **OutboxPatternPlugin**
   - Implements the outbox pattern for reliable messaging
   - Ensures at-least-once delivery of events
   - Manages idempotent event processing

6. **ContentBasedRoutingPlugin**
   - Routes events based on content
   - Applies transformations during routing
   - Defines routing rules declaratively

7. **EventSourcingPlugin**
   - Implements event sourcing pattern
   - Manages aggregates and their events
   - Provides event-based reconstruction of state

## Performance Considerations

The reactive core has been optimized for performance in several ways:

1. **Minimized Core**: The core runtime is now a thin facade that delegates to plugins
2. **Lazy Loading**: Plugins are initialized only when needed
3. **Asynchronous Processing**: Non-blocking operations throughout the system
4. **Backpressure Handling**: Prevents system overload during high-volume processing
5. **Optimized Plugin Interactions**: Minimized communication overhead between plugins

## Migrating to the Reactive Core

To migrate from the previous implementation to the reactive core:

1. Replace `RuntimeInstance` with `ReactiveRuntime` in your application
2. Initialize required plugins based on your needs
3. Adapt any direct usage of internal implementations to use the plugin APIs

```typescript
import { Runtime } from '../models/runtime.js';
import { createRuntime } from '../implementations/runtime.js';
import { ExtensionSystemImpl } from '../implementations/extension-system.js';
import { EventBusImpl } from '../implementations/event-bus.js';
import { InMemoryEventStorage } from '../implementations/event-storage.js';

// Initialize core services
const extensionSystem = new ExtensionSystemImpl();
const eventBus = new EventBusImpl();
const eventStorage = new InMemoryEventStorage();

// Create reactive runtime
const runtime = createRuntime(
  processDefinitions,
  taskDefinitions,
  {
    extensionSystem,
    eventBus,
    eventStorage
  }
);

// Use the runtime as before
const process = await runtime.createProcess('my-process', {});
```

## Extension through Plugins

To extend the system with custom functionality, create a plugin that implements the `Extension` interface:

```typescript
import { Extension } from '../models/extension.js';

const customPlugin: Extension = {
  name: 'custom-plugin',
  description: 'Custom plugin for specific functionality',
  hooks: {
    'process:beforeCreate': async (context) => {
      // Custom logic before process creation
      context.data = { ...context.data, customField: 'value' };
      return context;
    },
    'task:afterExecute': async (context) => {
      // Custom logic after task execution
      console.log(`Task ${context.taskId} completed with result:`, context.result);
      return context;
    }
  }
};

// Register with extension system
extensionSystem.registerExtension(customPlugin);
```

## Performance Testing

Performance tests have been added to measure:

1. **Plugin Execution Performance**: Baseline performance and impact of increasing plugins
2. **Plugin Interaction Performance**: Performance of complex plugin interactions
3. **Concurrency Performance**: Performance under concurrent operations
4. **Memory Performance**: Memory usage during extended operations

These tests provide insights into system behavior under various conditions and help identify potential bottlenecks.

## Conclusion

The reactive core architecture significantly improves the flexibility, maintainability, and performance of the system. By moving functionality from the core to plugins, it becomes easier to extend, test, and optimize individual components while maintaining a cohesive system. 