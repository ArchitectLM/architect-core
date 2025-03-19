# ArchitectLM Core

This package provides the core functionality for the ArchitectLM framework, a reactive event-driven system for building resilient applications.

## Features

- **Event Bus**: A reactive event bus for publishing and subscribing to events, with support for RxJS observables.
- **Command Handler**: An abstract command handler for processing commands with middleware support.
- **Circuit Breaker**: A circuit breaker pattern implementation for handling failures and preventing cascading failures.
- **Retry Policy**: A retry policy pattern implementation for handling transient failures with configurable backoff strategies.
- **Runtime**: A reactive runtime for executing event-driven workflows, managing processes and tasks.
- **Dead Letter Queue**: A queue for storing and reprocessing failed events.
- **Structured Logger**: A flexible logging system with support for levels, child loggers, and contextual information.
- **Time Windowed Operations**: Support for tumbling windows, sliding windows, session windows, and count windows on event streams.
- **Event Correlation**: Tools for correlating related events based on keys or custom matchers within time windows.

## Installation

```bash
npm install @architectlm/core
```

## Usage

```typescript
import { 
  ReactiveEventBus, 
  CommandHandler, 
  DefaultCircuitBreaker, 
  DefaultRetryPolicy, 
  DeadLetterQueue,
  StructuredLogger,
  LogLevel,
  TimeWindowedOperations,
  EventCorrelation,
  createRuntime 
} from '@architectlm/core';

// Create an event bus
const eventBus = new ReactiveEventBus();

// Create a circuit breaker
const circuitBreaker = new DefaultCircuitBreaker('my-circuit-breaker', {
  failureThreshold: 5,
  resetTimeout: 30000
});

// Create a retry policy
const retryPolicy = new DefaultRetryPolicy('my-retry-policy', {
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelay: 1000
});

// Create a dead letter queue
const deadLetterQueue = new DeadLetterQueue(eventBus);

// Create a structured logger
const logger = new StructuredLogger({
  name: 'MyService',
  level: LogLevel.INFO,
  context: { serviceId: 'user-service' }
});

// Create a time windowed operations handler
const windowedOps = new TimeWindowedOperations(eventBus);

// Create an event correlation handler
const eventCorrelation = new EventCorrelation(eventBus);

// Create a command handler (example implementation)
class MyCommandHandler extends CommandHandler {
  constructor(eventBus) {
    super(eventBus);
  }

  get commandName() {
    return 'MyCommand';
  }

  protected async handleCommand(command) {
    // Command implementation
    return { success: true };
  }
}

const commandHandler = new MyCommandHandler(eventBus);

// Create a runtime with process and task definitions
const runtime = createRuntime({
  processDefinitions: {
    /* process definitions */
  },
  taskDefinitions: {
    /* task definitions */
  }
});
```

## Recent Changes

### Migration to Extension System

As part of our effort to make the ArchitectLM framework more modular and extensible, we have moved several functionalities from the core package to the extension system. This allows for better separation of concerns, more flexibility, and easier customization.

The following functionality has been moved to the extension system:

- **Caching**: The `Cache` class and related types have been moved to the `CachingStrategyExtension`.
- **Enhanced Retry Policy**: The `EnhancedRetryPolicy` class and related types have been moved to the `BackoffStrategyExtension`.
- **Rate Limiter**: The `RateLimiter` class has been moved to the extension system.
- **Bulkhead**: The `Bulkhead` isolation pattern has been moved to the extension system.
- **Enhanced Circuit Breaker**: The `EnhancedCircuitBreaker` with additional configuration options has been moved to the extension system.

For more information on the migration, see the [Extension Migration Guide](./docs/extension-migration.md).

## Documentation

For more detailed documentation, see the [docs](./docs) directory.

## License

MIT 