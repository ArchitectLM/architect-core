/**
 * Tests for the Service Integration Extension
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceIntegration } from './service-integration';
import { ServiceType, ServiceOperation, RetryPolicy } from './types';
import { DefaultCircuitBreaker } from './circuit-breaker';

describe('ServiceIntegration', () => {
  let serviceIntegration: ServiceIntegration;
  let mockRuntime: any;
  
  beforeEach(() => {
    mockRuntime = {
      registerService: vi.fn(),
      emitEvent: vi.fn()
    };
    
    serviceIntegration = new ServiceIntegration();
  });
  
  it('should initialize with default configuration', async () => {
    await serviceIntegration.initialize(mockRuntime);
    
    expect(mockRuntime.registerService).toHaveBeenCalledWith('service-integration', serviceIntegration);
  });
  
  it('should register a service', () => {
    const serviceId = 'payment-service';
    const mockOperation = vi.fn().mockResolvedValue({ id: 'payment-123' });
    
    const serviceConfig = {
      type: 'payment' as ServiceType,
      provider: 'stripe',
      config: {
        apiKey: 'test-key'
      },
      operations: {
        processPayment: mockOperation
      }
    };
    
    const service = serviceIntegration.registerService(serviceId, serviceConfig);
    
    expect(service).toBeDefined();
    expect(service.id).toBe(serviceId);
    expect(service.type).toBe(serviceConfig.type);
    expect(service.provider).toBe(serviceConfig.provider);
    expect(service.config).toEqual(serviceConfig.config);
    expect(service.operations).toEqual(serviceConfig.operations);
    expect(service.retryPolicy).toBeDefined();
  });
  
  it('should execute an operation successfully', async () => {
    const serviceId = 'payment-service';
    const operationName = 'processPayment';
    const input = { amount: 100, currency: 'USD' };
    const expectedOutput = { id: 'payment-123' };
    
    const mockOperation = vi.fn().mockResolvedValue(expectedOutput);
    
    const serviceConfig = {
      type: 'payment' as ServiceType,
      provider: 'stripe',
      config: {
        apiKey: 'test-key'
      },
      operations: {
        [operationName]: mockOperation
      }
    };
    
    serviceIntegration.registerService(serviceId, serviceConfig);
    await serviceIntegration.initialize(mockRuntime);
    
    const result = await serviceIntegration.executeOperation(serviceId, operationName, input);
    
    expect(mockOperation).toHaveBeenCalledWith(input);
    expect(result).toEqual(expectedOutput);
  });
  
  it('should throw error when service is not found', async () => {
    await expect(
      serviceIntegration.executeOperation('non-existent-service', 'operation', {})
    ).rejects.toThrow('Service not found');
  });
  
  it('should throw error when operation is not found', async () => {
    const serviceId = 'payment-service';
    
    const serviceConfig = {
      type: 'payment' as ServiceType,
      provider: 'stripe',
      config: {
        apiKey: 'test-key'
      },
      operations: {}
    };
    
    serviceIntegration.registerService(serviceId, serviceConfig);
    
    await expect(
      serviceIntegration.executeOperation(serviceId, 'non-existent-operation', {})
    ).rejects.toThrow('Operation not found');
  });
  
  it('should use circuit breaker when executing an operation', async () => {
    const serviceId = 'payment-service';
    const operationName = 'processPayment';
    const input = { amount: 100, currency: 'USD' };
    const expectedOutput = { id: 'payment-123' };
    
    const mockOperation = vi.fn().mockResolvedValue(expectedOutput);
    const mockCircuitBreaker = {
      execute: vi.fn().mockImplementation((fn) => fn())
    };
    
    const serviceConfig = {
      type: 'payment' as ServiceType,
      provider: 'stripe',
      config: {
        apiKey: 'test-key'
      },
      operations: {
        [operationName]: mockOperation
      },
      circuitBreakerOptions: {
        failureThreshold: 3,
        resetTimeoutMs: 1000,
        successThreshold: 2
      }
    };
    
    serviceIntegration.registerService(serviceId, serviceConfig);
    await serviceIntegration.initialize(mockRuntime);
    
    const result = await serviceIntegration.executeOperation(serviceId, operationName, input);
    
    expect(mockOperation).toHaveBeenCalledWith(input);
    expect(result).toEqual(expectedOutput);
  });
  
  it('should emit error event when operation fails', async () => {
    const serviceId = 'payment-service';
    const operationName = 'processPayment';
    const input = { amount: 100, currency: 'USD' };
    const error = new Error('Payment failed');
    
    const mockOperation = vi.fn().mockRejectedValue(error);
    
    const serviceConfig = {
      type: 'payment' as ServiceType,
      provider: 'stripe',
      config: {
        apiKey: 'test-key'
      },
      operations: {
        [operationName]: mockOperation
      }
    };
    
    serviceIntegration.registerService(serviceId, serviceConfig);
    await serviceIntegration.initialize(mockRuntime);
    
    await expect(
      serviceIntegration.executeOperation(serviceId, operationName, input)
    ).rejects.toThrow('Payment failed');
    
    expect(mockRuntime.emitEvent).toHaveBeenCalledWith({
      type: `service.${serviceId}.error`,
      payload: {
        operationName,
        input,
        error
      }
    });
  });
  
  it('should register and get webhook handler', () => {
    const serviceId = 'payment-service';
    const webhookConfig = {
      path: '/webhooks/payment',
      secret: 'webhook-secret',
      handlers: {
        'payment.succeeded': vi.fn(),
        'payment.failed': vi.fn()
      }
    };
    
    const handler = serviceIntegration.registerWebhookHandler(serviceId, webhookConfig);
    
    expect(handler).toBeDefined();
    expect(handler.path).toBe(webhookConfig.path);
    expect(handler.secret).toBe(webhookConfig.secret);
    expect(handler.handlers).toEqual(webhookConfig.handlers);
    
    const retrievedHandler = serviceIntegration.getWebhookHandler(serviceId);
    expect(retrievedHandler).toEqual(handler);
  });
  
  it('should process webhook event', async () => {
    const serviceId = 'payment-service';
    const eventType = 'payment.succeeded';
    const eventData = { id: 'payment-123' };
    
    const mockHandler = vi.fn();
    
    const webhookConfig = {
      path: '/webhooks/payment',
      secret: 'webhook-secret',
      handlers: {
        [eventType]: mockHandler
      }
    };
    
    serviceIntegration.registerWebhookHandler(serviceId, webhookConfig);
    await serviceIntegration.initialize(mockRuntime);
    
    await serviceIntegration.processWebhookEvent(serviceId, {
      type: eventType,
      data: eventData
    });
    
    expect(mockHandler).toHaveBeenCalledWith({
      type: eventType,
      data: eventData
    });
    
    expect(mockRuntime.emitEvent).toHaveBeenCalledWith({
      type: `service.${serviceId}.${eventType}`,
      payload: eventData
    });
  });
  
  it('should throw error when webhook handler is not found', async () => {
    await expect(
      serviceIntegration.processWebhookEvent('non-existent-service', {
        type: 'event',
        data: {}
      })
    ).rejects.toThrow('Webhook handler not found');
  });
  
  it('should get service by ID', () => {
    const serviceId = 'payment-service';
    const serviceConfig = {
      type: 'payment' as ServiceType,
      provider: 'stripe',
      config: {
        apiKey: 'test-key'
      },
      operations: {}
    };
    
    const service = serviceIntegration.registerService(serviceId, serviceConfig);
    
    const retrievedService = serviceIntegration.getService(serviceId);
    expect(retrievedService).toEqual(service);
  });
  
  it('should get all services', () => {
    const service1 = serviceIntegration.registerService('payment-service', {
      type: 'payment' as ServiceType,
      provider: 'stripe',
      config: {},
      operations: {}
    });
    
    const service2 = serviceIntegration.registerService('shipping-service', {
      type: 'shipping' as ServiceType,
      provider: 'fedex',
      config: {},
      operations: {}
    });
    
    const allServices = serviceIntegration.getAllServices();
    expect(allServices).toHaveLength(2);
    expect(allServices).toContainEqual(service1);
    expect(allServices).toContainEqual(service2);
  });
}); 