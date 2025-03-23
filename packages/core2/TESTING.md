<think>I need to provide hints about the refactored core and plugin logic to make fixing unit and integration tests easier. Based on the codebase I explored, I should focus on:

1. The architecture patterns that appear in the core components
2. Common issues in the tests based on the SUCCESS.md file
3. Plugin system integration points
4. Event sequencing and handling
5. Task execution lifecycle
6. Best practices for testing async components

I'll structure this as practical advice for developers working on fixing the tests, with specific recommendations about testing approaches, common pitfalls, and ways to address them.</think># Test Fixing Guide for @architectlm/core

## Core Architecture Testing Insights

### Event System Testing

1. **Event Ordering Issues**
   - Most event bus test failures stem from race conditions in event delivery
   - Use the polling technique instead of fixed timeouts in tests
   - Verify complete event sequences rather than individual events
   - Example pattern:
     ```typescript
     await pollUntil(() => receivedEvents.length >= expectedCount, 100, 1000);
     expect(receivedEvents).toContainEqual(expectedEvent);
     ```

2. **Event Subscription Lifecycle**
   - Always clean up subscriptions in test teardown
   - Test unsubscribe functionality explicitly before dependent tests
   - Ensure event bus is cleared between tests to prevent cross-test pollution

### Task Execution Testing

1. **Task Status Transition Testing**
   - Tasks now follow a strict state machine: PENDING → RUNNING → (COMPLETED|FAILED)
   - Test each state transition independently
   - Mock task functions should return Promises consistently
   - Use `jest.spyOn` to verify task executor internal method calls

2. **Task Dependency Resolution**
   - Dependencies are now resolved depth-first
   - Create test cases with explicit dependency trees (A→B→C and A→B, A→C patterns)
   - Verify both results passing and error propagation
   - Remember that cancellation now cascades to dependent tasks

### Plugin System Testing

1. **Plugin Initialization Order**
   - Plugins are now initialized in registration order
   - Extension points are registered during plugin initialization
   - Test both plugin initialization and extension point registration separately
   - Mock the runtime object consistently across plugin tests

2. **Plugin Hook Execution**
   - Extension hooks now receive consistent context objects
   - Ensure hook context contains expected properties before testing behavior
   - Test hook registration, execution, and error handling separately

## Common Test Failures and Solutions

### Timeouts in Async Tests

```typescript
// PROBLEMATIC: Fixed timeout
test('should process events', async () => {
  // ...code...
  await sleep(100); // Brittle!
  expect(result).toBe(expected);
});

// RECOMMENDED: Poll until condition or timeout
test('should process events', async () => {
  // ...code...
  await pollUntil(() => condition === expected, 10, 1000);
  expect(result).toBe(expected);
});
```

### Event Ordering Issues

```typescript
// PROBLEMATIC: Assumes event order
test('should receive events in order', async () => {
  const events = [];
  bus.on('*', e => events.push(e));
  
  bus.emit('event1', { data: 1 });
  bus.emit('event2', { data: 2 });
  
  await sleep(50);
  expect(events[0].type).toBe('event1'); // Can fail!
  expect(events[1].type).toBe('event2');
});

// RECOMMENDED: Test for presence, not order
test('should receive all events', async () => {
  const events = [];
  bus.on('*', e => events.push(e));
  
  bus.emit('event1', { data: 1 });
  bus.emit('event2', { data: 2 });
  
  await pollUntil(() => events.length >= 2, 10, 500);
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'event1', data: 1 }),
      expect.objectContaining({ type: 'event2', data: 2 })
    ])
  );
});
```

### Task Retry Logic Issues

```typescript
// PROBLEMATIC: Doesn't track retry attempts
test('should retry failed tasks', async () => {
  const task = createTask({
    retryPolicy: { maxAttempts: 3 }
  });
  
  await executor.execute(task);
  expect(task.status).toBe('COMPLETED'); // Might still be retrying!
});

// RECOMMENDED: Track attempts and verify completion
test('should retry failed tasks', async () => {
  let attempts = 0;
  const task = createTask({
    execute: async () => {
      attempts++;
      if (attempts < 3) throw new Error('Failing for test');
      return 'success';
    },
    retryPolicy: { maxAttempts: 3 }
  });
  
  const result = await executor.execute(task);
  expect(attempts).toBe(3);
  expect(result).toBe('success');
});
```

## Integration Test Fixes

### Runtime Lifecycle Management

1. **Test Isolation**
   - Always create a fresh runtime instance for each test
   - Use `beforeEach` to set up and `afterEach` to clean up runtime
   - Ensure all plugins are properly initialized before testing

2. **Plugin Interaction Testing**
   - Test plugins individually, then in pairs, then all together
   - Identify conflicting plugins (e.g., multiple task schedulers)
   - Use minimal plugin configurations for integration tests

3. **Event Tracing**
   - Add an event recorder plugin for debugging tests:
   ```typescript
   const eventRecorder = {
     events: [],
     initialize: (runtime) => {
       runtime.eventBus.on('*', (e) => eventRecorder.events.push(e));
     }
   };
   runtime.registerPlugin('eventRecorder', eventRecorder);
   ```

## Plugin-Specific Testing Tips

### Circuit Breaker Plugin

- Test all three states: CLOSED → OPEN → HALF_OPEN → CLOSED
- Verify state transitions on specific failure counts
- Mock time for testing timeout-based state transitions

### Task Prioritization Plugin

- Test with mixed priority tasks and verify execution order
- Ensure priority doesn't override dependencies
- Test priority changes during execution

### Distributed Execution Plugin

- Mock remote executors rather than creating actual network connections
- Test both successful and failed remote execution paths
- Verify timeout handling for remote tasks

### Event Sourcing Plugin

- Test event replay functionality thoroughly
- Verify event ordering during replay
- Test snapshot creation and restoration

## Test Utilities to Implement

1. **Runtime Test Harness**
   ```typescript
   // Create a test harness that simplifies runtime testing
   function createTestRuntime(plugins = []) {
     const runtime = createRuntime();
     plugins.forEach(plugin => runtime.registerPlugin(plugin.name, plugin));
     return {
       runtime,
       async initialize() {
         await runtime.initialize();
         return this;
       },
       async destroy() {
         await runtime.shutdown();
       },
       // Add test-specific helpers here
     };
   }
   ```

2. **Event Assertion Helpers**
   ```typescript
   // Create helpers for verifying event sequences
   function expectEventSequence(events, expectedSequence) {
     const types = events.map(e => e.type);
     expectedSequence.forEach(type => {
       expect(types).toContain(type);
       // Verify order if needed
       if (expectedSequence.indexOf(type) > 0) {
         const prevType = expectedSequence[expectedSequence.indexOf(type) - 1];
         expect(types.indexOf(type)).toBeGreaterThan(types.indexOf(prevType));
       }
     });
   }
   ```

3. **Async Test Helpers**
   ```typescript
   // Create better polling utilities
   async function pollUntil(condition, interval, timeout) {
     const start = Date.now();
     while (Date.now() - start < timeout) {
       if (await condition()) return true;
       await new Promise(r => setTimeout(r, interval));
     }
     throw new Error(`Condition not met within ${timeout}ms`);
   }
   ```

## Common Integration Test Fixes

1. **Event Emitter Memory Leaks**
   - Implementation now has internal limits on listener count
   - Add `.setMaxListeners(0)` for test buses or count and remove listeners

2. **Task Execution Tracking**
   - Use the new TaskMetricsCollector for better execution insight
   - Add test plugins that track specific lifecycle events

3. **Transaction Consistency**
   - Transaction tests need explicit verification of STARTED → COMMITTED/ROLLED_BACK
   - Most transaction test failures are due to missing await on async operations

4. **Plugin Initialization Timing**
   - Plugin initialization is now sequential and awaitable
   - Wait for `runtime.initialize()` to complete before testing any plugins

## Advanced Test Patterns

1. **State Machine Testing**
   - Test each state transition independently
   - Create diagrams of expected state flows and test each path
   - Use property-based testing for complex state machines

2. **Snapshot Testing**
   - Create snapshots of key system states for quick regression testing
   - Test system recovery from snapshots

3. **Chaos Testing**
   - Intentionally fail components to test resilience
   - Add random delays to test timing sensitivity
   - Create "flaky" plugins that sometimes fail to test recovery

By following these patterns and fixing the identified issues, you should be able to significantly improve the test suite stability and completion rate. Focus first on core component tests, then plugin-specific tests, and finally integration tests as the most complex category.
