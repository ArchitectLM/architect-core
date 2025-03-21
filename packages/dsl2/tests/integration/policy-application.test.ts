import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

/**
 * Policy Application Test Suite
 * 
 * This test file demonstrates how policies are defined in DSL2 and applied in Core2.
 * It shows how different types of policies (retry, circuit breaker, timeout, rate limiting)
 * are defined at component level and system level.
 */
describe('Policy Application', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  // Create a mock adapter for Core2 that extracts and processes policies
  const mockCore2Adapter = {
    processPolicies: vi.fn().mockImplementation((component) => {
      const policies = component.policies || {};
      const processedPolicies = { ...policies };
      
      // Add default values or transform policies as Core2 would
      if (policies.retry) {
        for (const [operation, config] of Object.entries(policies.retry)) {
          processedPolicies.retry[operation] = {
            ...config,
            enabled: true,
            backoffType: config.backoff || 'exponential',
            maxRetryAttempts: config.attempts || 3,
            initialDelayMs: config.initialDelay ? parseInt(config.initialDelay.replace('ms', '')) : 100
          };
        }
      }
      
      if (policies.circuitBreaker) {
        for (const [operation, config] of Object.entries(policies.circuitBreaker)) {
          processedPolicies.circuitBreaker[operation] = {
            ...config,
            enabled: true,
            openStateTimeoutMs: config.resetTimeout ? parseInt(config.resetTimeout.replace('s', '')) * 1000 : 30000
          };
        }
      }
      
      if (policies.timeout) {
        for (const [operation, config] of Object.entries(policies.timeout)) {
          processedPolicies.timeout[operation] = {
            ...config,
            enabled: true,
            timeoutMs: config.duration ? parseInt(config.duration.replace('s', '')) * 1000 : 5000
          };
        }
      }
      
      if (policies.rateLimiting) {
        for (const [pattern, config] of Object.entries(policies.rateLimiting)) {
          processedPolicies.rateLimiting[pattern] = {
            ...config,
            enabled: true,
            windowSizeMs: config.window ? 
              parseInt(config.window.replace('s', '').replace('m', '') * (config.window.includes('m') ? 60 : 1) * 1000) : 
              60000
          };
        }
      }
      
      return processedPolicies;
    }),
    
    createActorSystem: vi.fn().mockImplementation((systemConfig) => {
      // Process system-level policies
      const systemPolicies = mockCore2Adapter.processPolicies(systemConfig);
      
      // Extract component references to apply their policies
      const componentRefs = [];
      if (systemConfig.components) {
        for (const type of ['actors', 'processes']) {
          if (systemConfig.components[type]) {
            componentRefs.push(...systemConfig.components[type]);
          }
        }
      }
      
      // Create a mock actor system with policy configurations
      return {
        id: `actor-system-${Date.now()}`,
        systemConfig: systemConfig,
        systemPolicies: systemPolicies,
        componentPolicies: componentRefs.map(ref => ({
          componentId: ref.ref,
          policies: {}
        })),
        start: vi.fn().mockResolvedValue(true),
        stop: vi.fn().mockResolvedValue(true)
      };
    })
  };

  describe('Actor-Level Policies', () => {
    it('should define and apply retry policies for actors', () => {
      // Define an actor with retry policy
      const paymentActor = dsl.component('PaymentActor', {
        type: ComponentType.ACTOR,
        description: 'Payment processing actor',
        version: '1.0.0',
        policies: {
          retry: {
            processPayment: {
              attempts: 5,
              backoff: 'exponential',
              initialDelay: '200ms'
            },
            refundPayment: {
              attempts: 3,
              backoff: 'linear',
              initialDelay: '500ms'
            }
          }
        },
        messageHandlers: {
          processPayment: {
            input: {
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                cardToken: { type: 'string' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                transactionId: { type: 'string' }
              }
            }
          },
          refundPayment: {
            input: {
              properties: {
                transactionId: { type: 'string' },
                amount: { type: 'number' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                refundId: { type: 'string' }
              }
            }
          }
        }
      });

      // Process the policies as Core2 would
      const processedPolicies = mockCore2Adapter.processPolicies(paymentActor);
      
      // Verify the policies were processed correctly
      expect(processedPolicies.retry).toBeDefined();
      expect(processedPolicies.retry.processPayment).toBeDefined();
      expect(processedPolicies.retry.processPayment.maxRetryAttempts).toBe(5);
      expect(processedPolicies.retry.processPayment.backoffType).toBe('exponential');
      expect(processedPolicies.retry.processPayment.initialDelayMs).toBe(200);
      
      expect(processedPolicies.retry.refundPayment).toBeDefined();
      expect(processedPolicies.retry.refundPayment.maxRetryAttempts).toBe(3);
      expect(processedPolicies.retry.refundPayment.backoffType).toBe('linear');
      expect(processedPolicies.retry.refundPayment.initialDelayMs).toBe(500);
    });

    it('should define and apply circuit breaker policies for actors', () => {
      // Define an actor with circuit breaker policy
      const dataAccessActor = dsl.component('DataAccessActor', {
        type: ComponentType.ACTOR,
        description: 'Database access actor',
        version: '1.0.0',
        policies: {
          circuitBreaker: {
            queryData: {
              failureThreshold: 5,
              resetTimeout: '30s'
            },
            updateData: {
              failureThreshold: 3,
              resetTimeout: '60s'
            }
          }
        },
        messageHandlers: {
          queryData: {
            input: {
              properties: {
                query: { type: 'string' },
                parameters: { type: 'object' }
              }
            },
            output: {
              properties: {
                results: { type: 'array' }
              }
            }
          },
          updateData: {
            input: {
              properties: {
                table: { type: 'string' },
                data: { type: 'object' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                rowsAffected: { type: 'number' }
              }
            }
          }
        }
      });

      // Process the policies as Core2 would
      const processedPolicies = mockCore2Adapter.processPolicies(dataAccessActor);
      
      // Verify the policies were processed correctly
      expect(processedPolicies.circuitBreaker).toBeDefined();
      expect(processedPolicies.circuitBreaker.queryData).toBeDefined();
      expect(processedPolicies.circuitBreaker.queryData.failureThreshold).toBe(5);
      expect(processedPolicies.circuitBreaker.queryData.openStateTimeoutMs).toBe(30000);
      
      expect(processedPolicies.circuitBreaker.updateData).toBeDefined();
      expect(processedPolicies.circuitBreaker.updateData.failureThreshold).toBe(3);
      expect(processedPolicies.circuitBreaker.updateData.openStateTimeoutMs).toBe(60000);
    });

    it('should define and apply timeout policies for actors', () => {
      // Define an actor with timeout policy
      const apiClientActor = dsl.component('ApiClientActor', {
        type: ComponentType.ACTOR,
        description: 'External API client actor',
        version: '1.0.0',
        policies: {
          timeout: {
            fetchData: {
              duration: '10s'
            },
            streamData: {
              duration: '30s'
            }
          }
        },
        messageHandlers: {
          fetchData: {
            input: {
              properties: {
                endpoint: { type: 'string' },
                parameters: { type: 'object' }
              }
            },
            output: {
              properties: {
                data: { type: 'object' }
              }
            }
          },
          streamData: {
            input: {
              properties: {
                endpoint: { type: 'string' },
                streamId: { type: 'string' }
              }
            },
            output: {
              properties: {
                stream: { type: 'object' }
              }
            }
          }
        }
      });

      // Process the policies as Core2 would
      const processedPolicies = mockCore2Adapter.processPolicies(apiClientActor);
      
      // Verify the policies were processed correctly
      expect(processedPolicies.timeout).toBeDefined();
      expect(processedPolicies.timeout.fetchData).toBeDefined();
      expect(processedPolicies.timeout.fetchData.timeoutMs).toBe(10000);
      
      expect(processedPolicies.timeout.streamData).toBeDefined();
      expect(processedPolicies.timeout.streamData.timeoutMs).toBe(30000);
    });
  });

  describe('System-Level Policies', () => {
    it('should define and apply rate limiting policies at system level', () => {
      // Define a system with rate limiting policies
      const apiGatewaySystem = dsl.system('ApiGatewaySystem', {
        description: 'API Gateway system with rate limiting',
        version: '1.0.0',
        policies: {
          rateLimiting: {
            'api.public.*': { 
              limit: 100, 
              window: '1m' 
            },
            'api.admin.*': { 
              limit: 50, 
              window: '30s' 
            }
          }
        },
        components: {
          actors: [
            { ref: 'ApiHandlerActor' },
            { ref: 'AuthenticationActor' }
          ]
        }
      });

      // Process the policies as Core2 would
      const processedPolicies = mockCore2Adapter.processPolicies(apiGatewaySystem);
      
      // Verify the policies were processed correctly
      expect(processedPolicies.rateLimiting).toBeDefined();
      expect(processedPolicies.rateLimiting['api.public.*']).toBeDefined();
      expect(processedPolicies.rateLimiting['api.public.*'].limit).toBe(100);
      expect(processedPolicies.rateLimiting['api.public.*'].windowSizeMs).toBe(60000);
      
      expect(processedPolicies.rateLimiting['api.admin.*']).toBeDefined();
      expect(processedPolicies.rateLimiting['api.admin.*'].limit).toBe(50);
      expect(processedPolicies.rateLimiting['api.admin.*'].windowSizeMs).toBe(30000);
    });

    it('should combine multiple policy types at system level', () => {
      // Define a system with multiple policy types
      const paymentSystem = dsl.system('PaymentSystem', {
        description: 'Payment processing system',
        version: '1.0.0',
        policies: {
          rateLimiting: {
            'payment.process.*': { limit: 50, window: '1m' }
          },
          timeout: {
            'payment.*.thirdParty': { duration: '15s' }
          },
          security: {
            authentication: { required: true },
            authorization: { roles: ['payment-admin'] }
          }
        },
        components: {
          actors: [
            { ref: 'PaymentProcessorActor' },
            { ref: 'FraudDetectionActor' }
          ],
          processes: [
            { ref: 'PaymentWorkflow' }
          ]
        }
      });

      // Create an actor system which would apply these policies
      const actorSystem = mockCore2Adapter.createActorSystem(paymentSystem);
      
      // Verify the actor system has the policies
      expect(actorSystem.systemPolicies).toBeDefined();
      expect(actorSystem.systemPolicies.rateLimiting).toBeDefined();
      expect(actorSystem.systemPolicies.rateLimiting['payment.process.*'].limit).toBe(50);
      
      expect(actorSystem.systemPolicies.timeout).toBeDefined();
      expect(actorSystem.systemPolicies.timeout['payment.*.thirdParty'].duration).toBe('15s');
      
      expect(actorSystem.systemPolicies.security).toBeDefined();
      expect(actorSystem.systemPolicies.security.authentication.required).toBe(true);
      expect(actorSystem.systemPolicies.security.authorization.roles).toContain('payment-admin');
    });
  });

  describe('Policy Inheritance and Composition', () => {
    it('should allow actors to inherit and override system policies', () => {
      // Define actors with policies
      dsl.component('BaseServiceActor', {
        type: ComponentType.ACTOR,
        description: 'Base service actor',
        version: '1.0.0',
        policies: {
          retry: {
            '*': { attempts: 3, backoff: 'linear', initialDelay: '100ms' }
          },
          timeout: {
            '*': { duration: '5s' }
          }
        },
        messageHandlers: {
          processRequest: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      dsl.component('CriticalServiceActor', {
        type: ComponentType.ACTOR,
        description: 'Critical service with custom policies',
        version: '1.0.0',
        policies: {
          retry: {
            processRequest: { attempts: 5, backoff: 'exponential', initialDelay: '200ms' }
          },
          timeout: {
            processRequest: { duration: '10s' }
          },
          circuitBreaker: {
            processRequest: { failureThreshold: 10, resetTimeout: '120s' }
          }
        },
        messageHandlers: {
          processRequest: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });

      // Define a system that composes multiple actors with policies
      const compositeSystem = dsl.system('CompositeSystem', {
        description: 'System that composes multiple actors with policies',
        version: '1.0.0',
        policies: {
          retry: {
            'fallback.*': { attempts: 1 } // Override for fallback paths
          },
          rateLimiting: {
            'api.*': { limit: 100, window: '1m' }
          }
        },
        components: {
          actors: [
            { ref: 'BaseServiceActor' },
            { ref: 'CriticalServiceActor' }
          ]
        }
      });

      // Create an actor system which would apply these policies
      const actorSystem = mockCore2Adapter.createActorSystem(compositeSystem);
      
      // Verify system policies
      expect(actorSystem.systemPolicies.retry).toBeDefined();
      expect(actorSystem.systemPolicies.retry['fallback.*'].attempts).toBe(1);
      expect(actorSystem.systemPolicies.rateLimiting).toBeDefined();
      
      // In a real implementation, Core2 would merge these policies applying
      // the most specific ones (actor-level) over the more general ones (system-level)
      // This test just verifies the policy definitions are captured and available for Core2
    });

    it('should allow behavior composition with policies', () => {
      // Define a behavior actor with policies
      dsl.component('LoggingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Logging behavior with retry policy',
        version: '1.0.0',
        policies: {
          retry: {
            log: { attempts: 3, backoff: 'linear', initialDelay: '100ms' }
          }
        },
        messageHandlers: {
          log: {
            input: {
              properties: {
                level: { type: 'string' },
                message: { type: 'string' }
              }
            },
            output: { type: 'null' }
          }
        }
      });
      
      dsl.component('MetricsBehavior', {
        type: ComponentType.ACTOR,
        description: 'Metrics collection behavior with timeout policy',
        version: '1.0.0',
        policies: {
          timeout: {
            recordMetric: { duration: '2s' }
          }
        },
        messageHandlers: {
          recordMetric: {
            input: {
              properties: {
                name: { type: 'string' },
                value: { type: 'number' }
              }
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Create a composite actor that uses behaviors
      const compositeActor = dsl.component('ServiceActor', {
        type: ComponentType.ACTOR,
        description: 'Service actor that composes behaviors',
        version: '1.0.0',
        behaviors: [
          { ref: 'LoggingBehavior' },
          { ref: 'MetricsBehavior' }
        ],
        policies: {
          circuitBreaker: {
            processRequest: { failureThreshold: 5, resetTimeout: '30s' }
          }
        },
        messageHandlers: {
          processRequest: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });

      // Process composite actor policies
      const processedPolicies = mockCore2Adapter.processPolicies(compositeActor);
      
      // Verify the composite actor's own policies
      expect(processedPolicies.circuitBreaker).toBeDefined();
      expect(processedPolicies.circuitBreaker.processRequest).toBeDefined();
      
      // In a real implementation, Core2 would also include the policies from behaviors,
      // applying them to their respective message handlers when those behaviors are used
      // For this test, we just verify the actor's explicitly defined policies
    });
  });
}); 