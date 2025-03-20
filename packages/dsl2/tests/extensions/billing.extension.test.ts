import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the billing extension module
vi.mock('../../src/extensions/billing.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/billing.extension.js');
  return {
    ...actual,
    setupBillingExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupBillingExtension, 
  BillingExtensionOptions
} from '../../src/extensions/billing.extension.js';

describe('Billing Extension', () => {
  let dsl: DSL;
  let billingOptions: BillingExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    billingOptions = {
      defaultProvider: 'stripe',
      currency: 'USD',
      taxConfiguration: {
        enabled: true,
        rates: {
          default: 0.0
        }
      }
    };
    
    // Setup extension
    setupBillingExtension(dsl, billingOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Billing Configuration', () => {
    it('should add billing configuration to system definitions', () => {
      // Define a system component with billing
      const system = dsl.system('SubscriptionSystem', {
        description: 'Subscription-based SaaS system',
        version: '1.0.0',
        components: {
          schemas: [],
          commands: []
        },
        billing: {
          provider: { ref: 'StripeBillingPlugin' },
          plans: [
            { id: 'basic', features: ['standard-orders', 'basic-analytics'] },
            { id: 'pro', features: ['express-shipping', 'advanced-analytics', 'bulk-orders'] }
          ],
          metering: {
            dimensions: ['order-count', 'storage-usage', 'api-calls']
          }
        }
      });
      
      // Extension should process and validate the billing configuration
      expect(system.billing).toBeDefined();
      expect(system.billing.provider.ref).toBe('StripeBillingPlugin');
      expect(system.billing.plans).toHaveLength(2);
      expect(system.billing.plans[0].id).toBe('basic');
      expect(system.billing.plans[1].id).toBe('pro');
      expect(system.billing.plans[1].features).toContain('advanced-analytics');
      expect(system.billing.metering.dimensions).toContain('order-count');
    });
    
    it('should support different billing providers', () => {
      // Define a system with custom billing provider
      const customBillingSystem = dsl.system('CustomBillingSystem', {
        description: 'System with custom billing provider',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        billing: {
          provider: { ref: 'CustomBillingProvider' },
          plans: [
            { id: 'basic', features: ['feature-1', 'feature-2'] }
          ]
        }
      });
      
      expect(customBillingSystem.billing.provider.ref).toBe('CustomBillingProvider');
      
      // Define a system with another billing provider
      const paypalSystem = dsl.system('PaypalSystem', {
        description: 'System with PayPal billing',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        billing: {
          provider: { ref: 'PaypalBillingPlugin' },
          plans: [
            { id: 'standard', features: ['all-features'] }
          ]
        }
      });
      
      expect(paypalSystem.billing.provider.ref).toBe('PaypalBillingPlugin');
    });
    
    it('should support complex pricing models', () => {
      // Define a system with tiered and usage-based pricing
      const complexPricingSystem = dsl.system('ComplexPricingSystem', {
        description: 'System with complex pricing model',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        billing: {
          provider: { ref: 'StripeBillingPlugin' },
          plans: [
            { 
              id: 'tiered-plan',
              name: 'Tiered Plan',
              basePrice: 49.99,
              features: ['all-features'],
              tiers: [
                { name: 'up-to-1000', threshold: 1000, unitPrice: 0.10 },
                { name: 'up-to-10000', threshold: 10000, unitPrice: 0.08 },
                { name: 'unlimited', threshold: null, unitPrice: 0.05 }
              ]
            },
            {
              id: 'usage-plan',
              name: 'Usage Plan',
              basePrice: 0,
              meteredFeatures: [
                { name: 'api-calls', unitPrice: 0.001, billingModel: 'per-unit' },
                { name: 'storage', unitPrice: 0.10, billingModel: 'per-unit', unit: 'GB' }
              ]
            }
          ]
        }
      });
      
      expect(complexPricingSystem.billing.plans[0].tiers).toHaveLength(3);
      expect(complexPricingSystem.billing.plans[0].tiers[0].threshold).toBe(1000);
      expect(complexPricingSystem.billing.plans[1].meteredFeatures).toHaveLength(2);
      expect(complexPricingSystem.billing.plans[1].meteredFeatures[0].name).toBe('api-calls');
    });
  });

  describe('Billing Operations', () => {
    it('should add billing operations to the DSL', () => {
      // The extension should add billing capabilities to the DSL
      expect(typeof (dsl as any).createSubscription).toBe('function');
      expect(typeof (dsl as any).updateSubscription).toBe('function');
      expect(typeof (dsl as any).cancelSubscription).toBe('function');
      expect(typeof (dsl as any).getSubscription).toBe('function');
      expect(typeof (dsl as any).listSubscriptions).toBe('function');
      expect(typeof (dsl as any).createInvoice).toBe('function');
      expect(typeof (dsl as any).recordUsage).toBe('function');
    });
    
    it('should allow creating and managing subscriptions', async () => {
      // Test creating a subscription
      const subscription = await (dsl as any).createSubscription({
        customerId: 'customer-123',
        planId: 'pro',
        startDate: new Date().toISOString(),
        paymentMethodId: 'pm-123'
      });
      
      expect(subscription.id).toBeDefined();
      expect(subscription.status).toBe('active');
      expect(subscription.planId).toBe('pro');
      expect(subscription.customerId).toBe('customer-123');
      
      // Test updating a subscription
      const updatedSubscription = await (dsl as any).updateSubscription(subscription.id, {
        planId: 'enterprise'
      });
      
      expect(updatedSubscription.id).toBe(subscription.id);
      expect(updatedSubscription.planId).toBe('enterprise');
      
      // Test retrieving a subscription
      const retrievedSubscription = await (dsl as any).getSubscription(subscription.id);
      expect(retrievedSubscription).toEqual(updatedSubscription);
      
      // Test canceling a subscription
      const canceledSubscription = await (dsl as any).cancelSubscription(subscription.id);
      expect(canceledSubscription.status).toBe('canceled');
    });
    
    it('should track and record usage for metered billing', async () => {
      // Create a subscription first
      const subscription = await (dsl as any).createSubscription({
        customerId: 'customer-123',
        planId: 'usage-plan',
        startDate: new Date().toISOString()
      });
      
      // Record usage
      const usageRecord = await (dsl as any).recordUsage({
        subscriptionId: subscription.id,
        dimension: 'api-calls',
        quantity: 1500,
        timestamp: new Date().toISOString()
      });
      
      expect(usageRecord.id).toBeDefined();
      expect(usageRecord.subscriptionId).toBe(subscription.id);
      expect(usageRecord.dimension).toBe('api-calls');
      expect(usageRecord.quantity).toBe(1500);
      
      // Record storage usage
      const storageUsage = await (dsl as any).recordUsage({
        subscriptionId: subscription.id,
        dimension: 'storage',
        quantity: 2.5, // 2.5 GB
        timestamp: new Date().toISOString()
      });
      
      expect(storageUsage.id).toBeDefined();
      expect(storageUsage.dimension).toBe('storage');
      expect(storageUsage.quantity).toBe(2.5);
    });
  });

  describe('Billing Webhooks and Events', () => {
    it('should handle billing provider webhooks', async () => {
      // Mock webhook handler
      const webhookHandler = vi.fn();
      
      // Register webhook handler
      (dsl as any).onBillingWebhook('stripe.invoice.paid', webhookHandler);
      
      // Simulate webhook event
      const webhookEvent = {
        type: 'stripe.invoice.paid',
        data: {
          id: 'invoice-123',
          customer: 'customer-123',
          amount: 9999, // $99.99
          status: 'paid'
        }
      };
      
      // Process webhook
      await (dsl as any).processBillingWebhook(webhookEvent);
      
      // Verify webhook handler was called
      expect(webhookHandler).toHaveBeenCalledWith(webhookEvent.data, expect.any(Object));
    });
    
    it('should emit system events for billing operations', async () => {
      // Set up event listener
      const eventListener = vi.fn();
      (dsl as any).on('subscription.created', eventListener);
      
      // Create a subscription, which should emit an event
      const subscription = await (dsl as any).createSubscription({
        customerId: 'customer-123',
        planId: 'pro'
      });
      
      // Verify event was emitted
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({ 
          type: 'subscription.created',
          data: expect.objectContaining({ 
            id: subscription.id, 
            customerId: 'customer-123',
            planId: 'pro'
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('Invoicing and Payment Processing', () => {
    it('should generate and manage invoices', async () => {
      // Create a subscription
      const subscription = await (dsl as any).createSubscription({
        customerId: 'customer-123',
        planId: 'pro'
      });
      
      // Generate an invoice
      const invoice = await (dsl as any).createInvoice({
        customerId: 'customer-123',
        items: [
          { description: 'Monthly subscription - Pro plan', amount: 99.99 },
          { description: 'Additional storage (5GB)', amount: 5.00 }
        ],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      });
      
      expect(invoice.id).toBeDefined();
      expect(invoice.customerId).toBe('customer-123');
      expect(invoice.status).toBe('draft');
      expect(invoice.items).toHaveLength(2);
      expect(invoice.total).toBe(104.99);
      
      // Finalize the invoice
      const finalizedInvoice = await (dsl as any).finalizeInvoice(invoice.id);
      expect(finalizedInvoice.status).toBe('open');
      
      // Pay the invoice
      const paidInvoice = await (dsl as any).payInvoice(invoice.id, {
        paymentMethodId: 'pm-123'
      });
      
      expect(paidInvoice.status).toBe('paid');
      expect(paidInvoice.paidAt).toBeDefined();
    });
    
    it('should handle payment failures gracefully', async () => {
      // Create an invoice
      const invoice = await (dsl as any).createInvoice({
        customerId: 'customer-123',
        items: [
          { description: 'Monthly subscription', amount: 99.99 }
        ]
      });
      
      // Mock a payment failure
      vi.spyOn(dsl as any, 'payInvoice').mockRejectedValueOnce(new Error('Payment failed: Insufficient funds'));
      
      // Try to pay the invoice with a failing payment method
      await expect((dsl as any).payInvoice(invoice.id, {
        paymentMethodId: 'pm-failing'
      })).rejects.toThrow('Payment failed');
      
      // Get the invoice - should be marked as payment_failed
      const failedInvoice = await (dsl as any).getInvoice(invoice.id);
      expect(failedInvoice.status).toBe('payment_failed');
      
      // Retry with a different payment method should succeed
      const retryPayment = await (dsl as any).payInvoice(invoice.id, {
        paymentMethodId: 'pm-valid'
      });
      
      expect(retryPayment.status).toBe('paid');
    });
  });
}); 