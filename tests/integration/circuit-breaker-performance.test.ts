/**
 * Circuit Breaker Performance Tests
 *
 * These tests evaluate the performance of the circuit breaker under high load conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultCircuitBreaker } from '@architectlm/extensions/src/service/circuit-breaker';
import { CircuitBreakerState } from '@architectlm/extensions/src/types/service';

describe('Circuit Breaker Performance', () => {
  let circuitBreaker: DefaultCircuitBreaker;

  beforeEach(() => {
    // Create a circuit breaker with standard settings
    circuitBreaker = new DefaultCircuitBreaker({
      failureThreshold: 50,
      resetTimeoutMs: 1000,
      halfOpenSuccessThreshold: 5,
    });
  });

  afterEach(() => {
    // Clean up
  });

  /**
   * Helper function to measure execution time
   */
  const measureExecutionTime = async (fn: () => Promise<any>): Promise<number> => {
    const start = performance.now();
    await fn();
    const end = performance.now();
    return end - start;
  };

  it('should handle a high volume of successful requests efficiently', async () => {
    // Create a successful operation
    const successOperation = () => Promise.resolve({ success: true });

    // Execute the operation 1000 times
    const executionTime = await measureExecutionTime(async () => {
      const promises = Array(1000)
        .fill(0)
        .map(() => circuitBreaker.execute(successOperation));
      await Promise.all(promises);
    });

    // Log the execution time
    console.log(`Executed 1000 successful operations in ${executionTime.toFixed(2)}ms`);

    // Circuit should remain closed
    expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);

    // Average time per operation should be reasonable
    // This is a flexible assertion as performance can vary by environment
    const avgTimePerOperation = executionTime / 1000;
    console.log(`Average time per operation: ${avgTimePerOperation.toFixed(2)}ms`);

    // We expect operations to be very fast (typically < 1ms per op)
    // but we use a generous threshold to avoid flaky tests
    expect(avgTimePerOperation).toBeLessThan(5);
  });

  it('should handle a high volume of failing requests efficiently', async () => {
    // Create a failing operation
    const failOperation = () => Promise.reject(new Error('Operation failed'));

    // Execute the operation 100 times (fewer than success test as failures are slower)
    const executionTime = await measureExecutionTime(async () => {
      const promises = Array(100)
        .fill(0)
        .map(() => circuitBreaker.execute(failOperation).catch(() => {}));
      await Promise.all(promises);
    });

    // Log the execution time
    console.log(`Executed 100 failing operations in ${executionTime.toFixed(2)}ms`);

    // Circuit should be open after 50 failures
    expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);

    // Average time per operation should be reasonable
    const avgTimePerOperation = executionTime / 100;
    console.log(`Average time per failing operation: ${avgTimePerOperation.toFixed(2)}ms`);

    // Failing operations are typically slower, but still should be reasonably fast
    expect(avgTimePerOperation).toBeLessThan(10);
  });

  it('should efficiently reject requests when circuit is open', async () => {
    // First, open the circuit
    const failOperation = () => Promise.reject(new Error('Operation failed'));

    // Cause enough failures to open the circuit
    for (let i = 0; i < 50; i++) {
      await circuitBreaker.execute(failOperation).catch(() => {});
    }

    // Verify circuit is open
    expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);

    // Now measure performance of rejected requests
    const executionTime = await measureExecutionTime(async () => {
      const promises = Array(1000)
        .fill(0)
        .map(() => circuitBreaker.execute(() => Promise.resolve('success')).catch(() => {}));
      await Promise.all(promises);
    });

    // Log the execution time
    console.log(`Rejected 1000 operations (circuit open) in ${executionTime.toFixed(2)}ms`);

    // Average time per rejection should be very fast
    const avgTimePerRejection = executionTime / 1000;
    console.log(`Average time per rejection: ${avgTimePerRejection.toFixed(2)}ms`);

    // Rejections should be extremely fast (typically < 0.1ms)
    // but we use a generous threshold to avoid flaky tests
    expect(avgTimePerRejection).toBeLessThan(1);
  });

  it('should handle mixed success/failure patterns efficiently', async () => {
    // Create an operation that fails 30% of the time
    const mixedOperation = () => {
      if (Math.random() < 0.3) {
        return Promise.reject(new Error('Random failure'));
      }
      return Promise.resolve({ success: true });
    };

    // Execute the operation 500 times
    const executionTime = await measureExecutionTime(async () => {
      const promises = Array(500)
        .fill(0)
        .map(() => circuitBreaker.execute(mixedOperation).catch(() => {}));
      await Promise.all(promises);
    });

    // Log the execution time
    console.log(`Executed 500 mixed operations in ${executionTime.toFixed(2)}ms`);

    // Average time per operation
    const avgTimePerOperation = executionTime / 500;
    console.log(`Average time per mixed operation: ${avgTimePerOperation.toFixed(2)}ms`);

    // Mixed operations should still be reasonably fast
    expect(avgTimePerOperation).toBeLessThan(5);
  });

  it('should perform well under concurrent load with state transitions', async () => {
    // Create a flaky operation that improves over time
    let failureRate = 0.8; // Start with high failure rate

    const improvingOperation = () => {
      // Gradually improve success rate
      failureRate = Math.max(0, failureRate - 0.01);

      if (Math.random() < failureRate) {
        return Promise.reject(new Error('Service improving but still failing'));
      }
      return Promise.resolve({ success: true });
    };

    // Execute in 5 batches to allow for state transitions
    let totalExecutionTime = 0;
    let totalOperations = 0;
    let batchSize = 100;

    for (let batch = 0; batch < 5; batch++) {
      const executionTime = await measureExecutionTime(async () => {
        const promises = Array(batchSize)
          .fill(0)
          .map(() => circuitBreaker.execute(improvingOperation).catch(() => ({ error: true })));
        await Promise.all(promises);
      });

      totalExecutionTime += executionTime;
      totalOperations += batchSize;

      console.log(
        `Batch ${batch + 1}: Executed ${batchSize} operations in ${executionTime.toFixed(2)}ms`
      );
      console.log(`Current circuit state: ${circuitBreaker.state}`);
    }

    // Log overall performance
    console.log(
      `Total: Executed ${totalOperations} operations in ${totalExecutionTime.toFixed(2)}ms`
    );
    console.log(
      `Overall average time per operation: ${(totalExecutionTime / totalOperations).toFixed(2)}ms`
    );

    // Overall performance should be reasonable
    expect(totalExecutionTime / totalOperations).toBeLessThan(10);
  });
});
