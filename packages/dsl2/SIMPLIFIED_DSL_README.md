# Simplified DSL for Reactive Systems

This document describes the simplified approach to building reactive systems with our DSL. The simplified approach focuses on a minimal set of core component types with attribute-based specialization and composition.

## Core Principles

1. **Minimal Core Types**: Focus on a small set of foundational component types
2. **Composition Over Specialization**: Build complex behaviors by composing simpler ones
3. **Attribute-Based Specialization**: Use attributes to specialize components without creating new types
4. **Declarative End-to-End**: Keep everything declarative, including testing

## Core Component Types

### SCHEMA

Schemas define data structures and their validation rules.

```typescript
dsl.component('User', {
  type: ComponentType.SCHEMA,
  description: 'User account information',
  version: '1.0.0',
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' }
  },
  required: ['id', 'name', 'email']
});
```

### EVENT

Events represent important occurrences in the system.

```typescript
dsl.component('UserCreated', {
  type: ComponentType.EVENT,
  description: 'Event emitted when a user is created',
  version: '1.0.0',
  payload: {
    properties: {
      userId: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['userId', 'name', 'timestamp']
  }
});
```

### ACTOR

Actors encapsulate behavior and state, responding to messages.

```typescript
dsl.component('UserActor', {
  type: ComponentType.ACTOR,
  description: 'Actor managing user operations',
  version: '1.0.0',
  state: {
    properties: {
      users: { type: 'array', items: { ref: 'User' } }
    }
  },
  messageHandlers: {
    createUser: {
      input: {
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['name', 'email']
      },
      output: { ref: 'User' },
      produces: [{ event: 'UserCreated' }]
    },
    getUser: {
      input: {
        properties: {
          userId: { type: 'string' }
        },
        required: ['userId']
      },
      output: { ref: 'User' }
    }
  }
});
```

### PROCESS

Processes define workflows with states and transitions.

```typescript
dsl.component('UserRegistrationProcess', {
  type: ComponentType.PROCESS,
  description: 'User registration workflow',
  version: '1.0.0',
  initialState: 'started',
  states: {
    started: {
      description: 'Registration started',
      transitions: [
        { 
          event: 'EMAIL_VERIFICATION_SENT',
          target: 'awaiting_verification',
          action: {
            actor: 'EmailActor',
            message: 'sendVerificationEmail'
          }
        }
      ]
    },
    awaiting_verification: {
      description: 'Waiting for email verification',
      transitions: [
        {
          event: 'EMAIL_VERIFIED',
          target: 'completed',
          action: {
            actor: 'UserActor',
            message: 'verifyEmail'
          }
        }
      ]
    },
    completed: {
      description: 'Registration completed',
      final: true
    }
  }
});
```

### SYSTEM

Systems compose components into a cohesive application.

```typescript
dsl.system('UserManagementSystem', {
  description: 'System for managing users',
  version: '1.0.0',
  components: {
    schemas: [{ ref: 'User' }],
    events: [{ ref: 'UserCreated' }],
    actors: [{ ref: 'UserActor' }],
    processes: [{ ref: 'UserRegistrationProcess' }]
  }
});
```

## Attribute-Based Specialization

Instead of creating new component types for specialized behaviors, use attributes to enhance existing types.

### Event Sourcing

```typescript
dsl.component('UserEventStore', {
  type: ComponentType.ACTOR,
  description: 'Event-sourced user store',
  version: '1.0.0',
  attributes: {
    eventSourced: {
      enabled: true,
      events: [
        { ref: 'UserCreated' },
        { ref: 'UserProfileUpdated' }
      ],
      snapshotFrequency: 100
    }
  },
  // Regular actor definition...
});
```

### CQRS

```typescript
dsl.system('UserCQRSSystem', {
  description: 'CQRS system for user management',
  version: '1.0.0',
  attributes: {
    cqrs: {
      enabled: true,
      commandSide: { ref: 'UserCommandSubsystem' },
      querySide: { ref: 'UserQuerySubsystem' },
      eventBus: { ref: 'UserEventBus' }
    }
  },
  components: {
    systems: [
      { ref: 'UserCommandSubsystem' },
      { ref: 'UserQuerySubsystem' }
    ],
    processes: [
      { ref: 'UserEventBus' }
    ]
  }
});
```

### Message Bus

```typescript
dsl.component('ApplicationBus', {
  type: ComponentType.PROCESS,
  description: 'Application message bus',
  version: '1.0.0',
  attributes: {
    messageBus: {
      enabled: true,
      messageTypes: [
        { ref: 'UserCommand' },
        { ref: 'SystemEvent' }
      ],
      deliveryGuarantee: 'at-least-once',
      subscriptions: [
        { messageType: 'UserCommand', subscribers: ['UserCommandHandler'] },
        { messageType: 'SystemEvent', subscribers: ['AuditLogger', 'MetricsCollector'] }
      ]
    }
  },
  // Regular process definition...
});
```

## Actor Composition

Compose actor behaviors to reuse functionality:

```typescript
// Define a behavior actor
dsl.component('LoggingBehavior', {
  type: ComponentType.ACTOR,
  description: 'Logging behavior',
  version: '1.0.0',
  messageHandlers: {
    logInfo: {
      input: {
        properties: {
          message: { type: 'string' },
          data: { type: 'object' }
        },
        required: ['message']
      },
      output: { type: 'null' }
    },
    logError: {
      input: {
        properties: {
          message: { type: 'string' },
          error: { type: 'object' }
        },
        required: ['message']
      },
      output: { type: 'null' }
    }
  }
});

// Apply behavior to an actor
dsl.component('EnhancedUserActor', {
  type: ComponentType.ACTOR,
  description: 'User actor with logging behavior',
  version: '1.0.0',
  behaviors: [
    { ref: 'LoggingBehavior' }
  ],
  // Actor-specific definition...
});
```

## Policy Definition

Apply policies to control cross-cutting concerns:

### Actor-Level Policies

```typescript
dsl.component('PaymentProcessorActor', {
  type: ComponentType.ACTOR,
  description: 'Payment processor actor',
  version: '1.0.0',
  policies: {
    retry: {
      'processPayment': {
        attempts: 3,
        backoff: 'exponential',
        initialDelay: '100ms'
      }
    },
    circuitBreaker: {
      'processPayment': {
        failureThreshold: 5,
        resetTimeout: '30s'
      }
    },
    timeout: {
      'processPayment': {
        duration: '5s'
      }
    }
  },
  // Actor-specific definition...
});
```

### System-Level Policies

```typescript
dsl.system('PaymentSystem', {
  description: 'Payment processing system',
  version: '1.0.0',
  policies: {
    rateLimiting: {
      'api.payment.*': { limit: 100, window: '1m' }
    },
    security: {
      authentication: { required: true },
      authorization: { roles: ['payment-processor'] }
    }
  },
  // System-specific definition...
});
```

## Declarative Testing

Define tests declaratively using the TEST component type:

```typescript
dsl.component('UserActorTest', {
  type: ComponentType.TEST,
  description: 'Tests for UserActor',
  version: '1.0.0',
  target: { ref: 'UserActor' },
  scenarios: [
    {
      name: 'Create user successfully',
      given: [
        { setup: 'emptyState' }
      ],
      when: [
        { 
          send: { 
            message: 'createUser', 
            payload: { 
              name: 'Test User', 
              email: 'test@example.com' 
            } 
          }
        }
      ],
      then: [
        { assert: 'result.name', equals: 'Test User' },
        { assert: 'result.email', equals: 'test@example.com' },
        { assert: 'actorState.users.length', equals: 1 },
        { assert: 'eventsEmitted', contains: { type: 'UserCreated' } }
      ]
    }
  ]
});
```

## Implementation and Runtime

The DSL definitions are executed by a runtime environment that handles message passing, state management, and other infrastructure concerns:

```typescript
// Create a runtime adapter
const runtimeAdapter = createRuntimeAdapter();

// Convert DSL definition to runtime configuration
const runtimeConfig = runtimeAdapter.convertDefinitionToRuntime(system);

// Create actor system
const actorSystem = await runtimeAdapter.createActorSystem(runtimeConfig);

// Start the system
await actorSystem.start();

// Interact with the system
const result = await actorSystem.getActor('UserActor').tell('createUser', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

## Benefits of the Simplified Approach

1. **Easier to Learn**: Fewer core concepts to understand
2. **More Flexible**: Compose and specialize components as needed
3. **More Maintainable**: Clear separation of concerns and reusable behaviors
4. **Better Performance**: Runtime optimizations for attribute-based specialization
5. **Declarative End-to-End**: Everything is defined declaratively, including testing

## Migration from Previous Approach

If you're using the previous approach with specialized component types, you can migrate to the simplified approach by:

1. Converting specialized component types to core types with attributes
2. Extracting common behaviors into reusable actor behaviors
3. Applying policies for cross-cutting concerns

The runtime will handle the specialized behavior based on the attributes, behaviors, and policies you define. 