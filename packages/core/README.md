# ArchitectLM Core

This package provides the core functionality for the ArchitectLM framework, a reactive event-driven system for building resilient applications.

## Features

- **Event Bus**: A reactive event bus for publishing and subscribing to events.
- **Command Handler**: A command handler for processing commands with middleware support.
- **Circuit Breaker**: A circuit breaker pattern implementation for handling failures.
- **Retry Policy**: A retry policy pattern implementation for handling transient failures.
- **Runtime**: A reactive runtime for executing event-driven workflows.

## Installation

```bash
npm install @architectlm/core
```

## Usage

```typescript
import { ReactiveEventBus, CommandHandler, DefaultCircuitBreaker, DefaultRetryPolicy, ReactiveRuntime } from '@architectlm/core';

// Create an event bus
const eventBus = new ReactiveEventBus();

// Create a command handler
const commandHandler = new CommandHandler();

// Create a circuit breaker
const circuitBreaker = new DefaultCircuitBreaker('my-circuit-breaker', {
  failureThreshold: 5,
  resetTimeout: 30000
});

// Create a retry policy
const retryPolicy = new DefaultRetryPolicy('my-retry-policy', {
  maxAttempts: 3
});

// Create a runtime
const runtime = createRuntime({
  eventBus,
  commandHandler
});
```

## Recent Changes

### Migration to Extension System

As part of our effort to make the ArchitectLM framework more modular and extensible, we have moved several functionalities from the core package to the extension system. This allows for better separation of concerns, more flexibility, and easier customization.

The following functionality has been moved to the extension system:

- **Caching**: The `Cache` class and related types have been moved to the `CachingStrategyExtension`.
- **Enhanced Retry Policy**: The `EnhancedRetryPolicy` class and related types have been moved to the `BackoffStrategyExtension`.

For more information on the migration, see the [Extension Migration Guide](./docs/extension-migration.md).

## Documentation

For more detailed documentation, see the [docs](./docs) directory.

## License

MIT 