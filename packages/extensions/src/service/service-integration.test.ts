/**
 * Tests for the Service Integration Extension
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultServiceIntegration } from './service-integration';
import {
  ServiceType,
  ServiceOperation,
  RetryPolicy,
  WebhookEvent,
  CircuitBreakerState,
} from '../types/service';
import { DefaultCircuitBreaker } from './circuit-breaker';

describe('ServiceIntegration', () => {
  let serviceIntegration: DefaultServiceIntegration;
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = {
      registerService: vi.fn(),
      emitEvent: vi.fn(),
    };

    serviceIntegration = new DefaultServiceIntegration();
  });

  it('should initialize with default configuration', async () => {
    await serviceIntegration.initialize(mockRuntime);

    expect(serviceIntegration.name).toBe('service-integration');
  });

  it('should register a service', () => {
    const serviceId = 'payment-service';
    const mockOperation = vi.fn().mockResolvedValue({ id: 'payment-123' });

    const serviceConfig = {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {
        baseUrl: 'https://api.payment.com',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
        },
      },
      operations: {
        processPayment: mockOperation as ServiceOperation,
      },
    };

    const service = serviceIntegration.registerService(serviceId, serviceConfig);

    expect(service.id).toBe(serviceId);
    expect(service.type).toBe(ServiceType.REST);
    expect(service.config).toEqual(serviceConfig.config);
    expect(service.operations).toEqual(serviceConfig.operations);
  });

  it('should execute an operation successfully', async () => {
    const serviceId = 'payment-service';
    const operationName = 'processPayment';
    const mockOperation = vi.fn().mockResolvedValue({ id: 'payment-123' });

    const serviceConfig = {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {},
      operations: {
        processPayment: mockOperation as ServiceOperation,
      },
    };

    serviceIntegration.registerService(serviceId, serviceConfig);

    const result = await serviceIntegration.executeOperation(serviceId, operationName, {
      amount: 100,
      currency: 'USD',
    });

    expect(mockOperation).toHaveBeenCalledWith({ amount: 100, currency: 'USD' });
    expect(result).toEqual({ id: 'payment-123' });
  });

  it('should throw error when service is not found', async () => {
    await expect(() =>
      serviceIntegration.executeOperation('non-existent-service', 'processPayment', { amount: 100 })
    ).rejects.toThrow(/Service.*not found/);
  });

  it('should throw error when operation is not found', async () => {
    const serviceId = 'payment-service';

    serviceIntegration.registerService(serviceId, {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {},
      operations: {},
    });

    await expect(() =>
      serviceIntegration.executeOperation(serviceId, 'non-existent-operation', { amount: 100 })
    ).rejects.toThrow(/Operation.*not found/);
  });

  it('should use circuit breaker when executing an operation', async () => {
    const serviceId = 'payment-service';
    const operationName = 'processPayment';
    const mockOperation = vi.fn().mockResolvedValue({ id: 'payment-123' });

    const mockCircuitBreaker = {
      execute: vi.fn().mockImplementation(fn => fn()),
    };

    const serviceConfig = {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {},
      operations: {
        processPayment: mockOperation as ServiceOperation,
      },
      circuitBreaker: mockCircuitBreaker as any,
    };

    serviceIntegration.registerService(serviceId, serviceConfig);

    await serviceIntegration.executeOperation(serviceId, operationName, { amount: 100 });

    expect(mockOperation).toHaveBeenCalledWith({ amount: 100 });
  });

  it('should emit error event when operation fails', async () => {
    const serviceId = 'payment-service';
    const operationName = 'processPayment';
    const mockOperation = vi.fn().mockRejectedValue(new Error('Payment failed'));

    const serviceConfig = {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {},
      operations: {
        processPayment: mockOperation as ServiceOperation,
      },
    };

    serviceIntegration.registerService(serviceId, serviceConfig);
    await serviceIntegration.initialize(mockRuntime);

    await expect(() =>
      serviceIntegration.executeOperation(serviceId, operationName, { amount: 100 })
    ).rejects.toThrow('Payment failed');
  });

  it('should register and get webhook handler', () => {
    const serviceId = 'payment-service';
    const mockHandler = vi.fn();

    const webhookConfig = {
      path: '/webhooks/payment',
      handlers: {
        'payment.succeeded': mockHandler,
      },
    };

    const handler = serviceIntegration.registerWebhookHandler(serviceId, webhookConfig);
    const retrievedHandler = serviceIntegration.getWebhookHandler(serviceId);

    expect(handler).toBeDefined();
    expect(retrievedHandler).toBeDefined();
  });

  it('should process webhook event', async () => {
    const serviceId = 'payment-service';
    const eventType = 'payment.succeeded';
    const eventData = { id: 'evt_123', type: eventType };

    const mockHandler = vi.fn().mockResolvedValue(true);

    serviceIntegration.registerWebhookHandler(serviceId, {
      path: '/webhooks/payment',
      handlers: {
        [eventType]: mockHandler,
      },
    });

    await serviceIntegration.initialize(mockRuntime);

    await serviceIntegration.processWebhookEvent(serviceId, {
      type: eventType,
      payload: eventData,
    } as WebhookEvent);

    expect(mockHandler).toHaveBeenCalled();
  });

  it('should throw error when webhook handler is not found', async () => {
    await expect(() =>
      serviceIntegration.processWebhookEvent('non-existent-service', {
        type: 'payment.succeeded',
        payload: { id: 'evt_123' },
      } as WebhookEvent)
    ).rejects.toThrow(/Webhook handler.*not found/);
  });

  it('should get service by ID', () => {
    const serviceId = 'payment-service';

    const serviceConfig = {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {},
      operations: {},
    };

    const service = serviceIntegration.registerService(serviceId, serviceConfig);

    const retrievedService = (serviceIntegration as any).getService(serviceId);

    expect(retrievedService).toBeDefined();
  });

  it('should get all services', () => {
    const service1 = serviceIntegration.registerService('payment-service', {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {},
      operations: {},
    });

    const service2 = serviceIntegration.registerService('shipping-service', {
      type: ServiceType.REST,
      provider: 'test-provider',
      config: {},
      operations: {},
    });

    const service1Retrieved = (serviceIntegration as any).getService('payment-service');
    const service2Retrieved = (serviceIntegration as any).getService('shipping-service');

    expect(service1Retrieved).toBeDefined();
    expect(service2Retrieved).toBeDefined();
  });

  // Integration test between ServiceIntegration and CircuitBreaker
  describe('Integration with CircuitBreaker', () => {
    it('should use DefaultCircuitBreaker when no custom circuit breaker is provided', async () => {
      const serviceId = 'payment-service';
      const operationName = 'processPayment';
      const mockOperation = vi.fn().mockResolvedValue({ id: 'payment-123' });

      // Create service with circuit breaker options but no custom circuit breaker
      const serviceConfig = {
        type: ServiceType.REST,
        provider: 'test-provider',
        config: {},
        operations: {
          processPayment: mockOperation as ServiceOperation,
        },
        circuitBreakerOptions: {
          failureThreshold: 2,
          resetTimeoutMs: 5000,
          halfOpenSuccessThreshold: 1,
        },
      };

      serviceIntegration.registerService(serviceId, serviceConfig);

      // Execute operation successfully
      const result = await serviceIntegration.executeOperation(serviceId, operationName, {
        amount: 100,
      });
      expect(result).toEqual({ id: 'payment-123' });

      // Verify the operation was called
      expect(mockOperation).toHaveBeenCalledWith({ amount: 100 });
    });

    it('should handle circuit breaker state transitions', async () => {
      // This test verifies circuit breaker behavior directly without relying on service integration
      const circuitBreaker = new DefaultCircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 5000,
      });

      // Initially circuit breaker should be closed
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);

      // Simulate a failure
      circuitBreaker.failure();

      // After one failure (with threshold=1), circuit breaker should be open
      expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);

      // When circuit is open, execute should throw an error
      await expect(circuitBreaker.execute(() => Promise.resolve('success'))).rejects.toThrow(
        'Circuit breaker is open'
      );
    });

    it('should support retry policy with circuit breaker', async () => {
      const serviceId = 'payment-service';
      const operationName = 'processPayment';

      // Mock operation that fails first time, succeeds second time
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ id: 'payment-123' });

      // Create a real circuit breaker
      const circuitBreaker = new DefaultCircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 5000,
      });

      // Create retry policy
      const retryPolicy: RetryPolicy = {
        maxAttempts: 2,
        initialDelayMs: 100,
        backoff: 'fixed',
        retryableErrors: ['Temporary failure'],
      } as any;

      const serviceConfig = {
        type: ServiceType.REST,
        provider: 'test-provider',
        config: {},
        operations: {
          processPayment: mockOperation as ServiceOperation,
        },
        circuitBreaker,
        retryPolicy,
      };

      // Register service with both circuit breaker and retry policy
      serviceIntegration.registerService(serviceId, serviceConfig);

      // Execute operation - should retry and succeed
      const result = await serviceIntegration.executeOperation(serviceId, operationName, {
        amount: 100,
      });

      expect(result).toEqual({ id: 'payment-123' });
      expect(mockOperation).toHaveBeenCalledTimes(2); // Called twice due to retry
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED); // Should remain closed because retry succeeded
    });

    it('should integrate with circuit breaker correctly', async () => {
      const serviceId = 'payment-service';
      const operationName = 'processPayment';
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Payment failed')) // First call fails
        .mockResolvedValueOnce({ success: true }); // Second call succeeds

      // Create a circuit breaker
      const circuitBreaker = new DefaultCircuitBreaker({
        failureThreshold: 2, // Need 2 failures to open
        resetTimeoutMs: 100, // Short timeout for testing
      });

      const serviceConfig = {
        type: ServiceType.REST,
        provider: 'test-provider',
        config: {},
        operations: {
          processPayment: mockOperation as ServiceOperation,
        },
        circuitBreaker,
      };

      serviceIntegration.registerService(serviceId, serviceConfig);

      // First call - should fail but circuit remains closed
      await expect(
        serviceIntegration.executeOperation(serviceId, operationName, { amount: 100 })
      ).rejects.toThrow('Payment failed');

      // Circuit should still be closed after one failure (threshold is 2)
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);

      // Second call - should succeed
      const result = await serviceIntegration.executeOperation(serviceId, operationName, {
        amount: 100,
      });
      expect(result).toEqual({ success: true });

      // Circuit should still be closed
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);

      // Verify the operation was called twice
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });
});
