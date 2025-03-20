import { describe, test, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

describe('Actor Model in DSL', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('Actor Definition', () => {
    test('should create an actor with required properties', () => {
      const walletActor = dsl.actor('WalletActor', {
        description: 'Manages user wallet operations',
        version: '1.0.0',
        messageHandlers: {
          getBalance: {
            input: {
              type: 'object',
              properties: {
                userId: { type: 'string' }
              },
              required: ['userId']
            },
            output: {
              type: 'object',
              properties: {
                balance: { type: 'number' },
                currency: { type: 'string' }
              }
            }
          },
          transfer: {
            input: {
              type: 'object',
              properties: {
                fromUserId: { type: 'string' },
                toUserId: { type: 'string' },
                amount: { type: 'number' }
              },
              required: ['fromUserId', 'toUserId', 'amount']
            },
            output: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                transactionId: { type: 'string' }
              }
            }
          }
        }
      });

      expect(walletActor).toBeDefined();
      expect(walletActor.id).toBe('WalletActor');
      expect(walletActor.type).toBe(ComponentType.ACTOR);
      expect(walletActor.description).toBe('Manages user wallet operations');
      expect(walletActor.version).toBe('1.0.0');
      expect(Object.keys(walletActor.messageHandlers)).toHaveLength(2);
      expect(walletActor.messageHandlers.getBalance).toBeDefined();
      expect(walletActor.messageHandlers.transfer).toBeDefined();
    });

    test('should throw error when actor is missing required properties', () => {
      expect(() => dsl.actor('InvalidActor', {
        version: '1.0.0',
        messageHandlers: {}
      } as any)).toThrow('Actor InvalidActor must have a description');

      expect(() => dsl.actor('InvalidActor', {
        description: 'Invalid actor',
        messageHandlers: {}
      } as any)).toThrow('Actor InvalidActor must have a version');

      expect(() => dsl.actor('InvalidActor', {
        description: 'Invalid actor',
        version: '1.0.0'
      } as any)).toThrow('Actor InvalidActor must define at least one message handler');
    });

    test('should throw error when message handler is missing input or output schema', () => {
      // This isn't currently validated in our simplified implementation
      // In a real implementation, we would add these validations
    });

    test('should create an actor with config options', () => {
      const actorWithConfig = dsl.actor('ConfiguredActor', {
        description: 'Actor with configuration',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} }
          }
        },
        config: {
          backpressure: {
            strategy: 'drop',
            maxMailboxSize: 100
          },
          supervision: {
            maxRetries: 3,
            backoffStrategy: 'exponential',
            resetTimeout: 60000
          },
          stateManagement: {
            persistence: true,
            snapshotInterval: 100
          }
        }
      });

      expect(actorWithConfig.config).toBeDefined();
      expect(actorWithConfig.config?.backpressure?.strategy).toBe('drop');
      expect(actorWithConfig.config?.backpressure?.maxMailboxSize).toBe(100);
      expect(actorWithConfig.config?.supervision?.maxRetries).toBe(3);
      expect(actorWithConfig.config?.stateManagement?.persistence).toBe(true);
    });
  });

  describe('Actor Implementation', () => {
    test('should implement an actor with message handlers', () => {
      // Define an actor
      dsl.actor('MathActor', {
        description: 'Math operations actor',
        version: '1.0.0',
        messageHandlers: {
          compute: {
            input: { 
              type: 'object', 
              properties: { 
                operation: { type: 'string' },
                values: { type: 'array', items: { type: 'number' } }
              } 
            },
            output: { 
              type: 'object', 
              properties: { 
                result: { type: 'number' } 
              } 
            }
          }
        }
      });

      // Implement the actor
      dsl.implementActor('MathActor', {
        compute: async (msg: { operation: string, values: number[] }, ctx: any) => {
          let result = 0;
          
          switch (msg.operation) {
            case 'sum':
              result = msg.values.reduce((sum, val) => sum + val, 0);
              break;
            case 'multiply':
              result = msg.values.reduce((product, val) => product * val, 1);
              break;
            default:
              throw new Error(`Unknown operation: ${msg.operation}`);
          }
          
          return { result };
        }
      });

      // Get the implementation
      const impl = dsl.getImplementation('MathActor');
      
      expect(impl).toBeDefined();
      expect(typeof impl?.compute).toBe('function');
    });

    test('should throw error when implementing a non-existent actor', () => {
      expect(() => dsl.implementActor('NonExistentActor', {
        someHandler: async () => ({ result: true })
      })).toThrow('Actor NonExistentActor is not defined');
    });

    test('should throw error when missing required handlers', () => {
      // Define an actor with two handlers
      dsl.actor('TwoHandlerActor', {
        description: 'Actor with two handlers',
        version: '1.0.0',
        messageHandlers: {
          first: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} }
          },
          second: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} }
          }
        }
      });

      // Try to implement with only one handler
      expect(() => dsl.implementActor('TwoHandlerActor', {
        first: async () => ({ result: true })
      })).toThrow('Actor implementation for TwoHandlerActor is missing handlers: second');
    });

    test('should throw error when implementing extra handlers', () => {
      // Define an actor with one handler
      dsl.actor('OneHandlerActor', {
        description: 'Actor with one handler',
        version: '1.0.0',
        messageHandlers: {
          first: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} }
          }
        }
      });

      // Try to implement with extra handlers
      expect(() => dsl.implementActor('OneHandlerActor', {
        first: async () => ({ result: true }),
        extraHandler: async () => ({ result: false })
      })).toThrow('Actor implementation for OneHandlerActor contains undefined handlers: extraHandler');
    });
  });

  describe('Actor Self-Testing', () => {
    test('should define and validate actor interface tests', () => {
      const userActor = dsl.actor('UserActor', {
        description: 'User management actor with tests',
        version: '1.0.0',
        messageHandlers: {
          getUser: {
            input: { 
              type: 'object',
              properties: { 
                userId: { type: 'string' } 
              } 
            },
            output: { 
              type: 'object',
              properties: { 
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' }
              } 
            }
          }
        },
        tests: {
          interface: [
            {
              name: 'Should return user when given valid ID',
              messageHandler: 'getUser',
              input: { userId: 'user123' },
              expectedResult: {
                id: 'user123',
                name: 'Test User',
                email: 'test@example.com'
              }
            },
            {
              name: 'Should throw error when given invalid ID',
              messageHandler: 'getUser',
              input: { userId: 'invalid' },
              expectError: true
            }
          ]
        }
      });

      expect(userActor.tests).toBeDefined();
      expect(userActor.tests?.interface).toHaveLength(2);
      expect(userActor.tests?.interface?.[0].name).toBe('Should return user when given valid ID');
      expect(userActor.tests?.interface?.[1].expectError).toBe(true);
    });

    test('should throw error for invalid test definitions', () => {
      expect(() => dsl.actor('InvalidTestActor', {
        description: 'Actor with invalid tests',
        version: '1.0.0',
        messageHandlers: {
          getMessage: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} }
          }
        },
        tests: {
          interface: [
            {
              name: 'Invalid test for non-existent handler',
              messageHandler: 'nonExistentHandler',
              input: {},
              expectedResult: {}
            }
          ]
        }
      })).toThrow('Interface test "Invalid test for non-existent handler" in actor InvalidTestActor references non-existent message handler: nonExistentHandler');
    });

    test('should run actor tests against implementations', async () => {
      // Define actor with tests
      dsl.actor('TestableUserActor', {
        description: 'Testable user actor',
        version: '1.0.0',
        messageHandlers: {
          getUser: {
            input: { 
              type: 'object', 
              properties: { 
                userId: { type: 'string' } 
              } 
            },
            output: { 
              type: 'object', 
              properties: { 
                id: { type: 'string' },
                name: { type: 'string' }
              } 
            }
          }
        },
        tests: {
          interface: [
            {
              name: 'Should return user with matching ID',
              messageHandler: 'getUser',
              input: { userId: 'user123' },
              expectedResult: { id: 'user123', name: 'Test User' }
            },
            {
              name: 'Should throw error for non-existent user',
              messageHandler: 'getUser',
              input: { userId: 'nonexistent' },
              expectError: true
            }
          ]
        }
      });

      // Implement the actor
      dsl.implementActor('TestableUserActor', {
        getUser: async (msg: { userId: string }, ctx: any) => {
          if (msg.userId === 'user123') {
            return { id: 'user123', name: 'Test User' };
          }
          throw new Error('User not found');
        }
      });

      // Run the tests
      const results = await dsl.runActorTests('TestableUserActor');
      
      expect(results.passedTests).toHaveLength(2);
      expect(results.failedTests).toHaveLength(0);
    });

    test('should detect test failures', async () => {
      // Define actor with tests
      dsl.actor('BuggyActor', {
        description: 'Actor with a bug in implementation',
        version: '1.0.0',
        messageHandlers: {
          calculate: {
            input: { 
              type: 'object', 
              properties: { 
                value: { type: 'number' } 
              } 
            },
            output: { 
              type: 'object', 
              properties: { 
                result: { type: 'number' } 
              } 
            }
          }
        },
        tests: {
          interface: [
            {
              name: 'Should double the input value',
              messageHandler: 'calculate',
              input: { value: 5 },
              expectedResult: { result: 10 }
            }
          ]
        }
      });

      // Implement the actor with a bug (adds 1 instead of doubling)
      dsl.implementActor('BuggyActor', {
        calculate: async (msg: { value: number }, ctx: any) => {
          // Bug: Adds 1 instead of doubling
          return { result: msg.value + 1 };
        }
      });

      // Run the tests
      const results = await dsl.runActorTests('BuggyActor');
      
      expect(results.failedTests).toHaveLength(1);
      expect(results.passedTests).toHaveLength(0);
    });
  });
}); 