import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { createTestDSL, createMockContext, createTestEventLog } from './actor-system-test-utils.js';

/**
 * Tests for Expected Errors and Exceptions in Actor Systems
 * 
 * This test file demonstrates how errors are handled and propagated
 * in the actor system, including error patterns, recovery, and
 * supervision strategies.
 */
describe('Expected Errors and Exceptions', () => {
  let dsl: DSL;
  let eventLog: ReturnType<typeof createTestEventLog>;
  
  beforeEach(() => {
    dsl = createTestDSL();
    eventLog = createTestEventLog();
  });

  describe('Error Handling Patterns', () => {
    it('should define actors with error handlers', () => {
      // Define an actor with error handlers
      const actor = dsl.component('ErrorHandlingActor', {
        type: ComponentType.ACTOR,
        description: 'Actor with explicit error handlers',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { type: 'object' },
            output: { type: 'object' }
          },
          handleError: {
            input: {
              properties: {
                error: { type: 'object' },
                source: { type: 'string' },
                context: { type: 'object' }
              },
              required: ['error', 'source']
            },
            output: {
              properties: {
                handled: { type: 'boolean' },
                action: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Implement the actor
      const implementation = dsl.implementation('ErrorHandlingActorImpl', {
        targetComponent: 'ErrorHandlingActor',
        description: 'Implementation of error handling actor',
        version: '1.0.0',
        handlers: {
          process: async (input: any, context: any) => {
            if (input.shouldFail) {
              throw new Error('Intentional failure');
            }
            return { success: true, data: input.data };
          },
          handleError: async (input: any, context: any) => {
            eventLog.recordEvent('ErrorHandlingActor', 'handleError', {
              error: input.error.message,
              source: input.source
            });
            return { 
              handled: true, 
              action: 'recover' 
            };
          }
        }
      });
      
      // Verify actor definition
      expect(actor.id).toBe('ErrorHandlingActor');
      expect(actor.messageHandlers?.process).toBeDefined();
      expect(actor.messageHandlers?.handleError).toBeDefined();
      
      // Verify implementation has both regular and error handlers
      expect(implementation.handlers.process).toBeDefined();
      expect(implementation.handlers.handleError).toBeDefined();
    });
    
    it('should define actors with supervision strategies', () => {
      // Define a parent actor with supervision strategy
      const supervisorActor = dsl.component('SupervisorActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that supervises other actors',
        version: '1.0.0',
        attributes: {
          supervision: {
            strategy: 'restart', // restart, resume, or stop
            maxRestarts: 3,
            withinTimeframe: '1m'
          }
        },
        messageHandlers: {
          supervise: {
            input: { 
              properties: { 
                targetActor: { type: 'string' },
                operation: { type: 'string' }
              } 
            },
            output: { type: 'object' }
          },
          handleChildFailure: {
            input: {
              properties: {
                childActor: { type: 'string' },
                error: { type: 'object' },
                operation: { type: 'string' }
              }
            },
            output: {
              properties: {
                decision: { type: 'string' } // restart, resume, stop
              }
            }
          }
        }
      });
      
      // Define a child actor that can fail
      const childActor = dsl.component('ChildActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that can fail',
        version: '1.0.0',
        messageHandlers: {
          riskyOperation: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      // Verify actor definitions
      expect(supervisorActor.id).toBe('SupervisorActor');
      expect(supervisorActor.attributes?.supervision).toBeDefined();
      expect(supervisorActor.attributes?.supervision?.strategy).toBe('restart');
      expect(supervisorActor.messageHandlers?.handleChildFailure).toBeDefined();
      
      expect(childActor.id).toBe('ChildActor');
      expect(childActor.messageHandlers?.riskyOperation).toBeDefined();
    });
  });

  describe('Error Propagation', () => {
    it('should define components for error propagation testing', () => {
      // Define actors in an error propagation chain
      const frontendActor = dsl.component('FrontendActor', {
        type: ComponentType.ACTOR,
        description: 'Frontend actor that receives user requests',
        version: '1.0.0',
        messageHandlers: {
          handleRequest: {
            input: { type: 'object' },
            output: { type: 'object' }
          },
          handleError: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      const serviceActor = dsl.component('ServiceActor', {
        type: ComponentType.ACTOR,
        description: 'Service actor that processes business logic',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      const databaseActor = dsl.component('DatabaseActor', {
        type: ComponentType.ACTOR,
        description: 'Database actor for data operations',
        version: '1.0.0',
        messageHandlers: {
          query: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      // Define a system with error propagation path
      const system = dsl.system('ErrorPropagationSystem', {
        description: 'System for testing error propagation',
        version: '1.0.0',
        attributes: {
          errorHandling: {
            propagation: 'bubbleUp', // Errors bubble up to parent actors
            defaultStrategy: 'restart'
          }
        },
        components: {
          actors: [
            { ref: 'FrontendActor' },
            { ref: 'ServiceActor' },
            { ref: 'DatabaseActor' }
          ]
        }
      });
      
      // Verify system definition
      expect(system.id).toBe('ErrorPropagationSystem');
      expect(system.attributes?.errorHandling).toBeDefined();
      expect(system.attributes?.errorHandling?.propagation).toBe('bubbleUp');
      expect(system.components?.actors?.length).toBe(3);
    });
  });

  describe('Error Classification and Recovery', () => {
    it('should define actors with error classification and recovery strategies', () => {
      // Define an actor with error classification and recovery strategies
      const robustActor = dsl.component('RobustActor', {
        type: ComponentType.ACTOR,
        description: 'Actor with detailed error handling',
        version: '1.0.0',
        attributes: {
          errorHandling: {
            classification: {
              // Define error classes
              transient: {
                // Transient errors can be retried
                patterns: ['timeout', 'connection refused', 'too many connections'],
                recovery: 'retry'
              },
              permanent: {
                // Permanent errors require manual intervention
                patterns: ['permission denied', 'not found', 'invalid format'],
                recovery: 'stop'
              },
              unknown: {
                // Unknown errors have a fallback strategy
                recovery: 'escalate'
              }
            }
          }
        },
        messageHandlers: {
          operation: {
            input: { type: 'object' },
            output: { type: 'object' }
          },
          handleTransientError: {
            input: { type: 'object' },
            output: { type: 'object' }
          },
          handlePermanentError: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      // Verify actor definition
      expect(robustActor.id).toBe('RobustActor');
      expect(robustActor.attributes?.errorHandling?.classification).toBeDefined();
      expect(robustActor.attributes?.errorHandling?.classification?.transient?.recovery).toBe('retry');
      expect(robustActor.attributes?.errorHandling?.classification?.permanent?.recovery).toBe('stop');
      expect(robustActor.messageHandlers?.handleTransientError).toBeDefined();
      expect(robustActor.messageHandlers?.handlePermanentError).toBeDefined();
    });
  });
  
  describe('Custom Error Types', () => {
    it('should define custom error types for the system', () => {
      // Define schema components for error types
      const validationErrorSchema = dsl.component('ValidationError', {
        type: ComponentType.SCHEMA,
        description: 'Schema for validation errors',
        version: '1.0.0',
        properties: {
          code: { type: 'string' },
          field: { type: 'string' },
          message: { type: 'string' },
          value: { type: 'any' }
        },
        required: ['code', 'message']
      });
      
      const businessErrorSchema = dsl.component('BusinessError', {
        type: ComponentType.SCHEMA,
        description: 'Schema for business logic errors',
        version: '1.0.0',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
          recoverable: { type: 'boolean' }
        },
        required: ['code', 'message']
      });
      
      const systemErrorSchema = dsl.component('SystemError', {
        type: ComponentType.SCHEMA,
        description: 'Schema for system-level errors',
        version: '1.0.0',
        properties: {
          code: { type: 'string' },
          component: { type: 'string' },
          message: { type: 'string' },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical']
          }
        },
        required: ['code', 'component', 'message', 'severity']
      });
      
      // Define an actor that uses these error types
      const errorHandlingActor = dsl.component('TypedErrorHandlingActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that handles typed errors',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { type: 'object' },
            output: { type: 'object' },
            errors: [
              { ref: 'ValidationError' },
              { ref: 'BusinessError' },
              { ref: 'SystemError' }
            ]
          },
          handleValidationError: {
            input: { ref: 'ValidationError' },
            output: { type: 'object' }
          },
          handleBusinessError: {
            input: { ref: 'BusinessError' },
            output: { type: 'object' }
          },
          handleSystemError: {
            input: { ref: 'SystemError' },
            output: { type: 'object' }
          }
        }
      });
      
      // Verify component definitions
      expect(validationErrorSchema.id).toBe('ValidationError');
      expect(businessErrorSchema.id).toBe('BusinessError');
      expect(systemErrorSchema.id).toBe('SystemError');
      
      expect(errorHandlingActor.id).toBe('TypedErrorHandlingActor');
      expect(errorHandlingActor.messageHandlers?.process).toBeDefined();
      
      // Verify message handler has error types
      const processHandler = errorHandlingActor.messageHandlers?.process;
      expect(processHandler?.errors).toBeDefined();
      expect(processHandler?.errors?.length).toBe(3);
      expect(processHandler?.errors?.[0].ref).toBe('ValidationError');
    });
  });
}); 