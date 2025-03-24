# Core2 Runtime Architecture

## Overview

The Core2 Runtime is a modular, event-driven system designed to provide a flexible foundation for building process-driven applications. It implements several key architectural patterns:

- **Event-Driven Architecture**: Components communicate through events, allowing loose coupling
- **Process Management**: Stateful workflow management with transitions and checkpoints
- **Task Scheduling**: Time-based and immediate task execution
- **Extension System**: Plugin-based extensibility
- **Domain Events**: First-class support for domain events with persistence

## Core Components

### Runtime

The `Runtime` is the central coordination point that holds references to all subsystems. It provides:

- Lifecycle management (initialize, start, stop, reset)
- Health reporting
- Access to all subsystems

### Event System

The event system consists of three main components:

1. **EventBus**: Pub/sub mechanism for distributing events between components
2. **EventStorage**: Persists events for later retrieval and replay
3. **EventSource**: Replays stored events, used for recovery and rebuilding state

Events follow the `DomainEvent<T>` structure with:
- `id`: Unique identifier
- `type`: Event classification
- `timestamp`: When the event occurred
- `payload`: Event data
- `metadata`: Additional context information

### Process Management

Process management provides stateful workflow capabilities:

1. **ProcessRegistry**: Stores process definitions with allowed state transitions
2. **ProcessManager**: Creates and manages process instances, handles transitions

Process definitions include:
- States and allowed transitions
- Initial state
- Versioning information

Process instances track:
- Current state
- Process data
- History of transitions
- Checkpoints for restoration

### Task Management

Task management offers both immediate and scheduled execution:

1. **TaskRegistry**: Stores task definitions and handlers
2. **TaskExecutor**: Executes tasks immediately
3. **TaskScheduler**: Schedules tasks for future execution

Tasks can be:
- Executed immediately
- Scheduled for future execution
- Cancelled
- Rescheduled

### Extension System

The extension system provides plugin capabilities:

1. **ExtensionSystem**: Manages extension registration and execution
2. **Extension Points**: Pre-defined points where custom behavior can be added

Extensions can:
- Provide new capabilities
- Modify system behavior
- Integrate with external systems

### Plugin System

The plugin system builds on top of extensions to provide more structured extensibility:

1. **PluginRegistry**: Manages plugin registration and dependencies
2. **Plugin Lifecycle**: Initialization, activation, and deactivation hooks

Plugins can:
- Bundle multiple extensions
- Declare dependencies on other plugins
- Be activated and deactivated at runtime

## Implementation Details

### Modern Runtime Factory

The `createModernRuntime` factory creates and wires together all components:

```typescript
// Core services
const eventBus = new InMemoryEventBus();
const extensionSystem = new InMemoryExtensionSystem();
const taskRegistry = new InMemoryTaskRegistry();
const taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
const taskScheduler = new SimpleTaskScheduler(taskExecutor);
const processRegistry = new SimpleProcessRegistry();
const processManager = new SimpleProcessManager(processRegistry, taskExecutor);
const pluginRegistry = new SimplePluginRegistry();
```

### State Transitions

The runtime and its components follow a clear state model:

1. **Uninitialized**: Initial state
2. **Initializing**: During initialization
3. **Running**: Normal operation
4. **Stopping**: During graceful shutdown
5. **Stopped**: After shutdown
6. **Error**: When problems occur

## Testing Approach

### Integration Testing

Integration tests verify the real implementations work together correctly. Key testing patterns include:

1. **Polling for Async Operations**: Instead of fixed timeouts, use polling to make tests reliable:

```typescript
// Poll until condition is met or timeout
for (let attempt = 0; attempt < maxAttempts; attempt++) {
  if (condition) break;
  await new Promise(resolve => setTimeout(resolve, pollInterval));
}
```

2. **Unique IDs for Tracking**: Use UUIDs to reliably track specific events/tasks:

```typescript
const eventId = uuidv4();
await eventBus.publish({
  id: eventId,
  type: eventType,
  // ...
});
```

3. **State Verification**: Test both operations and resulting state:

```typescript
// Check the task was removed from scheduler after cancellation
const taskExistsAfterCancellation = scheduler.scheduledTasks.has(taskId);
expect(taskExistsAfterCancellation).toBe(false);
```

4. **Proper Cleanup**: Ensure tests clean up resources to prevent interference:

```typescript
afterEach(async () => {
  await runtime.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

### Testing Challenges

Testing asynchronous, event-driven systems presents several challenges:

1. **Timing Dependencies**: Operations complete at unpredictable times
2. **Event Propagation**: Events may not be processed immediately
3. **State Cleanup**: Ensuring tests don't interfere with each other
4. **Mock vs. Real Implementations**: Finding the right testing balance

Our approach uses:
- Real implementations for most components
- Time manipulation with vitest's timer mocks
- Polling instead of fixed delays
- Explicit tracking of async operations

## Best Practices

When working with the Core2 Runtime:

1. **Event Design**: Keep events small, immutable, and semantically meaningful
2. **Process Management**: Model processes explicitly with clear states and transitions
3. **Error Handling**: Use Result<T> for clear error paths
4. **Extension Points**: Define clear extension points for customization
5. **Testing**: Use polling, unique IDs, and time manipulation for reliable tests

## Common Patterns

### Handling Asynchronous Operations

```typescript
// Publish an event
await eventBus.publish({
  id: uuidv4(),
  type: 'entity.created',
  timestamp: Date.now(),
  payload: entityData,
  metadata: { source: 'user-action' }
});

// Poll for event reception
const maxAttempts = 50;
const pollInterval = 20; // milliseconds
let eventReceived = false;

for (let attempt = 0; attempt < maxAttempts; attempt++) {
  if (receivedEvents.some(e => e.type === 'entity.created')) {
    eventReceived = true;
    break;
  }
  await new Promise(resolve => setTimeout(resolve, pollInterval));
}

expect(eventReceived).toBe(true);
```

### Process State Transitions

```typescript
// Create a process
const createResult = await processManager.createProcess('order-process', orderData);
const processId = createResult.value.id;

// Apply events to transition state
await processManager.applyEvent(processId, 'approve', { approvedBy: 'user123' });
await processManager.applyEvent(processId, 'complete', { completedAt: Date.now() });

// Get current state
const process = await processManager.getProcess(processId);
expect(process.value.state).toBe('completed');
```

### Scheduled Tasks

```typescript
// Schedule a task
const executeAt = Date.now() + 60000; // 1 minute in the future
const scheduleResult = await taskScheduler.scheduleTask(
  'send-notification',
  { userId: 'user123', message: 'Hello!' },
  executeAt
);

// Cancel a task
await taskScheduler.cancelScheduledTask(scheduleResult.value);
```

### Using the Plugin System

```typescript
// Define a plugin
const myPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  dependencies: ['core-plugin'],
  
  // Plugin lifecycle
  initialize: async () => { /* setup */ },
  activate: async () => { /* start */ },
  deactivate: async () => { /* cleanup */ },
  
  // Extensions provided by this plugin
  getExtensions: () => [myExtension1, myExtension2]
};

// Register the plugin
const result = pluginRegistry.registerPlugin(myPlugin);
``` 