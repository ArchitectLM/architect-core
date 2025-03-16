/**
 * Circuit Breaker Integration Tests
 *
 * These tests verify the integration between different packages in the ArchitectLM framework,
 * specifically focusing on the circuit breaker functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultCircuitBreaker } from '@architectlm/extensions/src/service/circuit-breaker';
import { DefaultServiceIntegration } from '@architectlm/extensions/src/service/service-integration';
import { CircuitBreakerState, ServiceType } from '@architectlm/extensions/src/types/service';
import { createRuntime } from '@architectlm/core/src/runtime';

describe('Circuit Breaker Cross-Package Integration', () => {
  // Mock a delay function for testing timeouts
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Setup for runtime and service integration
  let runtime: any;
  let serviceIntegration: DefaultServiceIntegration;

  beforeEach(async () => {
    // Reset mocks
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Create a real runtime
    runtime = createRuntime();

    // Create service integration with default circuit breaker options
    serviceIntegration = new DefaultServiceIntegration({
      defaultCircuitBreakerOptions: {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenSuccessThreshold: 1,
      },
    });

    // Initialize service integration with runtime
    await serviceIntegration.initialize(runtime);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should integrate circuit breaker with service operations across packages', async () => {
    // Register a payment service with operations
    const paymentService = serviceIntegration.registerService('payment-service', {
      type: ServiceType.REST,
      provider: 'payment-provider',
      config: { baseUrl: 'https://api.payment.example.com' },
      operations: {
        processPayment: vi
          .fn()
          .mockRejectedValueOnce(new Error('Payment service unavailable'))
          .mockRejectedValueOnce(new Error('Payment service unavailable'))
          .mockResolvedValueOnce({ id: 'payment-123', status: 'success' }),
      },
    });

    // Verify circuit breaker was created
    expect(paymentService.circuitBreaker).toBeInstanceOf(DefaultCircuitBreaker);
    expect(paymentService.circuitBreaker?.state).toBe(CircuitBreakerState.CLOSED);

    // First call - should fail but circuit remains closed
    await expect(
      serviceIntegration.executeOperation('payment-service', 'processPayment', { amount: 100 })
    ).rejects.toThrow('Payment service unavailable');

    // Circuit should still be closed after one failure (threshold is 2)
    expect(paymentService.circuitBreaker?.state).toBe(CircuitBreakerState.CLOSED);

    // Second call - should fail and open the circuit
    await expect(
      serviceIntegration.executeOperation('payment-service', 'processPayment', { amount: 100 })
    ).rejects.toThrow('Payment service unavailable');

    // Circuit should be open after second failure
    expect(paymentService.circuitBreaker?.state).toBe(CircuitBreakerState.OPEN);

    // Third call - should fail fast with circuit open error
    await expect(
      serviceIntegration.executeOperation('payment-service', 'processPayment', { amount: 100 })
    ).rejects.toThrow('Circuit breaker is open');

    // Advance time to trigger half-open state
    vi.advanceTimersByTime(1100);

    // Next call after timeout - should succeed and close the circuit
    const result = await serviceIntegration.executeOperation('payment-service', 'processPayment', {
      amount: 100,
    });

    // Verify the result and circuit state
    expect(result).toEqual({ id: 'payment-123', status: 'success' });
    expect(paymentService.circuitBreaker?.state).toBe(CircuitBreakerState.CLOSED);
  });

  it('should support fallback functions when circuit is open', async () => {
    // Create a circuit breaker with custom options
    const circuitBreaker = new DefaultCircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 5000,
    });

    // Register a service with the circuit breaker
    const notificationService = serviceIntegration.registerService('notification-service', {
      type: ServiceType.REST,
      provider: 'notification-provider',
      config: {},
      operations: {
        sendNotification: vi.fn().mockRejectedValue(new Error('Notification service down')),
        getFallbackNotification: vi.fn().mockResolvedValue({
          id: 'fallback-123',
          message: 'This is a fallback notification',
        }),
      },
      circuitBreaker,
    });

    // First call - should fail and open the circuit
    await expect(
      serviceIntegration.executeOperation('notification-service', 'sendNotification', {
        userId: 'user-123',
        message: 'Hello',
      })
    ).rejects.toThrow('Notification service down');

    // Circuit should be open
    expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);

    // Create a wrapper function that uses the fallback
    const sendNotificationWithFallback = async (input: any) => {
      try {
        return await serviceIntegration.executeOperation(
          'notification-service',
          'sendNotification',
          input
        );
      } catch (error) {
        // If circuit is open, use fallback
        if ((error as any)?.message?.includes('Circuit breaker is open')) {
          return serviceIntegration.executeOperation(
            'notification-service',
            'getFallbackNotification',
            input
          );
        }
        throw error;
      }
    };

    // Call with fallback - should use fallback operation
    const result = await sendNotificationWithFallback({
      userId: 'user-123',
      message: 'Hello',
    });

    // Verify fallback was used
    expect(result).toEqual({
      id: 'fallback-123',
      message: 'This is a fallback notification',
    });

    // Circuit should still be open
    expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);
  });

  it('should handle high load scenarios with circuit breaker', async () => {
    // Create a flaky service that fails intermittently
    const flakyOperation = vi.fn().mockImplementation(() => {
      // 30% chance of failure
      if (Math.random() < 0.3) {
        return Promise.reject(new Error('Service temporarily unavailable'));
      }
      return Promise.resolve({ success: true });
    });

    // Register service with circuit breaker
    serviceIntegration.registerService('flaky-service', {
      type: ServiceType.REST,
      provider: 'flaky-provider',
      config: {},
      operations: {
        performAction: flakyOperation,
      },
      circuitBreakerOptions: {
        failureThreshold: 5, // Higher threshold for flaky services
        resetTimeoutMs: 2000,
        halfOpenSuccessThreshold: 2, // Require 2 successes to close circuit
      },
    });

    // Simulate 20 concurrent requests
    const requests = Array(20)
      .fill(0)
      .map((_, i) => {
        return serviceIntegration
          .executeOperation('flaky-service', 'performAction', { id: i })
          .catch(err => ({ error: err.message }));
      });

    // Wait for all requests to complete
    const results = await Promise.all(requests);

    // Count successes and failures
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => r.error).length;

    // We should have some successes and some failures
    expect(successes).toBeGreaterThan(0);
    expect(failures).toBeGreaterThan(0);

    // Get the service to check circuit breaker state
    const service = (serviceIntegration as any).getService('flaky-service');

    // If we had 5 or more failures, circuit should be open
    if (failures >= 5) {
      expect(service.circuitBreaker.state).toBe(CircuitBreakerState.OPEN);
    } else {
      expect(service.circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    }
  });
});
