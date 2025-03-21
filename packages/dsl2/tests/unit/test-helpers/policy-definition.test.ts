import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { createTestDSL } from './actor-system-test-utils.js';

/**
 * Tests for policy definition and validation in the DSL
 * 
 * These tests focus on how policies are defined, validated, and composed
 * in the DSL, not on the actual implementation of policies (which is in core2)
 */
describe('Policy Definition and Validation', () => {
  let dsl: DSL;
  
  beforeEach(() => {
    dsl = createTestDSL();
  });

  it('should define components with valid retry policies', () => {
    // Define an actor with retry policies
    const actorWithPolicy = dsl.component('RetryActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with retry policies',
      version: '1.0.0',
      policies: {
        retry: {
          // Operation-specific policy
          'getData': {
            attempts: 3,
            backoff: 'exponential',
            initialDelay: '100ms'
          },
          // Wildcard policy for all operations
          '*': {
            attempts: 2,
            backoff: 'linear',
            initialDelay: '50ms'
          }
        }
      },
      messageHandlers: {
        getData: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        updateData: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify the actor was created with policies
    expect(actorWithPolicy.id).toBe('RetryActor');
    expect(actorWithPolicy.policies).toBeDefined();
    expect(actorWithPolicy.policies.retry).toBeDefined();
    expect(actorWithPolicy.policies.retry['getData'].attempts).toBe(3);
    expect(actorWithPolicy.policies.retry['getData'].backoff).toBe('exponential');
    expect(actorWithPolicy.policies.retry['*'].attempts).toBe(2);
  });

  it('should define components with valid rate limiting policies', () => {
    // Define an actor with rate limiting policies
    const actorWithRateLimit = dsl.component('RateLimitedActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with rate limiting',
      version: '1.0.0',
      policies: {
        rateLimiting: {
          // Pattern match for all API-related operations
          'api.*': {
            limit: 10,
            window: '1m'
          },
          // Specific operation policy
          'criticalOperation': {
            limit: 2,
            window: '5m'
          }
        }
      },
      messageHandlers: {
        'api.getData': {
          input: { type: 'object' },
          output: { type: 'object' },
          pattern: true
        },
        'api.updateData': {
          input: { type: 'object' },
          output: { type: 'object' },
          pattern: true
        },
        'criticalOperation': {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify the actor was created with policies
    expect(actorWithRateLimit.id).toBe('RateLimitedActor');
    expect(actorWithRateLimit.policies).toBeDefined();
    expect(actorWithRateLimit.policies.rateLimiting).toBeDefined();
    expect(actorWithRateLimit.policies.rateLimiting['api.*'].limit).toBe(10);
    expect(actorWithRateLimit.policies.rateLimiting['api.*'].window).toBe('1m');
    expect(actorWithRateLimit.policies.rateLimiting['criticalOperation'].limit).toBe(2);
  });

  it('should define components with valid circuit breaker policies', () => {
    // Define an actor with circuit breaker policies
    const actorWithCircuitBreaker = dsl.component('CircuitBreakerActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with circuit breakers',
      version: '1.0.0',
      policies: {
        circuitBreaker: {
          'externalService': {
            failureThreshold: 5,
            resetTimeout: '30s'
          },
          'databaseOperation': {
            failureThreshold: 3,
            resetTimeout: '10s'
          }
        }
      },
      messageHandlers: {
        callExternalService: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        databaseOperation: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify the actor was created with policies
    expect(actorWithCircuitBreaker.id).toBe('CircuitBreakerActor');
    expect(actorWithCircuitBreaker.policies).toBeDefined();
    expect(actorWithCircuitBreaker.policies.circuitBreaker).toBeDefined();
    expect(actorWithCircuitBreaker.policies.circuitBreaker['externalService'].failureThreshold).toBe(5);
    expect(actorWithCircuitBreaker.policies.circuitBreaker['externalService'].resetTimeout).toBe('30s');
    expect(actorWithCircuitBreaker.policies.circuitBreaker['databaseOperation'].failureThreshold).toBe(3);
  });

  it('should define systems with policies that apply to contained actors', () => {
    // Define actors that will be part of the system
    dsl.component('ServiceActor', {
      type: ComponentType.ACTOR,
      description: 'Service actor',
      version: '1.0.0',
      messageHandlers: {
        handleRequest: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('DatabaseActor', {
      type: ComponentType.ACTOR,
      description: 'Database actor',
      version: '1.0.0',
      messageHandlers: {
        query: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define a system with policies
    const system = dsl.system('PolicySystem', {
      description: 'System with policies for components',
      version: '1.0.0',
      policies: {
        timeout: {
          '*': { duration: '5s' },
          'database.*': { duration: '30s' }
        },
        security: {
          authentication: { required: true }
        }
      },
      components: {
        actors: [
          { ref: 'ServiceActor' },
          { ref: 'DatabaseActor' }
        ]
      }
    });
    
    // Verify the system was created with policies
    expect(system.id).toBe('PolicySystem');
    expect(system.policies).toBeDefined();
    expect(system.policies.timeout).toBeDefined();
    expect(system.policies.timeout['*'].duration).toBe('5s');
    expect(system.policies.timeout['database.*'].duration).toBe('30s');
    expect(system.policies.security.authentication.required).toBe(true);
    
    // Verify the system contains the actors
    expect(system.components.actors.length).toBe(2);
    expect(system.components.actors[0].ref).toBe('ServiceActor');
    expect(system.components.actors[1].ref).toBe('DatabaseActor');
  });

  it('should allow actors to inherit policies from behaviors', () => {
    // Define a behavior with policies
    dsl.component('LoggingBehavior', {
      type: ComponentType.ACTOR,
      description: 'Logging behavior with policies',
      version: '1.0.0',
      policies: {
        retry: {
          'log': {
            attempts: 3,
            backoff: 'linear'
          }
        }
      },
      messageHandlers: {
        log: {
          input: { type: 'object' },
          output: { type: 'null' }
        }
      }
    });
    
    // Define an actor that uses the behavior
    const actorWithBehavior = dsl.component('ServiceWithLogging', {
      type: ComponentType.ACTOR,
      description: 'Service actor with logging behavior',
      version: '1.0.0',
      behaviors: [
        { ref: 'LoggingBehavior' }
      ],
      // Actor defines its own policies in addition to inherited ones
      policies: {
        timeout: {
          '*': { duration: '10s' }
        }
      },
      messageHandlers: {
        handleRequest: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify the actor has policies from both itself and its behavior
    expect(actorWithBehavior.id).toBe('ServiceWithLogging');
    expect(actorWithBehavior.behaviors).toBeDefined();
    expect(actorWithBehavior.behaviors.length).toBe(1);
    expect(actorWithBehavior.behaviors[0].ref).toBe('LoggingBehavior');
    
    // The actor has its own policies
    expect(actorWithBehavior.policies).toBeDefined();
    expect(actorWithBehavior.policies.timeout).toBeDefined();
    expect(actorWithBehavior.policies.timeout['*'].duration).toBe('10s');
    
    // The behavior's policies would be merged at runtime, but the DSL just stores
    // the component definitions and behavior references
  });

  it('should override parent policies in extensions', () => {
    // Define a base actor with policies
    dsl.component('BaseActor', {
      type: ComponentType.ACTOR,
      description: 'Base actor with policies',
      version: '1.0.0',
      policies: {
        retry: {
          '*': { attempts: 2, backoff: 'linear' }
        },
        timeout: {
          '*': { duration: '5s' }
        }
      },
      messageHandlers: {
        baseOperation: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define an actor that extends the base actor
    const extendedActor = dsl.component('ExtendedActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that extends base actor',
      version: '1.0.0',
      extends: { ref: 'BaseActor' },
      // Override some policies
      policies: {
        retry: {
          'criticalOperation': { attempts: 5, backoff: 'exponential' }
        },
        // Add new policy type
        circuitBreaker: {
          'criticalOperation': { failureThreshold: 3, resetTimeout: '30s' }
        }
      },
      messageHandlers: {
        criticalOperation: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify the actor has extended correctly
    expect(extendedActor.id).toBe('ExtendedActor');
    expect(extendedActor.extends).toBeDefined();
    expect(extendedActor.extends.ref).toBe('BaseActor');
    
    // The actor has its own policies that would override base policies at runtime
    expect(extendedActor.policies).toBeDefined();
    expect(extendedActor.policies.retry).toBeDefined();
    expect(extendedActor.policies.retry['criticalOperation']).toBeDefined();
    expect(extendedActor.policies.retry['criticalOperation'].attempts).toBe(5);
    expect(extendedActor.policies.circuitBreaker).toBeDefined();
    expect(extendedActor.policies.circuitBreaker['criticalOperation']).toBeDefined();
  });

  it('should define components with multiple policy types', () => {
    // Define an actor with multiple policy types
    const actorWithMultiplePolicies = dsl.component('MultiPolicyActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with multiple policy types',
      version: '1.0.0',
      policies: {
        retry: {
          '*': { attempts: 3, backoff: 'linear' }
        },
        timeout: {
          '*': { duration: '5s' },
          'slowOperation': { duration: '30s' }
        },
        rateLimiting: {
          'api.*': { limit: 10, window: '1m' }
        },
        circuitBreaker: {
          'externalService': { failureThreshold: 5, resetTimeout: '30s' }
        },
        security: {
          authentication: { required: true }
        }
      },
      messageHandlers: {
        'api.getData': {
          input: { type: 'object' },
          output: { type: 'object' },
          pattern: true
        },
        'externalService': {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        'slowOperation': {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify the actor was created with multiple policy types
    expect(actorWithMultiplePolicies.id).toBe('MultiPolicyActor');
    expect(actorWithMultiplePolicies.policies).toBeDefined();
    expect(Object.keys(actorWithMultiplePolicies.policies).length).toBe(5);
    
    // Check each policy type
    expect(actorWithMultiplePolicies.policies.retry).toBeDefined();
    expect(actorWithMultiplePolicies.policies.timeout).toBeDefined();
    expect(actorWithMultiplePolicies.policies.rateLimiting).toBeDefined();
    expect(actorWithMultiplePolicies.policies.circuitBreaker).toBeDefined();
    expect(actorWithMultiplePolicies.policies.security).toBeDefined();
    
    // Verify specific policy configurations
    expect(actorWithMultiplePolicies.policies.timeout['slowOperation'].duration).toBe('30s');
    expect(actorWithMultiplePolicies.policies.rateLimiting['api.*'].limit).toBe(10);
    expect(actorWithMultiplePolicies.policies.circuitBreaker['externalService'].failureThreshold).toBe(5);
  });
}); 