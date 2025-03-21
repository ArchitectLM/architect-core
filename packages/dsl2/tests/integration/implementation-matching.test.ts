import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

/**
 * Implementation Matching Test Suite
 * 
 * This test file demonstrates how component implementations are selected
 * based on metadata, environment settings, and other criteria to enable
 * flexible deployment and testing scenarios.
 */
describe('Implementation Matching', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  // Create a mock implementation registry and matcher
  const mockImplementationMatcher = {
    // Registry of implementations by component ID and environment
    registry: new Map(),
    
    // Register an implementation for a component
    registerImplementation: (implementation, environment = 'default') => {
      const targetComponent = implementation.targetComponent;
      
      if (!mockImplementationMatcher.registry.has(targetComponent)) {
        mockImplementationMatcher.registry.set(targetComponent, new Map());
      }
      
      const componentRegistry = mockImplementationMatcher.registry.get(targetComponent);
      
      if (!componentRegistry.has(environment)) {
        componentRegistry.set(environment, []);
      }
      
      componentRegistry.get(environment).push(implementation);
    },
    
    // Find the best implementation for a component in a given environment
    findImplementation: (componentId, environment = 'default', criteria = {}) => {
      if (!mockImplementationMatcher.registry.has(componentId)) {
        return null;
      }
      
      const componentRegistry = mockImplementationMatcher.registry.get(componentId);
      
      // Look for implementation in the specific environment
      const candidates = componentRegistry.get(environment) || [];
      
      // If no implementation found for the specific environment, fall back to default
      if (candidates.length === 0 && environment !== 'default') {
        candidates.push(...(componentRegistry.get('default') || []));
      }
      
      if (candidates.length === 0) {
        return null;
      }
      
      // If we have criteria, filter and sort implementations
      if (Object.keys(criteria).length > 0) {
        const matchingCandidates = candidates.filter(impl => {
          // Check if the implementation matches all criteria
          return Object.entries(criteria).every(([key, value]) => {
            return impl.attributes && impl.attributes[key] === value;
          });
        });
        
        if (matchingCandidates.length > 0) {
          // Sort by priority (higher is better)
          return matchingCandidates.sort((a, b) => {
            const priorityA = a.attributes?.priority || 0;
            const priorityB = b.attributes?.priority || 0;
            return priorityB - priorityA;
          })[0];
        }
      }
      
      // If no matching implementation found with criteria or no criteria provided,
      // return the highest priority implementation
      return candidates.sort((a, b) => {
        const priorityA = a.attributes?.priority || 0;
        const priorityB = b.attributes?.priority || 0;
        return priorityB - priorityA;
      })[0];
    }
  };
  
  // Mock runtime environment
  const mockRuntime = {
    createActor: (componentId, environment, criteria) => {
      // Find implementation based on environment and criteria
      const implementation = mockImplementationMatcher.findImplementation(
        componentId, 
        environment, 
        criteria
      );
      
      if (!implementation) {
        throw new Error(`No implementation found for ${componentId} in environment ${environment}`);
      }
      
      // Create actor with the implementation
      return {
        id: `${componentId}-instance`,
        componentId,
        implementation: implementation.id,
        handlers: implementation.handlers || {},
        state: {}
      };
    }
  };

  describe('Basic Implementation Selection', () => {
    it('should select the appropriate implementation based on environment', () => {
      // Define a component
      dsl.component('UserActor', {
        type: ComponentType.ACTOR,
        description: 'User management actor',
        version: '1.0.0',
        state: {
          properties: {
            users: { type: 'array', items: { type: 'object' } }
          }
        },
        messageHandlers: {
          createUser: {
            input: {
              properties: {
                name: { type: 'string' },
                email: { type: 'string' }
              },
              required: ['name', 'email']
            },
            output: {
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' }
              }
            }
          },
          getUser: {
            input: {
              properties: {
                id: { type: 'string' }
              },
              required: ['id']
            },
            output: {
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Define a default in-memory implementation
      const inMemoryImpl = dsl.component('UserActorInMemoryImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'In-memory implementation of UserActor',
        version: '1.0.0',
        targetComponent: 'UserActor',
        attributes: {
          priority: 10,
          tags: ['in-memory', 'default']
        },
        handlers: {
          createUser: vi.fn().mockImplementation((input, context) => {
            if (!context.state.users) {
              context.state.users = [];
            }
            
            const user = {
              id: `user-${Date.now()}`,
              name: input.name,
              email: input.email
            };
            
            context.state.users.push(user);
            return user;
          }),
          getUser: vi.fn().mockImplementation((input, context) => {
            if (!context.state.users) {
              return null;
            }
            
            return context.state.users.find(user => user.id === input.id) || null;
          })
        }
      });
      
      // Define a production database implementation
      const dbImpl = dsl.component('UserActorDatabaseImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Database implementation of UserActor',
        version: '1.0.0',
        targetComponent: 'UserActor',
        attributes: {
          priority: 20,
          tags: ['database', 'production']
        },
        handlers: {
          createUser: vi.fn().mockImplementation((input) => {
            // Mock database operation
            return {
              id: `user-db-${Date.now()}`,
              name: input.name,
              email: input.email
            };
          }),
          getUser: vi.fn().mockImplementation((input) => {
            // Mock database operation
            return {
              id: input.id,
              name: 'Database User',
              email: 'db-user@example.com'
            };
          })
        }
      });
      
      // Register implementations
      mockImplementationMatcher.registerImplementation(inMemoryImpl);
      mockImplementationMatcher.registerImplementation(dbImpl, 'production');
      
      // Test implementation selection in development environment
      const devImpl = mockImplementationMatcher.findImplementation('UserActor', 'development');
      expect(devImpl).not.toBeNull();
      expect(devImpl?.id).toBe('UserActorInMemoryImpl');
      
      // Test implementation selection in production environment
      const prodImpl = mockImplementationMatcher.findImplementation('UserActor', 'production');
      expect(prodImpl).not.toBeNull();
      expect(prodImpl?.id).toBe('UserActorDatabaseImpl');
    });
    
    it('should select implementation based on criteria and priority', () => {
      // Define a component
      dsl.component('PaymentActor', {
        type: ComponentType.ACTOR,
        description: 'Payment processing actor',
        version: '1.0.0',
        messageHandlers: {
          processPayment: {
            input: {
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                source: { type: 'string' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                transactionId: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Define several implementations with different attributes
      const mockImpl = dsl.component('PaymentActorMockImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Mock implementation of PaymentActor',
        version: '1.0.0',
        targetComponent: 'PaymentActor',
        attributes: {
          priority: 10,
          environment: 'test',
          provider: 'mock'
        },
        handlers: {
          processPayment: vi.fn().mockImplementation(() => ({
            success: true,
            transactionId: `mock-payment-${Date.now()}`
          }))
        }
      });
      
      const stripeImpl = dsl.component('PaymentActorStripeImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Stripe implementation of PaymentActor',
        version: '1.0.0',
        targetComponent: 'PaymentActor',
        attributes: {
          priority: 20,
          environment: 'production',
          provider: 'stripe'
        },
        handlers: {
          processPayment: vi.fn().mockImplementation(() => ({
            success: true,
            transactionId: `stripe-payment-${Date.now()}`
          }))
        }
      });
      
      const paypalImpl = dsl.component('PaymentActorPayPalImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'PayPal implementation of PaymentActor',
        version: '1.0.0',
        targetComponent: 'PaymentActor',
        attributes: {
          priority: 15,
          environment: 'production',
          provider: 'paypal'
        },
        handlers: {
          processPayment: vi.fn().mockImplementation(() => ({
            success: true,
            transactionId: `paypal-payment-${Date.now()}`
          }))
        }
      });
      
      // Register implementations
      mockImplementationMatcher.registerImplementation(mockImpl, 'test');
      mockImplementationMatcher.registerImplementation(stripeImpl, 'production');
      mockImplementationMatcher.registerImplementation(paypalImpl, 'production');
      
      // Test implementation selection based on environment
      const testImpl = mockImplementationMatcher.findImplementation('PaymentActor', 'test');
      expect(testImpl?.id).toBe('PaymentActorMockImpl');
      
      // Test implementation selection based on environment and criteria
      const stripeProviderImpl = mockImplementationMatcher.findImplementation(
        'PaymentActor', 
        'production',
        { provider: 'stripe' }
      );
      expect(stripeProviderImpl?.id).toBe('PaymentActorStripeImpl');
      
      const paypalProviderImpl = mockImplementationMatcher.findImplementation(
        'PaymentActor', 
        'production',
        { provider: 'paypal' }
      );
      expect(paypalProviderImpl?.id).toBe('PaymentActorPayPalImpl');
      
      // Test the default highest priority implementation when no specific criteria
      const defaultProdImpl = mockImplementationMatcher.findImplementation('PaymentActor', 'production');
      expect(defaultProdImpl?.id).toBe('PaymentActorStripeImpl'); // Highest priority
    });
  });

  describe('Implementation and Test Matching', () => {
    it('should match implementation with corresponding tests', () => {
      // Define a component
      dsl.component('DataStoreActor', {
        type: ComponentType.ACTOR,
        description: 'Data store actor',
        version: '1.0.0',
        messageHandlers: {
          storeData: {
            input: {
              properties: {
                key: { type: 'string' },
                value: { type: 'any' }
              }
            },
            output: { type: 'boolean' }
          },
          getData: {
            input: {
              properties: {
                key: { type: 'string' }
              }
            },
            output: { type: 'any' }
          }
        }
      });
      
      // Define implementations
      const inMemoryImpl = dsl.component('DataStoreInMemoryImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'In-memory implementation of DataStoreActor',
        version: '1.0.0',
        targetComponent: 'DataStoreActor',
        attributes: {
          domain: 'storage',
          tag: 'in-memory'
        },
        handlers: {
          storeData: vi.fn().mockImplementation((input, context) => {
            if (!context.state.data) {
              context.state.data = new Map();
            }
            context.state.data.set(input.key, input.value);
            return true;
          }),
          getData: vi.fn().mockImplementation((input, context) => {
            if (!context.state.data) {
              return null;
            }
            return context.state.data.get(input.key) || null;
          })
        }
      });
      
      const redisImpl = dsl.component('DataStoreRedisImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Redis implementation of DataStoreActor',
        version: '1.0.0',
        targetComponent: 'DataStoreActor',
        attributes: {
          domain: 'storage',
          tag: 'redis'
        },
        handlers: {
          storeData: vi.fn().mockImplementation(() => true),
          getData: vi.fn().mockImplementation((input) => `redis-value-${input.key}`)
        }
      });
      
      // Define tests for in-memory implementation
      const inMemoryTest = dsl.component('DataStoreInMemoryTest', {
        type: ComponentType.TEST,
        description: 'Tests for in-memory implementation of DataStoreActor',
        version: '1.0.0',
        target: { ref: 'DataStoreActor' },
        attributes: {
          implementation: 'DataStoreInMemoryImpl',
          domain: 'storage',
          tag: 'in-memory'
        },
        scenarios: [
          {
            name: 'Store and retrieve data',
            given: [
              { setup: 'emptyState' }
            ],
            when: [
              {
                send: {
                  message: 'storeData',
                  payload: { key: 'test-key', value: 'test-value' }
                },
                store: 'storeResult'
              },
              {
                send: {
                  message: 'getData',
                  payload: { key: 'test-key' }
                },
                store: 'getResult'
              }
            ],
            then: [
              { assert: 'storeResult', equals: true },
              { assert: 'getResult', equals: 'test-value' }
            ]
          }
        ]
      });
      
      // Define tests for redis implementation
      const redisTest = dsl.component('DataStoreRedisTest', {
        type: ComponentType.TEST,
        description: 'Tests for Redis implementation of DataStoreActor',
        version: '1.0.0',
        target: { ref: 'DataStoreActor' },
        attributes: {
          implementation: 'DataStoreRedisImpl',
          domain: 'storage',
          tag: 'redis'
        },
        scenarios: [
          {
            name: 'Store and retrieve data',
            given: [
              { setup: 'emptyState' }
            ],
            when: [
              {
                send: {
                  message: 'storeData',
                  payload: { key: 'redis-key', value: 'redis-value' }
                },
                store: 'storeResult'
              },
              {
                send: {
                  message: 'getData',
                  payload: { key: 'redis-key' }
                },
                store: 'getResult'
              }
            ],
            then: [
              { assert: 'storeResult', equals: true },
              { assert: 'getResult', equals: 'redis-value-redis-key' }
            ]
          }
        ]
      });
      
      // Create a mock test runner that matches tests with implementations
      const mockTestRunner = {
        findTestsForImplementation: (implementationId) => {
          const implementation = dsl.getComponent(implementationId);
          if (!implementation) return [];
          
          // Find all tests that match this implementation
          return Object.values(dsl.components)
            .filter(component => 
              component.type === ComponentType.TEST && 
              component.attributes?.implementation === implementationId
            );
        },
        
        findImplementationForTest: (testId) => {
          const test = dsl.getComponent(testId);
          if (!test || test.type !== ComponentType.TEST) return null;
          
          const implementationId = test.attributes?.implementation;
          if (!implementationId) return null;
          
          return dsl.getComponent(implementationId);
        }
      };
      
      // Test matching implementations with their tests
      const inMemoryTests = mockTestRunner.findTestsForImplementation('DataStoreInMemoryImpl');
      expect(inMemoryTests).toHaveLength(1);
      expect(inMemoryTests[0].id).toBe('DataStoreInMemoryTest');
      
      const redisTests = mockTestRunner.findTestsForImplementation('DataStoreRedisImpl');
      expect(redisTests).toHaveLength(1);
      expect(redisTests[0].id).toBe('DataStoreRedisTest');
      
      // Test finding the implementation for a specific test
      const inMemoryImplForTest = mockTestRunner.findImplementationForTest('DataStoreInMemoryTest');
      expect(inMemoryImplForTest).not.toBeNull();
      expect(inMemoryImplForTest?.id).toBe('DataStoreInMemoryImpl');
      
      const redisImplForTest = mockTestRunner.findImplementationForTest('DataStoreRedisTest');
      expect(redisImplForTest).not.toBeNull();
      expect(redisImplForTest?.id).toBe('DataStoreRedisImpl');
    });
    
    it('should support domain-specific implementation selection', () => {
      // Define a component in the payment domain
      dsl.component('PaymentProcessor', {
        type: ComponentType.ACTOR,
        description: 'Payment processor actor',
        version: '1.0.0',
        attributes: {
          domain: 'payment'
        },
        messageHandlers: {
          processPayment: {
            input: {
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                transactionId: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Define implementations for different regions
      const usImpl = dsl.component('PaymentProcessorUSImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'US implementation of PaymentProcessor',
        version: '1.0.0',
        targetComponent: 'PaymentProcessor',
        attributes: {
          domain: 'payment',
          region: 'us'
        },
        handlers: {
          processPayment: vi.fn().mockImplementation(() => ({
            success: true,
            transactionId: `us-payment-${Date.now()}`
          }))
        }
      });
      
      const euImpl = dsl.component('PaymentProcessorEUImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'EU implementation of PaymentProcessor',
        version: '1.0.0',
        targetComponent: 'PaymentProcessor',
        attributes: {
          domain: 'payment',
          region: 'eu'
        },
        handlers: {
          processPayment: vi.fn().mockImplementation(() => ({
            success: true,
            transactionId: `eu-payment-${Date.now()}`
          }))
        }
      });
      
      // Mock implementation selection based on domain and region
      const domainBasedSelector = {
        registry: new Map(),
        
        registerImplementation: (implementation) => {
          const targetComponent = implementation.targetComponent;
          const domain = implementation.attributes?.domain;
          const region = implementation.attributes?.region;
          
          if (!domain || !region) return;
          
          const key = `${targetComponent}:${domain}:${region}`;
          domainBasedSelector.registry.set(key, implementation);
        },
        
        findImplementation: (componentId, domain, region) => {
          const key = `${componentId}:${domain}:${region}`;
          return domainBasedSelector.registry.get(key) || null;
        }
      };
      
      // Register implementations
      domainBasedSelector.registerImplementation(usImpl);
      domainBasedSelector.registerImplementation(euImpl);
      
      // Test implementation selection based on domain and region
      const usPaymentImpl = domainBasedSelector.findImplementation('PaymentProcessor', 'payment', 'us');
      expect(usPaymentImpl).not.toBeNull();
      expect(usPaymentImpl?.id).toBe('PaymentProcessorUSImpl');
      
      const euPaymentImpl = domainBasedSelector.findImplementation('PaymentProcessor', 'payment', 'eu');
      expect(euPaymentImpl).not.toBeNull();
      expect(euPaymentImpl?.id).toBe('PaymentProcessorEUImpl');
      
      // Test with non-existent region
      const asiaPaymentImpl = domainBasedSelector.findImplementation('PaymentProcessor', 'payment', 'asia');
      expect(asiaPaymentImpl).toBeNull();
    });
  });

  describe('Dynamic Implementation Loading', () => {
    it('should support dynamic implementation loading based on configuration', () => {
      // Define component
      dsl.component('ConfigurableService', {
        type: ComponentType.ACTOR,
        description: 'Service with configurable implementation',
        version: '1.0.0',
        messageHandlers: {
          processRequest: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      // Define implementation variants
      const fastImpl = dsl.component('FastServiceImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Fast implementation with low accuracy',
        version: '1.0.0',
        targetComponent: 'ConfigurableService',
        attributes: {
          performance: 'fast',
          accuracy: 'low'
        },
        handlers: {
          processRequest: vi.fn().mockImplementation(() => ({
            result: 'Fast result',
            processingTime: 10
          }))
        }
      });
      
      const accurateImpl = dsl.component('AccurateServiceImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Slow implementation with high accuracy',
        version: '1.0.0',
        targetComponent: 'ConfigurableService',
        attributes: {
          performance: 'slow',
          accuracy: 'high'
        },
        handlers: {
          processRequest: vi.fn().mockImplementation(() => ({
            result: 'Accurate result',
            processingTime: 100
          }))
        }
      });
      
      const balancedImpl = dsl.component('BalancedServiceImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Balanced implementation with medium accuracy',
        version: '1.0.0',
        targetComponent: 'ConfigurableService',
        attributes: {
          performance: 'medium',
          accuracy: 'medium'
        },
        handlers: {
          processRequest: vi.fn().mockImplementation(() => ({
            result: 'Balanced result',
            processingTime: 50
          }))
        }
      });
      
      // Define configuration object that would typically be loaded from external source
      const serviceConfig = {
        default: {
          implementation: 'BalancedServiceImpl'
        },
        variants: {
          highThroughput: {
            implementation: 'FastServiceImpl'
          },
          highAccuracy: {
            implementation: 'AccurateServiceImpl'
          }
        }
      };
      
      // Mock dynamic implementation loader
      const dynamicLoader = {
        loadImplementation: (componentId, variant) => {
          const config = variant ? 
            serviceConfig.variants[variant] : 
            serviceConfig.default;
          
          if (!config) {
            throw new Error(`No configuration found for variant: ${variant}`);
          }
          
          const implementationId = config.implementation;
          const implementation = dsl.getComponent(implementationId);
          
          if (!implementation || implementation.targetComponent !== componentId) {
            throw new Error(`Invalid implementation for component: ${componentId}`);
          }
          
          return implementation;
        }
      };
      
      // Test dynamic implementation loading
      const defaultImpl = dynamicLoader.loadImplementation('ConfigurableService');
      expect(defaultImpl.id).toBe('BalancedServiceImpl');
      
      const fastVariant = dynamicLoader.loadImplementation('ConfigurableService', 'highThroughput');
      expect(fastVariant.id).toBe('FastServiceImpl');
      
      const accurateVariant = dynamicLoader.loadImplementation('ConfigurableService', 'highAccuracy');
      expect(accurateVariant.id).toBe('AccurateServiceImpl');
      
      // Mock calling the implementation
      const result = fastVariant.handlers.processRequest({});
      expect(result.result).toBe('Fast result');
      expect(result.processingTime).toBe(10);
    });
  });
}); 