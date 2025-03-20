import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { ContextualPolicyExtension } from '../src/extensions/contextual-policy.js';

describe('ContextualPolicyExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let contextualPolicyExtension: ContextualPolicyExtension;

  beforeEach(() => {
    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'resilience.getContextualConfig',
      description: 'Provides context-aware resilience configurations'
    });
    
    // Create the contextual policy extension
    contextualPolicyExtension = new ContextualPolicyExtension();
    
    // Register the extension
    extensionSystem.registerExtension(contextualPolicyExtension);
  });

  describe('GIVEN a tenant-specific resilience configuration', () => {
    it('SHOULD provide different retry configurations based on tenant', async () => {
      // Register tenant-specific configurations
      contextualPolicyExtension.registerTenantConfig('tenant-a', {
        retry: {
          maxAttempts: 3,
          initialDelay: 100,
          backoffStrategy: 'exponential'
        }
      });
      
      contextualPolicyExtension.registerTenantConfig('tenant-b', {
        retry: {
          maxAttempts: 5,
          initialDelay: 200,
          backoffStrategy: 'linear'
        }
      });
      
      // WHEN requesting configurations for different tenants
      const contextA = {
        policyType: 'retry',
        context: { tenant: 'tenant-a' }
      };
      
      const contextB = {
        policyType: 'retry',
        context: { tenant: 'tenant-b' }
      };
      
      const configA = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', contextA);
      const configB = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', contextB);
      
      // THEN tenant-specific configurations should be returned
      expect(configA).toEqual({
        maxAttempts: 3,
        initialDelay: 100,
        backoffStrategy: 'exponential'
      });
      
      expect(configB).toEqual({
        maxAttempts: 5,
        initialDelay: 200,
        backoffStrategy: 'linear'
      });
    });
    
    it('SHOULD return null for unknown tenants', async () => {
      // WHEN requesting configuration for an unknown tenant
      const context = {
        policyType: 'retry',
        context: { tenant: 'unknown-tenant' }
      };
      
      const config = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', context);
      
      // THEN null should be returned
      expect(config).toBeNull();
    });
  });

  describe('GIVEN environment-specific resilience configuration', () => {
    it('SHOULD provide different circuit breaker configurations based on environment', async () => {
      // Set up environment detection
      const getEnvironmentMock = vi.fn()
        .mockReturnValueOnce('development')
        .mockReturnValueOnce('production');
      
      contextualPolicyExtension.setEnvironmentProvider(getEnvironmentMock);
      
      // Register environment-specific configurations
      contextualPolicyExtension.registerEnvironmentConfig('development', {
        circuitBreaker: {
          failureThreshold: 0.5,
          resetTimeout: 5000,
          minimumRequests: 5
        }
      });
      
      contextualPolicyExtension.registerEnvironmentConfig('production', {
        circuitBreaker: {
          failureThreshold: 0.3,
          resetTimeout: 10000,
          minimumRequests: 10
        }
      });
      
      // WHEN requesting configurations for different environments
      const context = {
        policyType: 'circuitBreaker',
        context: {}
      };
      
      const devConfig = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', context);
      const prodConfig = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', context);
      
      // THEN environment-specific configurations should be returned
      expect(devConfig).toEqual({
        failureThreshold: 0.5,
        resetTimeout: 5000,
        minimumRequests: 5
      });
      
      expect(prodConfig).toEqual({
        failureThreshold: 0.3,
        resetTimeout: 10000,
        minimumRequests: 10
      });
      
      // AND the environment provider should have been called
      expect(getEnvironmentMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('GIVEN service-specific resilience configuration', () => {
    it('SHOULD provide different bulkhead configurations based on service', async () => {
      // Register service-specific configurations
      contextualPolicyExtension.registerServiceConfig('payment-service', {
        bulkhead: {
          maxConcurrent: 10,
          maxQueue: 20
        }
      });
      
      contextualPolicyExtension.registerServiceConfig('inventory-service', {
        bulkhead: {
          maxConcurrent: 5,
          maxQueue: 10
        }
      });
      
      // WHEN requesting configurations for different services
      const contextPayment = {
        policyType: 'bulkhead',
        context: { service: 'payment-service' }
      };
      
      const contextInventory = {
        policyType: 'bulkhead',
        context: { service: 'inventory-service' }
      };
      
      const paymentConfig = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', contextPayment);
      const inventoryConfig = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', contextInventory);
      
      // THEN service-specific configurations should be returned
      expect(paymentConfig).toEqual({
        maxConcurrent: 10,
        maxQueue: 20
      });
      
      expect(inventoryConfig).toEqual({
        maxConcurrent: 5,
        maxQueue: 10
      });
    });
  });

  describe('GIVEN dynamic configuration based on runtime metrics', () => {
    it('SHOULD adjust rate limit configuration based on system load', async () => {
      // Set up system metrics provider
      const getSystemMetricsMock = vi.fn().mockImplementation(() => ({
        cpuLoad: 0.8,
        memoryUsage: 0.7,
        requestRate: 100
      }));
      
      contextualPolicyExtension.setSystemMetricsProvider(getSystemMetricsMock);
      
      // Register dynamic configuration provider
      contextualPolicyExtension.registerDynamicConfigProvider((context, metrics) => {
        if (context.policyType === 'rateLimit') {
          // Adjust rate limit based on CPU load
          const baseLimit = 1000;
          const adjustedLimit = Math.floor(baseLimit * (1 - metrics.cpuLoad));
          
          return {
            limit: adjustedLimit,
            window: 60000
          };
        }
        return null;
      });
      
      // WHEN requesting rate limit configuration
      const context = {
        policyType: 'rateLimit',
        context: {}
      };
      
      const config = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', context);
      
      // THEN dynamically calculated configuration should be returned
      // With 80% CPU load: 1000 * (1 - 0.8) = 200, but Math.floor rounds down to 199
      expect(config).toEqual({
        limit: 199,
        window: 60000
      });
      
      // AND the metrics provider should have been called
      expect(getSystemMetricsMock).toHaveBeenCalled();
    });
  });

  describe('GIVEN configuration priority order', () => {
    it('SHOULD prioritize dynamic over static configurations', async () => {
      // Set up system metrics provider
      const getSystemMetricsMock = vi.fn().mockReturnValue({
        cpuLoad: 0.5,
        memoryUsage: 0.5,
        requestRate: 50
      });
      
      contextualPolicyExtension.setSystemMetricsProvider(getSystemMetricsMock);
      
      // Register static configuration
      contextualPolicyExtension.registerTenantConfig('test-tenant', {
        rateLimit: {
          limit: 500,
          window: 60000
        }
      });
      
      // Register dynamic configuration provider
      contextualPolicyExtension.registerDynamicConfigProvider((context, metrics) => {
        if (context.policyType === 'rateLimit') {
          return {
            limit: 300,
            window: 30000
          };
        }
        return null;
      });
      
      // WHEN requesting rate limit configuration
      const context = {
        policyType: 'rateLimit',
        context: { tenant: 'test-tenant' }
      };
      
      const config = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', context);
      
      // THEN dynamic configuration should take precedence
      expect(config).toEqual({
        limit: 300,
        window: 30000
      });
    });
    
    it('SHOULD fall back to static configurations when dynamic returns null', async () => {
      // Set up system metrics provider
      const getSystemMetricsMock = vi.fn().mockReturnValue({
        cpuLoad: 0.5,
        memoryUsage: 0.5,
        requestRate: 50
      });
      
      contextualPolicyExtension.setSystemMetricsProvider(getSystemMetricsMock);
      
      // Register static configuration
      contextualPolicyExtension.registerTenantConfig('test-tenant', {
        retry: {
          maxAttempts: 3,
          initialDelay: 100
        }
      });
      
      // Register dynamic configuration provider that returns null for retry
      contextualPolicyExtension.registerDynamicConfigProvider((context, metrics) => {
        if (context.policyType === 'rateLimit') {
          return {
            limit: 300,
            window: 30000
          };
        }
        return null;
      });
      
      // WHEN requesting retry configuration
      const context = {
        policyType: 'retry',
        context: { tenant: 'test-tenant' }
      };
      
      const config = await extensionSystem.triggerExtensionPoint('resilience.getContextualConfig', context);
      
      // THEN static configuration should be used
      expect(config).toEqual({
        maxAttempts: 3,
        initialDelay: 100
      });
    });
  });
}); 