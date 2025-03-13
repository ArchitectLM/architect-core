import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceIntegration, ServiceIntegrationConfig } from './service-integration';
import { createRuntime } from '../runtime';
import { defineSystem } from '../system';
import { EventBus } from '../event-bus';

describe('ServiceIntegrationExtension', () => {
  let serviceIntegration: ServiceIntegration;
  let mockEventBus: EventBus;
  
  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn()
    } as unknown as EventBus;
    
    const config: ServiceIntegrationConfig = {
      enabled: true,
      defaultRetryPolicy: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelayMs: 100
      }
    };
    
    serviceIntegration = new ServiceIntegration(config);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultServiceIntegration = new ServiceIntegration();
      expect(defaultServiceIntegration).toBeDefined();
      expect(defaultServiceIntegration.name).toBe('service-integration');
    });
    
    it('should initialize with custom configuration', () => {
      expect(serviceIntegration).toBeDefined();
      expect(serviceIntegration.name).toBe('service-integration');
    });
    
    it('should register itself as a service when initialized with runtime', async () => {
      const system = defineSystem({
        id: 'test-system',
        name: 'Test System',
        description: 'A test system',
        processes: {},
        tasks: {}
      });
      
      const runtime = createRuntime(system);
      runtime.registerService = vi.fn();
      
      await serviceIntegration.initialize(runtime);
      
      expect(runtime.registerService).toHaveBeenCalledWith('service-integration', serviceIntegration);
    });
  });
  
  describe('Service Registration', () => {
    it('should register a payment service', () => {
      const paymentService = serviceIntegration.registerService('payment', {
        type: 'payment-processor',
        provider: 'stripe',
        config: {
          apiKey: 'test-api-key',
          webhookSecret: 'test-webhook-secret'
        }
      });
      
      expect(paymentService).toBeDefined();
      expect(paymentService.id).toBe('payment');
      expect(paymentService.type).toBe('payment-processor');
      expect(paymentService.provider).toBe('stripe');
    });
    
    it('should register a shipping service', () => {
      const shippingService = serviceIntegration.registerService('shipping', {
        type: 'shipping-provider',
        provider: 'fedex',
        config: {
          accountNumber: 'test-account',
          apiKey: 'test-api-key'
        }
      });
      
      expect(shippingService).toBeDefined();
      expect(shippingService.id).toBe('shipping');
      expect(shippingService.type).toBe('shipping-provider');
      expect(shippingService.provider).toBe('fedex');
    });
    
    it('should register a tax service', () => {
      const taxService = serviceIntegration.registerService('tax', {
        type: 'tax-calculator',
        provider: 'avatax',
        config: {
          accountId: 'test-account',
          licenseKey: 'test-license'
        }
      });
      
      expect(taxService).toBeDefined();
      expect(taxService.id).toBe('tax');
      expect(taxService.type).toBe('tax-calculator');
      expect(taxService.provider).toBe('avatax');
    });
  });
  
  describe('Service Operations', () => {
    it('should execute a payment service operation', async () => {
      // Register a payment service
      const paymentService = serviceIntegration.registerService('payment', {
        type: 'payment-processor',
        provider: 'stripe',
        config: {
          apiKey: 'test-api-key'
        },
        operations: {
          createPayment: vi.fn().mockResolvedValue({
            id: 'payment-123',
            status: 'succeeded',
            amount: 1000
          })
        }
      });
      
      // Execute the operation
      const result = await serviceIntegration.executeOperation('payment', 'createPayment', {
        amount: 1000,
        currency: 'usd',
        paymentMethod: 'card'
      });
      
      // Verify the result
      expect(result).toEqual({
        id: 'payment-123',
        status: 'succeeded',
        amount: 1000
      });
      
      // Verify the operation was called
      expect(paymentService.operations.createPayment).toHaveBeenCalledWith({
        amount: 1000,
        currency: 'usd',
        paymentMethod: 'card'
      });
    });
    
    it('should handle errors from service operations', async () => {
      // Register a service with an operation that throws an error
      serviceIntegration.registerService('payment', {
        type: 'payment-processor',
        provider: 'stripe',
        config: {
          apiKey: 'test-api-key'
        },
        operations: {
          createPayment: vi.fn().mockRejectedValue(new Error('Payment failed'))
        }
      });
      
      // Execute the operation and expect it to throw
      await expect(
        serviceIntegration.executeOperation('payment', 'createPayment', {
          amount: 1000,
          currency: 'usd'
        })
      ).rejects.toThrow('Payment failed');
    });
    
    it('should retry failed operations according to retry policy', async () => {
      // Create a mock operation that fails the first two times
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ id: 'payment-123', status: 'succeeded' });
      
      // Register a service with the mock operation
      serviceIntegration.registerService('payment', {
        type: 'payment-processor',
        provider: 'stripe',
        config: {
          apiKey: 'test-api-key'
        },
        operations: {
          createPayment: mockOperation
        },
        retryPolicy: {
          maxAttempts: 3,
          backoff: 'fixed',
          initialDelayMs: 10 // Small delay for testing
        }
      });
      
      // Execute the operation
      const result = await serviceIntegration.executeOperation('payment', 'createPayment', {
        amount: 1000,
        currency: 'usd'
      });
      
      // Verify the result
      expect(result).toEqual({ id: 'payment-123', status: 'succeeded' });
      
      // Verify the operation was called multiple times
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('Webhook Handling', () => {
    it('should register a webhook handler', () => {
      // Register a webhook handler
      serviceIntegration.registerWebhookHandler('payment', {
        path: '/webhooks/payment',
        secret: 'test-webhook-secret',
        handlers: {
          'payment.succeeded': vi.fn(),
          'payment.failed': vi.fn()
        }
      });
      
      // Verify the webhook handler was registered
      expect(serviceIntegration.getWebhookHandler('payment')).toBeDefined();
    });
    
    it('should process webhook events', async () => {
      // Create mock handlers
      const paymentSucceededHandler = vi.fn();
      const paymentFailedHandler = vi.fn();
      
      // Register a webhook handler
      serviceIntegration.registerWebhookHandler('payment', {
        path: '/webhooks/payment',
        secret: 'test-webhook-secret',
        handlers: {
          'payment.succeeded': paymentSucceededHandler,
          'payment.failed': paymentFailedHandler
        }
      });
      
      // Process a webhook event
      await serviceIntegration.processWebhookEvent('payment', {
        type: 'payment.succeeded',
        data: {
          id: 'payment-123',
          amount: 1000
        }
      });
      
      // Verify the handler was called
      expect(paymentSucceededHandler).toHaveBeenCalledWith({
        type: 'payment.succeeded',
        data: {
          id: 'payment-123',
          amount: 1000
        }
      });
      
      // Verify the other handler was not called
      expect(paymentFailedHandler).not.toHaveBeenCalled();
    });
  });
  
  describe('DSL Integration', () => {
    it('should create a service using the DSL', () => {
      // Create a service using the DSL
      const paymentService = ServiceIntegration.Service.create('payment')
        .withType('payment-processor')
        .withProvider('stripe')
        .withConfig({
          apiKey: 'test-api-key',
          webhookSecret: 'test-webhook-secret'
        })
        .withOperation('createPayment', async (input) => {
          return { id: 'payment-123', status: 'succeeded' };
        })
        .withOperation('capturePayment', async (input) => {
          return { id: 'payment-123', status: 'captured' };
        })
        .withWebhookHandler({
          path: '/webhooks/stripe',
          secret: 'test-webhook-secret',
          handlers: {
            'payment.succeeded': (event) => {
              // Handle payment succeeded event
            },
            'payment.failed': (event) => {
              // Handle payment failed event
            }
          }
        })
        .build();
      
      // Verify the service was created correctly
      expect(paymentService).toBeDefined();
      expect(paymentService.id).toBe('payment');
      expect(paymentService.type).toBe('payment-processor');
      expect(paymentService.provider).toBe('stripe');
      expect(paymentService.operations.createPayment).toBeDefined();
      expect(paymentService.operations.capturePayment).toBeDefined();
      expect(paymentService.webhookHandler).toBeDefined();
    });
  });
  
  describe('E-commerce Integration Examples', () => {
    it('should integrate with Stripe for payments', async () => {
      // Mock Stripe API calls
      const mockStripeApi = {
        paymentIntents: {
          create: vi.fn().mockResolvedValue({
            id: 'pi_123',
            status: 'succeeded',
            amount: 1000,
            currency: 'usd'
          }),
          capture: vi.fn().mockResolvedValue({
            id: 'pi_123',
            status: 'succeeded',
            amount: 1000,
            currency: 'usd'
          })
        }
      };
      
      // Register a Stripe service
      const stripeService = serviceIntegration.registerService('stripe', {
        type: 'payment-processor',
        provider: 'stripe',
        config: {
          apiKey: 'test-api-key'
        },
        operations: {
          createPayment: async (input) => {
            return mockStripeApi.paymentIntents.create({
              amount: input.amount,
              currency: input.currency,
              payment_method: input.paymentMethodId,
              confirm: true
            });
          },
          capturePayment: async (input) => {
            return mockStripeApi.paymentIntents.capture(input.paymentIntentId);
          }
        }
      });
      
      // Execute the createPayment operation
      const paymentResult = await serviceIntegration.executeOperation('stripe', 'createPayment', {
        amount: 1000,
        currency: 'usd',
        paymentMethodId: 'pm_123'
      });
      
      // Verify the result
      expect(paymentResult).toEqual({
        id: 'pi_123',
        status: 'succeeded',
        amount: 1000,
        currency: 'usd'
      });
      
      // Verify the Stripe API was called
      expect(mockStripeApi.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1000,
        currency: 'usd',
        payment_method: 'pm_123',
        confirm: true
      });
    });
    
    it('should integrate with FedEx for shipping', async () => {
      // Mock FedEx API calls
      const mockFedExApi = {
        shipments: {
          create: vi.fn().mockResolvedValue({
            shipmentId: 'ship_123',
            trackingNumber: '123456789',
            labelUrl: 'https://fedex.com/label/123456789.pdf'
          }),
          track: vi.fn().mockResolvedValue({
            trackingNumber: '123456789',
            status: 'in_transit',
            estimatedDelivery: '2023-07-15'
          })
        }
      };
      
      // Register a FedEx service
      const fedexService = serviceIntegration.registerService('fedex', {
        type: 'shipping-provider',
        provider: 'fedex',
        config: {
          accountNumber: 'test-account',
          apiKey: 'test-api-key'
        },
        operations: {
          createShipment: async (input) => {
            return mockFedExApi.shipments.create({
              recipients: input.recipients,
              packages: input.packages
            });
          },
          trackShipment: async (input) => {
            return mockFedExApi.shipments.track(input.trackingNumber);
          }
        }
      });
      
      // Execute the createShipment operation
      const shipmentResult = await serviceIntegration.executeOperation('fedex', 'createShipment', {
        recipients: [{
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zip: '94105',
            country: 'US'
          }
        }],
        packages: [{
          weight: {
            value: 2,
            units: 'LB'
          },
          dimensions: {
            length: 10,
            width: 8,
            height: 6,
            units: 'IN'
          }
        }]
      });
      
      // Verify the result
      expect(shipmentResult).toEqual({
        shipmentId: 'ship_123',
        trackingNumber: '123456789',
        labelUrl: 'https://fedex.com/label/123456789.pdf'
      });
      
      // Verify the FedEx API was called
      expect(mockFedExApi.shipments.create).toHaveBeenCalledWith({
        recipients: [{
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zip: '94105',
            country: 'US'
          }
        }],
        packages: [{
          weight: {
            value: 2,
            units: 'LB'
          },
          dimensions: {
            length: 10,
            width: 8,
            height: 6,
            units: 'IN'
          }
        }]
      });
    });
  });
}); 