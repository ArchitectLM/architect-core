import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../src/models/component.js';

/**
 * This test file demonstrates the proposed simplified DSL approach
 * that focuses on a minimal set of core component types with
 * attribute-based specialization and composition.
 */
describe('Simplified DSL', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('Core Component Types', () => {
    it('should support the minimal set of core component types', () => {
      // SCHEMA component
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'name', 'email']
      });

      // EVENT component
      const userCreatedEvent = dsl.component('UserCreated', {
        type: ComponentType.EVENT,
        description: 'Event emitted when a user is created',
        version: '1.0.0',
        payload: {
          properties: {
            userId: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['userId', 'name', 'email', 'timestamp']
        }
      });

      // ACTOR component
      const userActor = dsl.component('UserActor', {
        type: ComponentType.ACTOR,
        description: 'Actor managing user operations',
        version: '1.0.0',
        state: {
          properties: {
            users: { type: 'array', items: { ref: 'User' } }
          }
        },
        messageHandlers: {
          createUser: {
            input: {
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' }
              },
              required: ['name', 'email']
            },
            output: { ref: 'User' },
            produces: [{ event: 'UserCreated' }]
          },
          getUser: {
            input: {
              properties: {
                userId: { type: 'string' }
              },
              required: ['userId']
            },
            output: { ref: 'User' }
          }
        }
      });

      // PROCESS component
      const registrationProcess = dsl.component('UserRegistrationProcess', {
        type: ComponentType.PROCESS,
        description: 'User registration workflow',
        version: '1.0.0',
        initialState: 'started',
        states: {
          started: {
            description: 'Registration started',
            transitions: [
              { 
                event: 'EMAIL_VERIFICATION_SENT',
                target: 'awaiting_verification',
                action: {
                  actor: 'EmailActor',
                  message: 'sendVerificationEmail'
                }
              }
            ]
          },
          awaiting_verification: {
            description: 'Waiting for email verification',
            transitions: [
              {
                event: 'EMAIL_VERIFIED',
                target: 'completed',
                action: {
                  actor: 'UserActor',
                  message: 'verifyEmail'
                }
              }
            ]
          },
          completed: {
            description: 'Registration completed',
            final: true
          }
        }
      });

      // SYSTEM component
      const userSystem = dsl.system('UserManagementSystem', {
        description: 'System for managing users',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'User' }],
          events: [{ ref: 'UserCreated' }],
          actors: [{ ref: 'UserActor' }],
          processes: [{ ref: 'UserRegistrationProcess' }]
        }
      });

      // Verify all components were created correctly
      expect(userSchema.type).toBe(ComponentType.SCHEMA);
      expect(userCreatedEvent.type).toBe(ComponentType.EVENT);
      expect(userActor.type).toBe(ComponentType.ACTOR);
      expect(registrationProcess.type).toBe(ComponentType.PROCESS);
      expect(userSystem.id).toBe('UserManagementSystem');
    });
  });

  describe('Attribute-Based Specialization', () => {
    it('should support event sourcing via attributes on actors', () => {
      // Define an event-sourced actor through attributes
      const userEventStore = dsl.component('UserEventStore', {
        type: ComponentType.ACTOR,
        description: 'Event-sourced user store',
        version: '1.0.0',
        attributes: {
          eventSourced: {
            enabled: true,
            events: [
              { ref: 'UserCreated' },
              { ref: 'UserProfileUpdated' }
            ],
            snapshotFrequency: 100
          }
        },
        state: {
          properties: {
            users: { type: 'array', items: { ref: 'User' } }
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
            output: { ref: 'User' },
            produces: [{ event: 'UserCreated' }]
          },
          updateUserProfile: {
            input: {
              properties: {
                userId: { type: 'string' },
                name: { type: 'string' },
                bio: { type: 'string' }
              },
              required: ['userId']
            },
            output: { ref: 'User' },
            produces: [{ event: 'UserProfileUpdated' }]
          }
        }
      });

      expect(userEventStore).toBeDefined();
      expect(userEventStore.type).toBe(ComponentType.ACTOR);
      expect(userEventStore.attributes).toBeDefined();
      expect(userEventStore.attributes.eventSourced.enabled).toBe(true);
      expect(userEventStore.attributes.eventSourced.events).toHaveLength(2);
    });

    it('should support CQRS via system attributes', () => {
      // Define a CQRS system through attributes
      const cqrsSystem = dsl.system('UserCQRSSystem', {
        description: 'CQRS system for user management',
        version: '1.0.0',
        attributes: {
          cqrs: {
            enabled: true,
            commandSide: { ref: 'UserCommandSubsystem' },
            querySide: { ref: 'UserQuerySubsystem' },
            eventBus: { ref: 'UserEventBus' }
          }
        },
        components: {
          systems: [
            { ref: 'UserCommandSubsystem' },
            { ref: 'UserQuerySubsystem' }
          ],
          processes: [
            { ref: 'UserEventBus' }
          ]
        }
      });

      expect(cqrsSystem).toBeDefined();
      expect(cqrsSystem.attributes).toBeDefined();
      expect(cqrsSystem.attributes.cqrs.enabled).toBe(true);
      expect(cqrsSystem.attributes.cqrs.commandSide).toEqual({ ref: 'UserCommandSubsystem' });
    });

    it('should support message bus via process attributes', () => {
      // Define a message bus as a process with attributes
      const messageBus = dsl.component('ApplicationBus', {
        type: ComponentType.PROCESS,
        description: 'Application message bus',
        version: '1.0.0',
        attributes: {
          messageBus: {
            enabled: true,
            messageTypes: [
              { ref: 'UserCommand' },
              { ref: 'SystemEvent' }
            ],
            deliveryGuarantee: 'at-least-once',
            subscriptions: [
              { messageType: 'UserCommand', subscribers: ['UserCommandHandler'] },
              { messageType: 'SystemEvent', subscribers: ['AuditLogger', 'MetricsCollector'] }
            ]
          }
        },
        initialState: 'running',
        states: {
          running: {
            description: 'Message bus is running',
            transitions: [
              { event: 'STOP', target: 'stopped' }
            ]
          },
          stopped: {
            description: 'Message bus is stopped',
            transitions: [
              { event: 'START', target: 'running' }
            ]
          }
        }
      });

      expect(messageBus).toBeDefined();
      expect(messageBus.type).toBe(ComponentType.PROCESS);
      expect(messageBus.attributes).toBeDefined();
      expect(messageBus.attributes.messageBus.enabled).toBe(true);
      expect(messageBus.attributes.messageBus.messageTypes).toHaveLength(2);
    });
  });

  describe('Actor Composition', () => {
    it('should support actor composition through behavior references', () => {
      // Define a logging behavior actor
      dsl.component('LoggingBehavior', {
        type: ComponentType.ACTOR,
        description: 'Logging behavior',
        version: '1.0.0',
        messageHandlers: {
          logInfo: {
            input: {
              properties: {
                message: { type: 'string' },
                data: { type: 'object' }
              },
              required: ['message']
            },
            output: { type: 'null' }
          },
          logError: {
            input: {
              properties: {
                message: { type: 'string' },
                error: { type: 'object' }
              },
              required: ['message']
            },
            output: { type: 'null' }
          }
        }
      });

      // Define an actor that composes the logging behavior
      const enhancedActor = dsl.component('EnhancedUserActor', {
        type: ComponentType.ACTOR,
        description: 'User actor with logging behavior',
        version: '1.0.0',
        behaviors: [
          { ref: 'LoggingBehavior' }
        ],
        state: {
          properties: {
            users: { type: 'array', items: { ref: 'User' } }
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
            output: { ref: 'User' }
          }
        }
      });

      expect(enhancedActor).toBeDefined();
      expect(enhancedActor.behaviors).toBeDefined();
      expect(enhancedActor.behaviors).toHaveLength(1);
      expect(enhancedActor.behaviors[0].ref).toBe('LoggingBehavior');
      
      // The composed actor should have both its own message handlers
      expect(enhancedActor.messageHandlers).toHaveProperty('createUser');
      
      // And the message handlers from the behaviors (in a real implementation, these would be merged)
      // This would typically be handled by the runtime, not directly in the component definition
    });
  });

  describe('Policy Definition', () => {
    it('should support policy definition at the actor level', () => {
      // Define an actor with policies
      const paymentActor = dsl.component('PaymentProcessorActor', {
        type: ComponentType.ACTOR,
        description: 'Payment processor actor',
        version: '1.0.0',
        policies: {
          retry: {
            'processPayment': {
              attempts: 3,
              backoff: 'exponential',
              initialDelay: '100ms'
            }
          },
          circuitBreaker: {
            'processPayment': {
              failureThreshold: 5,
              resetTimeout: '30s'
            }
          },
          timeout: {
            'processPayment': {
              duration: '5s'
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
              },
              required: ['amount', 'currency', 'cardToken']
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

      expect(paymentActor).toBeDefined();
      expect(paymentActor.policies).toBeDefined();
      expect(paymentActor.policies.retry).toBeDefined();
      expect(paymentActor.policies.retry.processPayment.attempts).toBe(3);
      expect(paymentActor.policies.circuitBreaker).toBeDefined();
      expect(paymentActor.policies.timeout).toBeDefined();
    });

    it('should support policy definition at the system level', () => {
      // Define a system with policies
      const paymentSystem = dsl.system('PaymentSystem', {
        description: 'Payment processing system',
        version: '1.0.0',
        policies: {
          rateLimiting: {
            'api.payment.*': { limit: 100, window: '1m' }
          },
          security: {
            authentication: { required: true },
            authorization: { roles: ['payment-processor'] }
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

      expect(paymentSystem).toBeDefined();
      expect(paymentSystem.policies).toBeDefined();
      expect(paymentSystem.policies.rateLimiting).toBeDefined();
      expect(paymentSystem.policies.security).toBeDefined();
      expect(paymentSystem.policies.security.authentication.required).toBe(true);
    });
  });

  describe('Declarative Testing', () => {
    it('should support declarative test definitions', () => {
      // Define a test component
      const userTest = dsl.component('UserActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for UserActor',
        version: '1.0.0',
        target: { ref: 'UserActor' },
        scenarios: [
          {
            name: 'Create user successfully',
            given: [
              { setup: 'emptyState' }
            ],
            when: [
              { 
                send: { 
                  message: 'createUser', 
                  payload: { 
                    name: 'Test User', 
                    email: 'test@example.com' 
                  } 
                }
              }
            ],
            then: [
              { assert: 'result.name', equals: 'Test User' },
              { assert: 'result.email', equals: 'test@example.com' },
              { assert: 'actorState.users.length', equals: 1 },
              { assert: 'eventsEmitted', contains: { type: 'UserCreated' } }
            ]
          }
        ]
      });

      expect(userTest).toBeDefined();
      expect(userTest.type).toBe(ComponentType.TEST);
      expect(userTest.target).toEqual({ ref: 'UserActor' });
      expect(userTest.scenarios).toHaveLength(1);
      expect(userTest.scenarios[0].name).toBe('Create user successfully');
      expect(userTest.scenarios[0].when).toHaveLength(1);
      expect(userTest.scenarios[0].then).toHaveLength(4);
    });
  });

  describe('Unified Component Approach', () => {
    it('should support a unified component API including implementations', () => {
      // Define a schema
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema definition',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'name', 'email']
      });

      // Define an actor
      const userActor = dsl.component('UserActor', {
        type: ComponentType.ACTOR,
        description: 'User management actor',
        version: '1.0.0',
        state: {
          properties: {
            users: { type: 'array', items: { ref: 'User' } }
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
            output: { ref: 'User' }
          }
        }
      });

      // Define implementation using the unified component approach
      const userActorImpl = dsl.component('UserActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Implementation of UserActor',
        version: '1.0.0',
        targetComponent: 'UserActor',
        attributes: {
          tags: ['user-management', 'implementation'],
          domain: 'user'
        },
        handlers: {
          createUser: async (input: any, context: ActorContext) => {
            const userId = `user-${Date.now()}`;
            const user = {
              id: userId,
              name: input.name,
              email: input.email
            };
            
            if (!context.state) {
              context.state = { users: [] };
            } else if (!context.state.users) {
              context.state.users = [];
            }
            
            context.state.users.push(user);
            return user;
          }
        }
      });

      // Define test alongside the implementation
      const userActorTest = dsl.component('UserActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for UserActor',
        version: '1.0.0',
        target: { ref: 'UserActor' },
        attributes: {
          tags: ['user-management', 'test'],
          domain: 'user'
        },
        scenarios: [
          {
            name: 'Create user successfully',
            given: [
              { setup: 'emptyState' }
            ],
            when: [
              { 
                send: { 
                  message: 'createUser', 
                  payload: { 
                    name: 'Test User', 
                    email: 'test@example.com' 
                  } 
                }
              }
            ],
            then: [
              { assert: 'result.name', equals: 'Test User' },
              { assert: 'result.email', equals: 'test@example.com' },
              { assert: 'actorState.users.length', equals: 1 }
            ]
          }
        ]
      });

      // Verify the components
      expect(userActorImpl).toBeDefined();
      expect(userActorImpl.type).toBe(ComponentType.IMPLEMENTATION);
      expect(userActorImpl.targetComponent).toBe('UserActor');
      expect(userActorImpl.handlers).toBeDefined();
      expect(typeof userActorImpl.handlers.createUser).toBe('function');
      
      // Verify the relationships between components and tests
      expect(userActorTest.target?.ref).toBe('UserActor');
      
      // Verify metadata for RAG-friendliness
      expect(userActorImpl.attributes?.tags).toContain('user-management');
      expect(userActorTest.attributes?.tags).toContain('user-management');
      expect(userActorImpl.attributes?.domain).toBe('user');
      expect(userActorTest.attributes?.domain).toBe('user');
    });

    it('should associate implementation, declaration, and tests via metadata', () => {
      // Define components with the same domain identifier
      const domain = 'payment-processing';
      const version = '1.0.0';
      
      // Schema with domain metadata
      const paymentSchema = dsl.component('Payment', {
        type: ComponentType.SCHEMA,
        description: 'Payment information',
        version,
        attributes: {
          domain,
          category: 'schema'
        },
        properties: {
          id: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' }
        }
      });
      
      // Actor with domain metadata
      const paymentActor = dsl.component('PaymentActor', {
        type: ComponentType.ACTOR,
        description: 'Handles payment processing',
        version,
        attributes: {
          domain,
          category: 'service'
        },
        messageHandlers: {
          processPayment: {
            input: {
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' }
              },
              required: ['amount', 'currency']
            },
            output: { ref: 'Payment' }
          }
        }
      });
      
      // Implementation with domain metadata
      const paymentActorImpl = dsl.component('PaymentActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Implementation of payment processing',
        version,
        targetComponent: 'PaymentActor',
        attributes: {
          domain,
          category: 'implementation'
        },
        handlers: {
          processPayment: async (input: any, context: ActorContext) => {
            return {
              id: `payment-${Date.now()}`,
              amount: input.amount,
              currency: input.currency
            };
          }
        }
      });
      
      // Test with domain metadata
      const paymentActorTest = dsl.component('PaymentActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for payment processing',
        version,
        target: { ref: 'PaymentActor' },
        attributes: {
          domain,
          category: 'test'
        },
        scenarios: [
          {
            name: 'Process payment successfully',
            given: [{ setup: 'emptyState' }],
            when: [{
              send: {
                message: 'processPayment',
                payload: { amount: 100, currency: 'USD' }
              }
            }],
            then: [
              { assert: 'result.amount', equals: 100 },
              { assert: 'result.currency', equals: 'USD' }
            ]
          }
        ]
      });
      
      // Verify domain associations for RAG retrieval
      const components = [paymentSchema, paymentActor, paymentActorImpl, paymentActorTest];
      
      components.forEach(component => {
        expect(component.attributes?.domain).toBe(domain);
        expect(component.version).toBe(version);
      });
      
      // Verify category distinctions
      expect(paymentSchema.attributes?.category).toBe('schema');
      expect(paymentActor.attributes?.category).toBe('service');
      expect(paymentActorImpl.attributes?.category).toBe('implementation');
      expect(paymentActorTest.attributes?.category).toBe('test');
    });
  });
}); 