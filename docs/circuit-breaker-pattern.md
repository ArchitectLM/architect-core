# Circuit Breaker Pattern

## Overview

The Circuit Breaker pattern is a design pattern used in modern software development to prevent cascading failures in distributed systems. It's named after the electrical circuit breaker, which stops the flow of electricity when a fault is detected to prevent damage or fire.

In software systems, the Circuit Breaker pattern:

- Detects when a remote service or resource is failing
- Prevents the application from repeatedly trying to execute an operation that's likely to fail
- Allows the application to continue operating without waiting for the failing service
- Automatically recovers when the service becomes available again

## States

The Circuit Breaker has three distinct states:

1. **CLOSED** - In this state, the circuit breaker allows requests to pass through to the service. This is the normal operation state. The circuit breaker monitors the failure rate and will transition to the OPEN state if the failure threshold is reached.

2. **OPEN** - In this state, the circuit breaker immediately rejects requests without attempting to call the service. This prevents further load on the failing service and allows it time to recover. After a configured timeout period, the circuit breaker transitions to the HALF-OPEN state.

3. **HALF-OPEN** - In this state, the circuit breaker allows a limited number of test requests to pass through to the service. If these requests succeed, the circuit breaker transitions back to the CLOSED state. If any request fails, it transitions back to the OPEN state.

## Implementation in ArchitectLM

The ArchitectLM framework provides a robust implementation of the Circuit Breaker pattern in the `@architectlm/extensions` package.

### Key Components

1. **DefaultCircuitBreaker** - The main implementation of the Circuit Breaker pattern.
2. **CircuitBreakerMetrics** - A component that collects and provides metrics about circuit breaker operations.
3. **ServiceIntegration** - A service that uses circuit breakers to protect calls to external services.

### Configuration Options

The Circuit Breaker can be configured with the following options:

- **failureThreshold** - The number of consecutive failures required to open the circuit.
- **resetTimeoutMs** - The time in milliseconds to wait before transitioning from OPEN to HALF-OPEN.
- **halfOpenSuccessThreshold** - The number of consecutive successful calls required in HALF-OPEN state to close the circuit.
- **id** - An optional identifier for the circuit breaker, useful for metrics and logging.

### Metrics and Monitoring

The Circuit Breaker implementation includes comprehensive metrics collection:

- **State transitions** - Records when the circuit breaker changes state.
- **Execution metrics** - Records details about each execution, including duration, success/failure, and error information.
- **Performance metrics** - Tracks average execution time, failure rates, and time spent in each state.

### Fallback Mechanisms

When a circuit is open, you can provide fallback mechanisms:

1. **Fallback functions** - Alternative implementations that can be called when the primary function fails.
2. **Cached responses** - Return cached data instead of calling the failing service.
3. **Default values** - Return sensible defaults when the service is unavailable.

## Usage Examples

### Basic Usage

```typescript
import { DefaultCircuitBreaker } from '@architectlm/extensions';

// Create a circuit breaker
const circuitBreaker = new DefaultCircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 10000,
  halfOpenSuccessThreshold: 2,
});

// Execute a function with circuit breaker protection
try {
  const result = await circuitBreaker.execute(async () => {
    // Call to external service
    return await externalService.getData();
  });

  // Process the result
  console.log('Success:', result);
} catch (error) {
  console.error('Operation failed:', error);
}
```

### With Fallback

```typescript
import { DefaultCircuitBreaker } from '@architectlm/extensions';

// Create a circuit breaker
const circuitBreaker = new DefaultCircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 10000,
});

// Main function
const getData = async () => {
  return await externalService.getData();
};

// Fallback function
const getFallbackData = async () => {
  return { status: 'fallback', data: cachedData };
};

// Execute with fallback
const result = await circuitBreaker.execute(getData, getFallbackData);
```

### With Metrics

```typescript
import { DefaultCircuitBreaker } from '@architectlm/extensions';

// Create a circuit breaker with metrics
const circuitBreaker = new DefaultCircuitBreaker(
  {
    id: 'payment-service',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  },
  console,
  {
    enableDetailedMetrics: true,
    stateChangeCallback: event => {
      console.log(`Circuit breaker state changed: ${event.previousState} -> ${event.newState}`);
    },
  }
);

// Execute operations
await circuitBreaker.execute(() => paymentService.processPayment(payment), null, 'processPayment');

// Get metrics
const metrics = circuitBreaker.getMetrics();
console.log(`Total executions: ${metrics.totalExecutions}`);
console.log(`Success rate: ${(1 - metrics.failureRate) * 100}%`);
console.log(`Average execution time: ${metrics.averageExecutionTime}ms`);
```

### Integration with Services

```typescript
import { DefaultServiceIntegration } from '@architectlm/extensions';

// Create service integration with circuit breaker
const serviceIntegration = new DefaultServiceIntegration({
  defaultCircuitBreakerOptions: {
    failureThreshold: 3,
    resetTimeoutMs: 10000,
  },
});

// Register a service
serviceIntegration.registerService('payment-service', {
  type: 'rest',
  provider: 'payment-provider',
  config: { baseUrl: 'https://api.payment.example.com' },
  operations: {
    processPayment: async payment => {
      // Implementation
    },
  },
});

// Execute an operation (protected by circuit breaker)
const result = await serviceIntegration.executeOperation('payment-service', 'processPayment', {
  amount: 100,
  currency: 'USD',
});
```

## Best Practices

1. **Choose appropriate thresholds** - Set failure thresholds based on the expected reliability of the service. Critical services might need higher thresholds.

2. **Use appropriate timeouts** - Set reset timeouts based on how long you expect the service to take to recover.

3. **Implement fallbacks** - Always provide fallback mechanisms for critical operations.

4. **Monitor circuit breaker metrics** - Use the metrics to identify problematic services and optimize thresholds.

5. **Log state transitions** - Log when circuit breakers open and close to help with troubleshooting.

6. **Use different circuit breakers for different operations** - Different operations might have different reliability characteristics.

7. **Consider bulkhead patterns** - Use circuit breakers in conjunction with bulkhead patterns to isolate failures.

## Retry Policies and Circuit Breakers

The ArchitectLM framework allows you to combine circuit breakers with retry policies:

```typescript
import { DefaultServiceIntegration } from '@architectlm/extensions';

// Create service integration
const serviceIntegration = new DefaultServiceIntegration();

// Register a service with both circuit breaker and retry policy
serviceIntegration.registerService('payment-service', {
  type: 'rest',
  provider: 'payment-provider',
  config: { baseUrl: 'https://api.payment.example.com' },
  operations: {
    processPayment: async payment => {
      // Implementation
    },
  },
  circuitBreakerOptions: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  },
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoff: 'exponential',
    factor: 2,
  },
});
```

When combining retry policies with circuit breakers:

1. The retry policy will attempt to retry failed operations up to the maximum number of attempts.
2. Each failure contributes to the circuit breaker's failure count.
3. If the circuit breaker opens, no further retries will be attempted.

## Performance Considerations

The Circuit Breaker pattern can have performance implications:

1. **Memory usage** - Storing metrics and state history consumes memory.
2. **CPU overhead** - Tracking metrics adds some CPU overhead.
3. **Latency** - The circuit breaker adds a small amount of latency to each call.

However, these costs are typically negligible compared to the benefits:

1. **Preventing cascading failures** - Stops failures from propagating through the system.
2. **Reducing load on failing services** - Gives failing services time to recover.
3. **Improving user experience** - Fails fast instead of making users wait for timeouts.

## Conclusion

The Circuit Breaker pattern is an essential tool for building resilient distributed systems. The ArchitectLM framework provides a comprehensive implementation with metrics, fallbacks, and integration with service calls.

By using circuit breakers, you can build systems that gracefully handle failures in external dependencies and provide a better experience for your users.
