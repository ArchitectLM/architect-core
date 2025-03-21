import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

/**
 * Behavior Composition Test Suite
 * 
 * This test file demonstrates how behaviors are defined in DSL2 and composed at runtime in Core2.
 * It shows different composition patterns and how behaviors modify actor functionality.
 */
describe('Behavior Composition', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  // Create a mock adapter for Core2 that handles behavior composition
  const mockCore2Adapter = {
    processBehaviors: vi.fn().mockImplementation((actor) => {
      const behaviors = actor.behaviors || [];
      const messageHandlers = { ...(actor.messageHandlers || {}) };
      const processedBehaviors = [];
      
      // Process each behavior and collect its message handlers
      for (const behavior of behaviors) {
        // In a real implementation, we would resolve the behavior component
        // from the reference. Here we mock it directly.
        const behaviorId = behavior.ref;
        const behaviorComponent = dsl.getComponent(behaviorId);
        
        if (behaviorComponent) {
          // Add the behavior to the processed list
          processedBehaviors.push({
            id: behaviorId,
            description: behaviorComponent.description
          });
          
          // Add or enhance the message handlers with behavior's functionality
          if (behaviorComponent.messageHandlers) {
            for (const [handlerName, handlerSchema] of Object.entries(behaviorComponent.messageHandlers)) {
              // If the actor already has this handler, we would enhance it
              // In a real implementation, we would chain the handlers
              // Here we just note that the behavior applies to this handler
              if (messageHandlers[handlerName]) {
                messageHandlers[handlerName] = {
                  ...messageHandlers[handlerName],
                  enhancedBy: [...(messageHandlers[handlerName].enhancedBy || []), behaviorId]
                };
              } else {
                // If the actor doesn't have this handler, add it from the behavior
                messageHandlers[handlerName] = {
                  ...handlerSchema,
                  providedBy: behaviorId
                };
              }
            }
          }
        }
      }
      
      return {
        messageHandlers,
        processedBehaviors
      };
    }),
    
    createActorInstance: vi.fn().mockImplementation((actorDef) => {
      // Process behaviors
      const { messageHandlers, processedBehaviors } = mockCore2Adapter.processBehaviors(actorDef);
      
      // Create mock instance with handlers
      const mockHandlers = {};
      
      // Create handler implementations
      for (const [handlerName, handlerSchema] of Object.entries(messageHandlers)) {
        // Create a mock handler that demonstrates behavior composition
        mockHandlers[handlerName] = vi.fn().mockImplementation(async (message) => {
          // Default response
          const response = { handled: true, handlerName };
          
          // Add information about behaviors
          if (handlerSchema.enhancedBy) {
            response.enhancedBy = handlerSchema.enhancedBy;
          }
          
          if (handlerSchema.providedBy) {
            response.providedBy = handlerSchema.providedBy;
          }
          
          // Special handling for specific message types
          if (handlerName === 'log' && message) {
            return {
              ...response,
              logged: true,
              level: message.level,
              message: message.message
            };
          }
          
          if (handlerName === 'validateInput' && message) {
            return {
              ...response,
              valid: message.data !== undefined,
              data: message.data
            };
          }
          
          if (handlerName === 'processRequest' && message) {
            // Apply all behaviors in sequence
            const results = [];
            
            // Simulate logging behavior
            if (handlerSchema.enhancedBy?.includes('LoggingBehavior')) {
              results.push({ 
                behavior: 'LoggingBehavior', 
                action: 'logged request', 
                data: message 
              });
            }
            
            // Simulate validation behavior
            if (handlerSchema.enhancedBy?.includes('ValidationBehavior')) {
              const isValid = message.data !== undefined;
              results.push({ 
                behavior: 'ValidationBehavior', 
                action: 'validated input', 
                valid: isValid 
              });
              
              // If validation fails, return early
              if (!isValid) {
                return {
                  ...response,
                  success: false,
                  error: 'Validation failed',
                  behaviors: results
                };
              }
            }
            
            // Process the actual request
            results.push({ 
              behavior: 'core', 
              action: 'processed request', 
              data: message.data 
            });
            
            // Simulate metrics behavior
            if (handlerSchema.enhancedBy?.includes('MetricsBehavior')) {
              results.push({ 
                behavior: 'MetricsBehavior', 
                action: 'recorded metrics', 
                duration: 42 
              });
            }
            
            return {
              ...response,
              success: true,
              result: message.data ? `Processed: ${message.data}` : 'Processed',
              behaviors: results
            };
          }
          
          return response;
        });
      }
      
      return {
        id: actorDef.id || `actor-${Date.now()}`,
        definition: actorDef,
        behaviors: processedBehaviors,
        handlers: mockHandlers,
        state: {},
        call: async (handlerName, message) => {
          if (mockHandlers[handlerName]) {
            return mockHandlers[handlerName](message);
          }
          throw new Error(`No handler found for ${handlerName}`);
        }
      };
    })
  };

  describe('Basic Behavior Composition', () => {
    it('should compose behaviors with an actor', async () => {
      // Define behavior components
      dsl.component('LoggingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Logging behavior for actors',
        version: '1.0.0',
        messageHandlers: {
          log: {
            input: {
              properties: {
                level: { type: 'string' },
                message: { type: 'string' }
              },
              required: ['level', 'message']
            },
            output: { type: 'null' }
          }
        }
      });
      
      dsl.component('MetricsBehavior', {
        type: ComponentType.ACTOR,
        description: 'Metrics collection behavior',
        version: '1.0.0',
        messageHandlers: {
          recordMetric: {
            input: {
              properties: {
                name: { type: 'string' },
                value: { type: 'number' }
              },
              required: ['name', 'value']
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Define an actor that uses behaviors
      const serviceActor = dsl.component('ServiceActor', {
        type: ComponentType.ACTOR,
        description: 'Service actor with behaviors',
        version: '1.0.0',
        behaviors: [
          { ref: 'LoggingBehavior' },
          { ref: 'MetricsBehavior' }
        ],
        messageHandlers: {
          processRequest: {
            input: {
              properties: {
                data: { type: 'string' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                result: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Create an actor instance with the Core2 adapter
      const actorInstance = mockCore2Adapter.createActorInstance(serviceActor);
      
      // Verify that the behaviors were processed
      expect(actorInstance.behaviors).toHaveLength(2);
      expect(actorInstance.behaviors[0].id).toBe('LoggingBehavior');
      expect(actorInstance.behaviors[1].id).toBe('MetricsBehavior');
      
      // Verify that the behavior message handlers are available
      const logResult = await actorInstance.call('log', { 
        level: 'info', 
        message: 'Test log message' 
      });
      expect(logResult.logged).toBe(true);
      expect(logResult.providedBy).toBe('LoggingBehavior');
      
      const metricsResult = await actorInstance.call('recordMetric', { 
        name: 'request.count', 
        value: 1 
      });
      expect(metricsResult.providedBy).toBe('MetricsBehavior');
      
      // Verify that the actor's own handler works
      const processResult = await actorInstance.call('processRequest', { 
        data: 'test data' 
      });
      expect(processResult.success).toBe(true);
      expect(processResult.result).toBe('Processed: test data');
    });
    
    it('should allow behaviors to enhance actor message handlers', async () => {
      // Define behavior components that enhance actor functionality
      dsl.component('LoggingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Logging behavior for actors',
        version: '1.0.0',
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
      
      dsl.component('ValidationBehavior', {
        type: ComponentType.ACTOR,
        description: 'Input validation behavior',
        version: '1.0.0',
        messageHandlers: {
          validateInput: {
            input: {
              properties: {
                data: { type: 'any' },
                schema: { type: 'object' }
              }
            },
            output: {
              properties: {
                valid: { type: 'boolean' },
                errors: { type: 'array', optional: true }
              }
            }
          }
        }
      });
      
      dsl.component('MetricsBehavior', {
        type: ComponentType.ACTOR,
        description: 'Metrics collection behavior',
        version: '1.0.0',
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
      
      // Define an actor that uses behaviors to enhance its functionality
      const enhancedActor = dsl.component('EnhancedServiceActor', {
        type: ComponentType.ACTOR,
        description: 'Service actor with enhanced message handlers',
        version: '1.0.0',
        behaviors: [
          { ref: 'LoggingBehavior' },
          { ref: 'ValidationBehavior' },
          { ref: 'MetricsBehavior' }
        ],
        messageHandlers: {
          processRequest: {
            input: {
              properties: {
                data: { type: 'string', optional: true }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                result: { type: 'string', optional: true },
                error: { type: 'string', optional: true }
              }
            }
          }
        }
      });
      
      // Create an actor instance with the Core2 adapter
      const actorInstance = mockCore2Adapter.createActorInstance(enhancedActor);
      
      // Verify that behaviors enhance the actor's functionality
      expect(actorInstance.behaviors).toHaveLength(3);
      
      // Call the enhanced processRequest handler with valid data
      const successResult = await actorInstance.call('processRequest', { 
        data: 'test data' 
      });
      
      expect(successResult.success).toBe(true);
      expect(successResult.result).toBe('Processed: test data');
      expect(successResult.behaviors).toHaveLength(4); // All behaviors + core
      
      // First behavior: logging
      expect(successResult.behaviors[0].behavior).toBe('LoggingBehavior');
      
      // Second behavior: validation
      expect(successResult.behaviors[1].behavior).toBe('ValidationBehavior');
      expect(successResult.behaviors[1].valid).toBe(true);
      
      // Third: core processing
      expect(successResult.behaviors[2].behavior).toBe('core');
      
      // Fourth behavior: metrics
      expect(successResult.behaviors[3].behavior).toBe('MetricsBehavior');
      
      // Call with invalid data to see validation behavior in action
      const failureResult = await actorInstance.call('processRequest', {});
      
      expect(failureResult.success).toBe(false);
      expect(failureResult.error).toBe('Validation failed');
      expect(failureResult.behaviors).toHaveLength(2); // Only logging and validation ran
      
      // Validation failed and prevented core processing
      expect(failureResult.behaviors[1].behavior).toBe('ValidationBehavior');
      expect(failureResult.behaviors[1].valid).toBe(false);
    });
  });

  describe('Advanced Behavior Composition', () => {
    it('should support behavior chains with ordering', async () => {
      // Define behaviors with explicit ordering
      dsl.component('AuthorizationBehavior', {
        type: ComponentType.ACTOR,
        description: 'Authorization behavior',
        version: '1.0.0',
        attributes: {
          executionOrder: 10 // Run first
        },
        messageHandlers: {
          authorize: {
            input: {
              properties: {
                userId: { type: 'string' },
                permission: { type: 'string' }
              }
            },
            output: {
              properties: {
                authorized: { type: 'boolean' },
                reason: { type: 'string', optional: true }
              }
            }
          }
        }
      });
      
      dsl.component('ValidationBehavior', {
        type: ComponentType.ACTOR,
        description: 'Validation behavior',
        version: '1.0.0',
        attributes: {
          executionOrder: 20 // Run second
        },
        messageHandlers: {
          validate: {
            input: {
              properties: {
                data: { type: 'any' },
                schema: { type: 'object' }
              }
            },
            output: {
              properties: {
                valid: { type: 'boolean' },
                errors: { type: 'array', optional: true }
              }
            }
          }
        }
      });
      
      dsl.component('LoggingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Logging behavior',
        version: '1.0.0',
        attributes: {
          executionOrder: 30 // Run third
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
        description: 'Metrics behavior',
        version: '1.0.0',
        attributes: {
          executionOrder: 40 // Run fourth (last)
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
      
      // Define a processor mock that respects behavior ordering
      const mockOrderedProcessor = {
        processBehaviorsInOrder: (actor) => {
          const behaviors = actor.behaviors || [];
          
          // Sort behaviors by execution order
          return behaviors
            .map(behavior => {
              const behaviorComponent = dsl.getComponent(behavior.ref);
              return {
                id: behavior.ref,
                order: behaviorComponent?.attributes?.executionOrder || 999,
                description: behaviorComponent?.description || ''
              };
            })
            .sort((a, b) => a.order - b.order);
        }
      };
      
      // Define an actor with ordered behaviors
      const apiActor = dsl.component('ApiActor', {
        type: ComponentType.ACTOR,
        description: 'API handler with ordered behaviors',
        version: '1.0.0',
        behaviors: [
          // Deliberately in mixed order
          { ref: 'MetricsBehavior' },
          { ref: 'LoggingBehavior' },
          { ref: 'AuthorizationBehavior' },
          { ref: 'ValidationBehavior' }
        ],
        messageHandlers: {
          handleRequest: {
            input: {
              properties: {
                path: { type: 'string' },
                method: { type: 'string' },
                headers: { type: 'object' },
                body: { type: 'any', optional: true }
              }
            },
            output: {
              properties: {
                status: { type: 'number' },
                body: { type: 'any', optional: true }
              }
            }
          }
        }
      });
      
      // Process behaviors according to order
      const orderedBehaviors = mockOrderedProcessor.processBehaviorsInOrder(apiActor);
      
      // Verify the behaviors were ordered correctly
      expect(orderedBehaviors).toHaveLength(4);
      expect(orderedBehaviors[0].id).toBe('AuthorizationBehavior');
      expect(orderedBehaviors[1].id).toBe('ValidationBehavior');
      expect(orderedBehaviors[2].id).toBe('LoggingBehavior');
      expect(orderedBehaviors[3].id).toBe('MetricsBehavior');
    });
    
    it('should support conditional behavior application', () => {
      // Define behaviors with conditions
      dsl.component('CachingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Caching behavior',
        version: '1.0.0',
        attributes: {
          appliesTo: {
            messagePatterns: ['get*', 'fetch*', 'retrieve*'],
            excludeMessages: ['getStream']
          }
        },
        messageHandlers: {
          cacheResult: {
            input: {
              properties: {
                key: { type: 'string' },
                value: { type: 'any' },
                ttl: { type: 'number', optional: true }
              }
            },
            output: { type: 'null' }
          },
          getCachedResult: {
            input: {
              properties: {
                key: { type: 'string' }
              }
            },
            output: { type: 'any' }
          }
        }
      });
      
      dsl.component('RateLimitingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Rate limiting behavior',
        version: '1.0.0',
        attributes: {
          appliesTo: {
            messagePatterns: ['create*', 'update*', 'delete*'],
            environments: ['production']
          }
        },
        messageHandlers: {
          checkRateLimit: {
            input: {
              properties: {
                key: { type: 'string' },
                limit: { type: 'number', optional: true }
              }
            },
            output: {
              properties: {
                allowed: { type: 'boolean' },
                remaining: { type: 'number' },
                resetAt: { type: 'string', optional: true }
              }
            }
          }
        }
      });
      
      // Define a processor mock that applies behaviors conditionally
      const mockConditionalProcessor = {
        shouldApplyBehavior: (behavior, messageHandler, environment) => {
          const behaviorComponent = dsl.getComponent(behavior.ref);
          if (!behaviorComponent || !behaviorComponent.attributes?.appliesTo) {
            return true; // No conditions, apply to all
          }
          
          const { appliesTo } = behaviorComponent.attributes;
          
          // Check message patterns
          if (appliesTo.messagePatterns) {
            const matches = appliesTo.messagePatterns.some(pattern => {
              if (pattern.endsWith('*')) {
                const prefix = pattern.slice(0, -1);
                return messageHandler.startsWith(prefix);
              }
              return pattern === messageHandler;
            });
            
            if (!matches) return false;
          }
          
          // Check excluded messages
          if (appliesTo.excludeMessages && appliesTo.excludeMessages.includes(messageHandler)) {
            return false;
          }
          
          // Check environments
          if (appliesTo.environments && !appliesTo.environments.includes(environment)) {
            return false;
          }
          
          return true;
        },
        
        getApplicableBehaviors: (actor, messageHandler, environment) => {
          const behaviors = actor.behaviors || [];
          
          return behaviors.filter(behavior => 
            mockConditionalProcessor.shouldApplyBehavior(behavior, messageHandler, environment)
          ).map(behavior => dsl.getComponent(behavior.ref));
        }
      };
      
      // Define an actor with conditional behaviors
      const dataActor = dsl.component('DataActor', {
        type: ComponentType.ACTOR,
        description: 'Data access actor with conditional behaviors',
        version: '1.0.0',
        behaviors: [
          { ref: 'CachingBehavior' },
          { ref: 'RateLimitingBehavior' }
        ],
        messageHandlers: {
          getData: {
            input: {
              properties: {
                id: { type: 'string' }
              }
            },
            output: { type: 'object' }
          },
          getStream: {
            input: {
              properties: {
                streamId: { type: 'string' }
              }
            },
            output: { type: 'object' }
          },
          createData: {
            input: {
              properties: {
                data: { type: 'object' }
              }
            },
            output: {
              properties: {
                id: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Test behavior application in development environment
      const devGetDataBehaviors = mockConditionalProcessor.getApplicableBehaviors(
        dataActor, 'getData', 'development'
      );
      
      expect(devGetDataBehaviors).toHaveLength(1);
      expect(devGetDataBehaviors[0].description).toBe('Caching behavior');
      
      const devGetStreamBehaviors = mockConditionalProcessor.getApplicableBehaviors(
        dataActor, 'getStream', 'development'
      );
      
      expect(devGetStreamBehaviors).toHaveLength(0); // Excluded by CachingBehavior
      
      const devCreateDataBehaviors = mockConditionalProcessor.getApplicableBehaviors(
        dataActor, 'createData', 'development'
      );
      
      expect(devCreateDataBehaviors).toHaveLength(0); // RateLimiting only in production
      
      // Test behavior application in production environment
      const prodGetDataBehaviors = mockConditionalProcessor.getApplicableBehaviors(
        dataActor, 'getData', 'production'
      );
      
      expect(prodGetDataBehaviors).toHaveLength(1);
      expect(prodGetDataBehaviors[0].description).toBe('Caching behavior');
      
      const prodCreateDataBehaviors = mockConditionalProcessor.getApplicableBehaviors(
        dataActor, 'createData', 'production'
      );
      
      expect(prodCreateDataBehaviors).toHaveLength(1);
      expect(prodCreateDataBehaviors[0].description).toBe('Rate limiting behavior');
    });
    
    it('should support nested behavior composition', async () => {
      // Define a base behavior
      dsl.component('TracingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Request tracing behavior',
        version: '1.0.0',
        messageHandlers: {
          startTrace: {
            input: {
              properties: {
                name: { type: 'string' }
              }
            },
            output: {
              properties: {
                traceId: { type: 'string' }
              }
            }
          },
          endTrace: {
            input: {
              properties: {
                traceId: { type: 'string' }
              }
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Define a composite behavior that uses other behaviors
      dsl.component('MonitoringBehavior', {
        type: ComponentType.ACTOR,
        description: 'Composite monitoring behavior',
        version: '1.0.0',
        behaviors: [
          { ref: 'TracingBehavior' }
        ],
        messageHandlers: {
          monitor: {
            input: {
              properties: {
                operation: { type: 'string' },
                data: { type: 'any', optional: true }
              }
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Create a mock for nested behavior processing
      const mockNestedProcessor = {
        processNestedBehaviors: (actor) => {
          const flattenedBehaviors = [];
          const processedRefs = new Set();
          
          const flattenBehaviors = (component) => {
            if (!component.behaviors) return;
            
            for (const behavior of component.behaviors) {
              const behaviorId = behavior.ref;
              
              // Avoid circular references
              if (processedRefs.has(behaviorId)) continue;
              processedRefs.add(behaviorId);
              
              const behaviorComponent = dsl.getComponent(behaviorId);
              if (behaviorComponent) {
                flattenedBehaviors.push({
                  id: behaviorId,
                  description: behaviorComponent.description
                });
                
                // Recursively process nested behaviors
                flattenBehaviors(behaviorComponent);
              }
            }
          };
          
          flattenBehaviors(actor);
          return flattenedBehaviors;
        }
      };
      
      // Define an actor with nested behaviors
      const apiGatewayActor = dsl.component('ApiGatewayActor', {
        type: ComponentType.ACTOR,
        description: 'API Gateway actor with nested behaviors',
        version: '1.0.0',
        behaviors: [
          { ref: 'MonitoringBehavior' }
        ],
        messageHandlers: {
          handleRequest: {
            input: {
              properties: {
                path: { type: 'string' },
                method: { type: 'string' },
                headers: { type: 'object' },
                body: { type: 'any', optional: true }
              }
            },
            output: {
              properties: {
                status: { type: 'number' },
                body: { type: 'any', optional: true }
              }
            }
          }
        }
      });
      
      // Process nested behaviors
      const flattenedBehaviors = mockNestedProcessor.processNestedBehaviors(apiGatewayActor);
      
      // Verify the flattened behaviors include both direct and nested ones
      expect(flattenedBehaviors).toHaveLength(2);
      expect(flattenedBehaviors[0].id).toBe('MonitoringBehavior');
      expect(flattenedBehaviors[1].id).toBe('TracingBehavior');
    });
  });
}); 