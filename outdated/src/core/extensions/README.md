# ArchitectLM Extensions

This directory contains optional extensions for the ArchitectLM framework that provide additional functionality beyond the core system.

## Available Extensions

### Saga Coordinator

The Saga Coordinator extension provides support for long-running, multi-step processes that may require compensation (rollback) if any step fails. This is particularly useful for distributed transactions that span multiple services or systems.

**Key Features:**
- Define sagas with multiple steps
- Track saga execution status
- Support for compensation actions
- Event-based monitoring

### Scheduler

The Scheduler extension allows you to schedule tasks to run at specific times in the future, either once or on a recurring basis. This is useful for implementing delayed actions, reminders, or periodic maintenance tasks.

**Key Features:**
- Schedule one-time tasks
- Schedule recurring tasks with cron-like patterns
- Pause, resume, and cancel scheduled tasks
- Query scheduled tasks with filtering

### Supervisor

The Supervisor extension monitors processes and tasks for health issues and can automatically recover them based on configurable strategies. This improves system resilience and reduces the need for manual intervention.

**Key Features:**
- Monitor process and task health
- Configure recovery strategies
- Set maximum recovery attempts
- Event-based notifications

### Load Manager

The Load Manager extension provides resource management and circuit breaking capabilities to prevent system overload. It helps maintain system stability under high load conditions.

**Key Features:**
- Register and track resource usage
- Configure warning and critical thresholds
- Implement circuit breaking for resources
- Event-based load monitoring

## Using Extensions

Extensions can be enabled in your system configuration and accessed through the services object in task implementations:

```typescript
// Define a system with extensions
const system = defineSystem({
  id: 'my-system',
  // ...
  extensions: {
    sagaCoordinator: { enabled: true },
    scheduler: { enabled: true },
    supervisor: { enabled: true },
    loadManager: { enabled: true }
  }
});

// Create a runtime with extension services
const runtime = createRuntime({
  system,
  services: {
    sagaCoordinator: new MockSagaCoordinator(),
    scheduler: new MockScheduler(),
    supervisor: new MockSupervisor(),
    loadManager: new MockLoadManager()
  }
});

// Use extensions in tasks
const myTask = defineTask({
  id: 'my-task',
  implementation: async (context) => {
    const { services } = context;
    const { sagaCoordinator, scheduler, supervisor, loadManager } = services;
    
    // Use the extensions...
  }
});
```

## Implementation Notes

The extensions in this directory are mock implementations intended for testing and demonstration purposes. In a production environment, you would replace these with real implementations that connect to the appropriate backend services.

## Extension Interfaces

The extension interfaces are defined in `types.ts` and provide a contract that any implementation must follow. This allows you to create your own implementations that integrate with your specific infrastructure.

## Testing Extensions

The `extensions.test.ts` file contains tests that demonstrate how to use the extensions and verify their behavior. These tests can serve as examples for your own implementation. 