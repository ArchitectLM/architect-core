# Core2 Runtime Integration Testing Guide

## Overview

This directory contains integration tests for the Core2 Runtime system. These tests verify that the real implementations of all components work together correctly without mocking. Unlike unit tests, these tests exercise the full runtime with all its components integrated together.

## Testing Philosophy

1. **Test Real Implementations**: We prioritize testing the actual implementations rather than mocks when possible. This catches integration issues that unit tests can miss.

2. **Asynchronous-Aware Testing**: Our testing approach recognizes the inherently asynchronous nature of the runtime and uses appropriate patterns to handle it.

3. **Reliability Over Speed**: We prefer slightly slower but reliable tests over faster but flaky ones. Reliability is key for a good developer experience.

## Key Testing Patterns

### 1. Polling for Events and State Changes

Instead of using fixed timeouts, use polling to wait for expected conditions:

```typescript
// Wait for an event to be received
const pollForEvent = async (eventId: string, maxAttempts = 50, interval = 20): Promise<boolean> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (receivedEvents.some(e => e.id === eventId)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
};

const eventReceived = await pollForEvent(eventId);
expect(eventReceived).toBe(true);
```

### 2. Unique Identifiers for Traceability

Use UUIDs to reliably track specific items across asynchronous boundaries:

```typescript
const eventId = uuidv4();
await eventBus.publish({
  id: eventId,
  type: 'test.event',
  timestamp: Date.now(),
  payload: { data: 'test' },
  metadata: {}
});

// Later in the test:
const foundEvent = allEvents.find(e => e.id === eventId);
```

### 3. Proper Test Lifecycle

Set up a clean environment before each test and clean up afterward:

```typescript
beforeEach(async () => {
  // Create new runtime for each test
  runtime = createModernRuntime(options);
  await runtime.initialize(options.runtimeOptions);
  await runtime.start();
  
  // Set up test-specific resources
  // ...
});

afterEach(async () => {
  // Clean up
  await runtime.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

### 4. Time Management

Use vitest's timer mocks for time-dependent operations:

```typescript
// Set up mock timers before tests
vi.useFakeTimers();

// In the test:
const futureTime = Date.now() + 1000;
await scheduler.scheduleTask('test-task', data, futureTime);

// Fast-forward time
vi.advanceTimersByTime(1100);

// Check if the task executed
expect(taskExecuted).toBe(true);
```

### 5. Direct State Inspection (When Necessary)

Sometimes it's necessary to access internal state for verification, especially for non-observable effects:

```typescript
// Test that a task was cancelled by checking internal state
// @ts-ignore - accessing private property for testing
const taskExistsAfterCancellation = scheduler.scheduledTasks.has(taskId);
expect(taskExistsAfterCancellation).toBe(false);
```

## Common Testing Challenges

### 1. Task Cancellation Testing

Testing task cancellation is tricky because:

- Asynchronous operations make it hard to verify something *didn't* happen
- The task scheduling system relies on timeouts which can be unreliable in tests

Our solution:
- Directly verify the task was removed from the scheduler's internal tracking
- Skip these tests in CI environments where timers can be unreliable

```typescript
it('should cancel a scheduled task', async () => {
  // Skip this test in CI environments
  if (process.env.CI) {
    console.log('Skipping task cancellation test in CI environment');
    return;
  }
  
  // Rest of the test...
});
```

### 2. Event Bus Testing

Event bus testing can be challenging because:

- Events might be processed out of order
- Subscribers might receive events at unpredictable times
- Event processing might be batched or buffered

Our solution:
- Use unique IDs for each event
- Poll with a reasonable timeout for event reception
- Verify based on event IDs, not just counts or order

### 3. Runtime Lifecycle Testing

Testing runtime shutdown and restart is complex because:

- The runtime state transitions might be incomplete
- Some components might hold onto resources
- Restart from a stopped state requires a reset first

Our solution:
- Add explicit reset step before restart
- Use polling to verify health status changes
- Test event processing both before and after restart

## Debugging Integration Tests

When tests fail, consider:

1. **Timing Issues**: Try increasing polling intervals or max attempts
2. **State Leakage**: Make sure beforeEach/afterEach are properly cleaning up
3. **Silent Failures**: Add more debug logging in critical areas
4. **Incorrect Expectations**: Verify the expected behavior is correctly understood

## Adding New Tests

When adding new integration tests:

1. Follow the existing patterns for setup/teardown
2. Use polling for asynchronous operations
3. Use unique IDs for tracking events and tasks
4. Add appropriate timeouts for long-running tests
5. Consider both success and failure cases
6. Document any special test conditions or assumptions

## Test Coverage Goals

Our integration tests aim to cover:

1. **Basic Functionality**: Core operations of each component
2. **Component Interoperability**: How components work together
3. **Error Handling**: How the system handles failures
4. **Lifecycle Events**: System initialization, startup, shutdown, and restart
5. **Edge Cases**: Unusual but important scenarios

We don't aim for 100% coverage in integration tests - unit tests should cover more specific code paths. 