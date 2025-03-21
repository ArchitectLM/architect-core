# Actor System Test Helpers

This directory contains utility functions and test patterns to facilitate testing actor systems built with the DSL. These utilities help make tests more consistent, readable, and maintainable.

## Available Utilities

### `createMockContext`

Creates a mock `ActorContext` for testing actor implementations in isolation.

```typescript
import { createMockContext } from './actor-system-test-utils.js';

// Create with initial state
const context = createMockContext({ counter: 0 });

// Test your actor implementation
const result = await myActor.handleMessage({ data: 'test' }, context);

// Assert on state changes
expect(context.state?.counter).toBe(1);
```

### `createTestEventLog`

Creates an event log for tracking and asserting on events during tests.

```typescript
import { createTestEventLog } from './actor-system-test-utils.js';

const eventLog = createTestEventLog();

// Record events during tests
eventLog.recordEvent('ActorA', 'initialize', { timestamp: Date.now() });
eventLog.recordEvent('ActorB', 'process', { data: 'test' });

// Query events
const initEvents = eventLog.getEventsByAction('initialize');
const actorAEvents = eventLog.getEventsBySource('ActorA');
```

### `createMockPersistenceProvider`

Creates a mock persistence provider for testing stateful actors.

```typescript
import { createMockPersistenceProvider } from './actor-system-test-utils.js';

const persistenceProvider = createMockPersistenceProvider();

// Save state
await persistenceProvider.saveState('actorId', { counter: 42 });

// Create snapshots
const snapshotResult = await persistenceProvider.createSnapshot('actorId', { counter: 42 });

// Restore from snapshots
await persistenceProvider.restoreSnapshot('actorId', snapshotResult.snapshotId);
```

### `createMockActorSystem`

Creates a mock actor system for testing communication between actors.

```typescript
import { createMockActorSystem } from './actor-system-test-utils.js';

const actorSystem = createMockActorSystem();

// Register actors
actorSystem.registerActor('actorA', actorAImpl);
actorSystem.registerActor('actorB', actorBImpl);

// Send messages
await actorSystem.sendMessage('actorA', 'actorB', 'process', { data: 'test' });

// Verify message flow
const messageLog = actorSystem.getMessageLog();
expect(messageLog[0].from).toBe('actorA');
```

### `createTestScenarioRunner`

Creates a scenario runner for orchestrating complex test scenarios.

```typescript
import { createTestScenarioRunner } from './actor-system-test-utils.js';

const scenarioRunner = createTestScenarioRunner(dsl);

const results = await scenarioRunner.runScenario({
  setup: async () => {
    // Initialize system
  },
  actions: [
    async () => {
      // Action 1
    },
    async () => {
      // Action 2
    }
  ],
  cleanup: async () => {
    // Cleanup resources
  }
});
```

## Usage Examples

See the following test files for examples of how to use these utilities:

- `event-log-usage.test.ts` - Examples of using the event log
- `mock-context-usage.test.ts` - Examples of testing with mock contexts
- `persistence-provider-usage.test.ts` - Examples of testing stateful actors
- `actor-system-usage.test.ts` - Examples of testing actor communication

## Best Practices

1. **Isolate Tests**: Use the mock context to test actors in isolation before testing interactions.
2. **Track Events**: Use the event log to track and verify the sequence of operations.
3. **Test State Management**: Use the persistence provider to test state saving and restoration.
4. **Verify Message Flow**: Use the mock actor system to verify the correct flow of messages.
5. **Use Scenarios**: For complex tests, organize them as scenarios with clear setup, actions, and cleanup. 