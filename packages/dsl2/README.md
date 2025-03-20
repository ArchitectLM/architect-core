# Actor-Based DSL for Reactive Systems

## Introduction

The Actor-Based Domain-Specific Language (DSL) is a powerful framework for building reactive systems that provides a unified approach to system design, testing, and runtime behavior. This document explains the architecture, components, and philosophy behind the DSL, and how it integrates with the core runtime to create robust, message-driven applications.

## Philosophy and Design Principles

### Reactive System Approach

This DSL is built on the principles of reactive systems:

1. **Responsive**: Systems respond in a timely manner
2. **Resilient**: Systems remain responsive in the face of failures
3. **Elastic**: Systems stay responsive under varying workload
4. **Message-Driven**: Systems rely on asynchronous message-passing for communication

### Actor Model at the Core

The actor model is a mathematical model of concurrent computation that treats "actors" as the universal primitives of computation. In our DSL:

- **Actors** are the primary building blocks
- Each actor has its own private state
- Actors communicate only through message passing
- Actors can create other actors, forming hierarchies
- Supervision strategies handle failures gracefully

### Key Benefits Over Traditional Approaches

1. **Simplified Reasoning**: Each actor can be reasoned about in isolation, reducing cognitive load
2. **Natural Concurrency**: The actor model inherently supports concurrent execution without shared state
3. **Fault Isolation**: Failures are contained within actors, preventing system-wide crashes
4. **Location Transparency**: Actors can communicate regardless of where they are deployed
5. **Dynamic Runtime Adaptation**: Systems can evolve at runtime by creating or stopping actors
6. **Self-Testing Capability**: Actors include their own test definitions, ensuring behavior matches expectations

## DSL Architecture Overview

The DSL architecture consists of several interconnected components:

![DSL Architecture Overview](https://via.placeholder.com/800x400?text=DSL+Architecture)

### Component Model

At the foundation of the DSL is the component model, which defines various component types:

```typescript
export enum ComponentType {
  SCHEMA = 'schema',
  COMMAND = 'command',
  QUERY = 'query',
  EVENT = 'event',
  WORKFLOW = 'workflow',
  ACTOR = 'actor',
  PROCESS = 'process',
  SAGA = 'saga',
  SYSTEM = 'system'
}
```

Each component type serves a specific purpose in the reactive system:

- **Schemas**: Define data structures used throughout the system
- **Commands**: Represent requests to change state
- **Queries**: Represent requests for information without changing state
- **Events**: Represent facts that have occurred
- **Workflows**: Define state transitions based on events
- **Actors**: Encapsulate state and behavior, responding to messages
- **Processes**: Define complex flows involving multiple components
- **Sagas**: Manage long-lived transactions with compensation
- **Systems**: Compose components into a cohesive application

### Core DSL Class

The `DSL` class provides the primary interface for defining systems:

```typescript
const dsl = new DSL();

// Define an actor
const userActor = dsl.actor('UserActor', {
  description: 'Manages user operations',
  version: '1.0.0',
  messageHandlers: {
    // Message handlers
  },
  tests: {
    // Interface and implementation tests
  }
});

// Implement the actor
dsl.implementActor('UserActor', {
  // Implementation of message handlers
});

// Define a system with actors
const system = dsl.system('UserManagementSystem', {
  description: 'User management system',
  version: '1.0.0',
  components: {
    actors: [{ ref: 'UserActor' }]
  }
});
```

The DSL class maintains registries for:
- Component definitions
- Component implementations
- Extensions for integrating with external systems

### Runtime Adapter

The `RuntimeAdapter` class bridges the DSL to the runtime environment, allowing:

- Creation of actor systems from system definitions
- Management of actor lifecycle (start, stop, restart)
- Message passing between actors
- State persistence and recovery
- Monitoring and metrics collection

## Key Components In Detail

### Actor Definitions

Actors are the central components in the DSL, defined with:

1. **Basic Information**: ID, description, version
2. **Message Handlers**: Define the messages an actor can process
3. **Input/Output Schemas**: Define the structure of messages and responses
4. **Configuration**: Backpressure, supervision, and state management
5. **Tests**: Self-testing capabilities for validating behavior

Example:
```typescript
const walletActor = dsl.actor('WalletActor', {
  description: 'Manages user wallet operations',
  version: '1.0.0',
  messageHandlers: {
    getBalance: {
      input: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        },
        required: ['userId']
      },
      output: {
        type: 'object',
        properties: {
          balance: { type: 'number' },
          currency: { type: 'string' }
        }
      }
    }
  },
  config: {
    backpressure: {
      strategy: 'drop',
      maxMailboxSize: 100
    },
    supervision: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      resetTimeout: 60000
    }
  }
});
```

### Actor Implementations

Actors are implemented separately from their definitions, allowing different implementations to satisfy the same interface:

```typescript
dsl.implementActor('CalculatorActor', {
  add: async (msg: { a: number, b: number }, ctx: any) => {
    return { result: msg.a + msg.b };
  },
  multiply: async (msg: { a: number, b: number }, ctx: any) => {
    return { result: msg.a * msg.b };
  }
});
```

The implementation includes:
- Message handlers that match the actor definition
- Optional lifecycle hooks (_start, _stop)
- State management through the context object

### Actor Self-Testing

A unique feature of this DSL is built-in self-testing for actors:

```typescript
dsl.actor('UserActor', {
  // Actor definition...
  tests: {
    interface: [
      {
        name: 'Should return user when given valid ID',
        messageHandler: 'getUser',
        input: { userId: 'user123' },
        expectedResult: {
          id: 'user123',
          name: 'Test User',
          email: 'test@example.com'
        }
      },
      {
        name: 'Should throw error when given invalid ID',
        messageHandler: 'getUser',
        input: { userId: 'invalid' },
        expectError: true
      }
    ],
    implementation: [
      {
        name: 'should execute with proper database calls',
        setup: '// Mock database setup code',
        messageHandler: 'getUser',
        input: { userId: '123' },
        assertions: '// Verification code'
      }
    ]
  }
});
```

Benefits of self-testing:
- Tests become part of the component definition
- Interface tests validate behavioral contracts
- Implementation tests verify internal functionality
- Tests run automatically against implementations
- Ensures actors behave as expected

### Systems and Composition

Systems compose actors and other components into a cohesive application:

```typescript
dsl.system('ECommerceSystem', {
  description: 'E-Commerce System with Actor Components',
  version: '1.0.0',
  components: {
    actors: [
      { ref: 'UserActor' },
      { ref: 'OrderActor' }
    ],
    processes: [
      { ref: 'OrderProcess' }
    ]
  }
});
```

Systems allow:
- Composing actors and other components
- Defining relationships between components
- Configuring system-wide settings
- Creating a deployable unit

## Integration with Core Runtime

The DSL integrates with the core runtime through the `RuntimeAdapter`:

### Actor System Creation

```typescript
const actorSystem = adapter.createActorSystem('ECommerceSystem');
```

This creates an actor system that:
- Instantiates actors from definitions
- Sets up message routing between actors
- Prepares the supervision hierarchy
- Configures monitoring and metrics

### Message Handling

```typescript
const calculator = actorSystem.getActor('CalculatorActor');
const result = await calculator.send('add', { a: 5, b: 3 });
```

The runtime handles:
- Message serialization and routing
- Execution of appropriate handlers
- Error handling and supervision
- Response collection and delivery

### Actor Lifecycle Management

```typescript
await actorSystem.start();         // Start all actors
await actor.stop();                // Stop a specific actor
await actorSystem.restartActor('actorId'); // Restart an actor
```

The runtime manages:
- Actor initialization and startup
- Graceful shutdown
- Recovery after failures
- State persistence and restoration

## Reactive System Patterns

The DSL implements several key reactive system patterns:

### Message-Driven Communication

All components communicate through well-defined messages, ensuring:
- Loose coupling between components
- Asynchronous processing
- Clear interfaces
- Easy testing and mocking

### Supervision and Resilience

Actors are organized in supervision hierarchies:
- Parent actors supervise child actors
- Different restart strategies handle failures
- Circuit breakers prevent cascading failures
- Backpressure mechanisms handle overload

### State Isolation

Each actor encapsulates its state:
- No shared mutable state
- Consistency guaranteed within actor boundaries
- State changes only through message processing
- Optional persistence for recovery

### Reactive Flows

Complex processes are modeled as reactive flows:
- Event-driven state transitions
- Message correlation
- Timeouts and error handling
- Compensation for failures

## Comparison with Other Approaches

### vs. Traditional Object-Oriented Programming

| Actor Model | Traditional OOP |
|-------------|-----------------|
| Message passing | Method calls |
| Isolated state | Shared state |
| Supervision hierarchies | Exception propagation |
| Location transparency | Tight coupling |
| Natural concurrency | Complex concurrency mechanisms |

### vs. Microservices

| Actor Model | Microservices |
|-------------|---------------|
| Lightweight entities | Heavier service boundaries |
| Single deployment option | Complex deployment |
| Uniform communication | Multiple protocols |
| Built-in supervision | External monitoring |
| Scalable within process | Network overhead |

### vs. Functional Programming

| Actor Model | Functional Programming |
|-------------|------------------------|
| Mutable state per actor | Immutable state |
| Message handling | Pure functions |
| Supervision | Error monads |
| Dynamic topology | Static composition |
| Runtime adaptability | Compile-time guarantees |

## Conclusion

The Actor-Based DSL provides a comprehensive approach to building reactive systems with a focus on:

1. **Component-based design** with actors as primary building blocks
2. **Message-driven communication** for loose coupling
3. **Built-in testing** for reliable behavior
4. **Runtime adaptability** for resilience
5. **System composition** for complex applications

By adopting this approach, developers can build systems that are more:
- Responsive to user demands
- Resilient in the face of failures
- Elastic under varying load
- Maintainable through clear boundaries
- Testable with built-in validation

The DSL bridges the gap between design and runtime, ensuring that system behavior matches expectations and evolves gracefully over time.
