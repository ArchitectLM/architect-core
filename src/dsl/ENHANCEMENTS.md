# Hybrid DSL Enhancements

This document outlines the enhancements made to the Hybrid DSL for the Architect Framework.

## 1. State Validation

State validation ensures that transitions in stateful processes reference valid states. This prevents runtime errors and ensures the integrity of the state machine.

### Features

- Validates that both the source (`from`) and target (`to`) states in transitions exist in the process's state list
- Provides detailed error messages that include the available states
- Validates transitions at multiple points:
  - When building a process using `ProcessBuilder`
  - When building a system using `SystemBuilder`
  - When using the functional API
  - During schema migration

### Example

```typescript
// This will throw an error because 'non-existent-state' is not in the states list
const process = new ProcessBuilder('process1', 'Test Process', 'context1', 'stateful')
  .withStates(['state1', 'state2', 'state3'])
  .withTransition('state1', 'non-existent-state', 'event')
  .build();
```

Error message:
```
Invalid state "non-existent-state" in transition. Available states: state1, state2, state3
```

## 2. Enhanced Error Messages

Enhanced error messages provide more context and clarity when validation fails, making it easier to identify and fix issues.

### Features

- Detailed error messages that include the specific entity and context
- Error messages include suggestions for how to fix the issue
- Consistent error message format across the DSL
- Enhanced validation results with context information

### Example

Before:
```
Bounded context 'non-existent-context' does not exist
```

After:
```
Bounded context "non-existent-context" does not exist. Please create the bounded context before adding processes to it.
```

## 3. Schema Versioning

Schema versioning allows for tracking and migrating between different versions of a system schema, ensuring backward compatibility and smooth upgrades.

### Features

- Support for semantic versioning (e.g., 1.0.0)
- Migration history tracking
- Custom transformations during migration
- Validation of migrated schemas
- Option to skip validation for intermediate migrations

### Example

```typescript
// Define a migration transformation
const migration = (system) => ({
  ...system,
  processes: Object.entries(system.processes).reduce((acc, [id, process]) => ({
    ...acc,
    [id]: {
      ...process,
      // Add metadata to all processes
      metadata: {
        ...process.metadata,
        migrated: true,
        originalType: process.type
      },
      // Convert all stateless processes to stateful with default states
      type: 'stateful',
      states: ['initial', 'completed'],
      transitions: [
        { from: 'initial', to: 'completed', on: 'complete' }
      ]
    }
  }), {})
});

// Migrate the system
const v2System = migrateSchema(v1System, '2.0.0', migration);
```

## 4. LLM Agent Optimization

Optimizations for LLM (Large Language Model) agents make it easier for AI systems to understand and work with the DSL.

### Features

- Structured validation results with context
- Hints and suggestions for LLM agents
- Metadata for tracking validation history
- Consistent format for error messages

### Example

```typescript
const result = {
  success: false,
  issues: [
    {
      path: 'processes.process1.states',
      message: 'Stateful process should have at least two states',
      severity: 'error',
      context: {
        actual: ['initial'],
        expected: 'At least 2 states',
        processId: 'process1',
        processName: 'Test Process',
        suggestion: 'Add at least one more state, such as "completed"'
      }
    }
  ],
  metadata: {
    validatedAt: '2023-06-15T12:34:56.789Z',
    systemId: 'test-system',
    systemName: 'Test System',
    format: 'structured-for-llm'
  }
};
```

## Usage

### State Validation

```typescript
// Using ProcessBuilder
const process = new ProcessBuilder('process1', 'Test Process', 'context1', 'stateful')
  .withStates(['state1', 'state2', 'state3'])
  .withTransition('state1', 'state2', 'event1')
  .withTransition('state2', 'state3', 'event2')
  .build();

// Using SystemBuilder
const system = SystemBuilder.create('test-system')
  .withBoundedContext('context1', 'Test Context')
  .withStatefulProcess('process1', 'context1', {
    name: 'Test Process',
    states: ['state1', 'state2', 'state3'],
    transitions: [
      { from: 'state1', to: 'state2', on: 'event1' },
      { from: 'state2', to: 'state3', on: 'event2' }
    ]
  })
  .build();

// Using the functional API
const process = {
  id: 'process1',
  name: 'Test Process',
  contextId: 'context1',
  type: 'stateful',
  states: ['state1', 'state2', 'state3'],
  transitions: [
    { from: 'state1', to: 'state2', on: 'event1' },
    { from: 'state2', to: 'state3', on: 'event2' }
  ],
  triggers: [],
  tasks: []
};

validateStateTransitions(process);
```

### Schema Versioning

```typescript
// Simple migration
const v2System = migrateSchema(v1System, '2.0.0');

// Migration with transformation
const v2System = migrateSchema(v1System, '2.0.0', system => ({
  ...system,
  metadata: { upgraded: true }
}));

// Migration without validation
const v2System = migrateSchema(v1System, '2.0.0', transformer, false);

// Multiple migrations
const v2System = migrateSchema(v1System, '2.0.0', migration1to2);
const v3System = migrateSchema(v2System, '3.0.0', migration2to3);
```

## Benefits

1. **Improved Reliability**: State validation prevents runtime errors by catching invalid state references early.
2. **Better Developer Experience**: Enhanced error messages make it easier to identify and fix issues.
3. **Future-Proofing**: Schema versioning ensures smooth upgrades and backward compatibility.
4. **AI Integration**: LLM agent optimizations make it easier for AI systems to work with the DSL.

## Implementation Details

The enhancements are implemented in the following files:

- `src/dsl/index.ts`: Core implementation of the DSL
- `src/schema/types.ts`: Extended type definitions
- `tests/dsl/hybrid-dsl-enhancements.test.ts`: Tests for the enhancements 