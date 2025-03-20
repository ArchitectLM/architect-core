import { describe, test, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

describe('Actor Testing Framework', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('Interface Tests', () => {
    test('should define interface tests for an actor', () => {
      // Define an actor with interface tests
      const actorDef = dsl.actor('UserActor', {
        description: 'Manages user operations',
        version: '1.0.0',
        messageHandlers: {
          getUserById: {
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
              name: 'should return user data when valid ID is provided',
              messageHandler: 'getUserById',
              input: { userId: 'user123' },
              expectedSchema: { 
                type: 'object', 
                properties: { 
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' }
                },
                required: ['id', 'name', 'email']
              }
            },
            {
              name: 'should throw error when invalid ID is provided',
              messageHandler: 'getUserById',
              input: { userId: '' },
              expectError: true
            }
          ]
        }
      });

      expect(actorDef).toBeDefined();
      expect(actorDef.tests).toBeDefined();
      expect(actorDef.tests.interface).toHaveLength(2);
      
      const firstTest = actorDef.tests.interface[0];
      expect(firstTest.name).toBe('should return user data when valid ID is provided');
      expect(firstTest.messageHandler).toBe('getUserById');
      expect(firstTest.input).toEqual({ userId: 'user123' });
      
      const secondTest = actorDef.tests.interface[1];
      expect(secondTest.expectError).toBe(true);
    });

    test('should detect invalid interface tests', () => {
      expect(() => {
        dsl.actor('InvalidTestActor', {
          description: 'Actor with invalid tests',
          version: '1.0.0',
          messageHandlers: {
            doSomething: {
              input: { type: 'object', properties: {} },
              output: { type: 'object', properties: {} }
            }
          },
          tests: {
            interface: [
              {
                name: 'test for non-existent message handler',
                messageHandler: 'nonExistentHandler',
                input: {},
                expectedSchema: { type: 'object' }
              }
            ]
          }
        });
      }).toThrow(/Message handler 'nonExistentHandler' referenced in test does not exist/);
    });

    test('should validate test structure is complete', () => {
      // Actor with incomplete test (missing expect)
      dsl.actor('IncompleteTestActor', {
        description: 'Actor with incomplete test',
        version: '1.0.0',
        messageHandlers: {
          doSomething: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        },
        tests: [
          {
            description: 'Incomplete test',
            when: {
              message: 'doSomething',
              input: {}
            },
            then: {} as any // Missing 'expect'
          }
        ]
      });

      // Validation should fail
      expect(() => dsl.validateActorTests('IncompleteTestActor')).toThrow(
        'is missing the \'then.expect\' field'
      );
    });
  });

  describe('Implementation Tests', () => {
    test('should define implementation-specific tests for an actor', () => {
      // Define an actor with implementation tests
      const actorDef = dsl.actor('DatabaseActor', {
        description: 'Manages database operations',
        version: '1.0.0',
        messageHandlers: {
          query: {
            input: { 
              type: 'object', 
              properties: { 
                sql: { type: 'string' } 
              } 
            },
            output: { 
              type: 'array', 
              items: { type: 'object' } 
            }
          }
        },
        tests: {
          implementation: [
            {
              name: 'should execute SQL query correctly',
              setup: `
                // Mock database setup
                const mockDb = {
                  execute: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }])
                };
                context.db = mockDb;
              `,
              messageHandler: 'query',
              input: { sql: 'SELECT * FROM users' },
              assertions: `
                // Verify DB was called with correct SQL
                expect(context.db.execute).toHaveBeenCalledWith('SELECT * FROM users');
                expect(result).toHaveLength(1);
                expect(result[0].name).toBe('Test');
              `
            },
            {
              name: 'should handle database errors',
              setup: `
                // Mock database that throws error
                const mockDb = {
                  execute: vi.fn().mockRejectedValue(new Error('DB connection failed'))
                };
                context.db = mockDb;
              `,
              messageHandler: 'query',
              input: { sql: 'SELECT * FROM users' },
              expectError: true,
              assertions: `
                // Verify error was handled
                expect(error.message).toContain('DB connection failed');
              `
            }
          ]
        }
      });

      expect(actorDef).toBeDefined();
      expect(actorDef.tests).toBeDefined();
      expect(actorDef.tests.implementation).toHaveLength(2);
      
      const firstTest = actorDef.tests.implementation[0];
      expect(firstTest.name).toBe('should execute SQL query correctly');
      expect(firstTest.messageHandler).toBe('query');
      expect(firstTest.input).toEqual({ sql: 'SELECT * FROM users' });
      expect(firstTest.assertions).toContain('expect(result).toHaveLength(1)');
      
      const secondTest = actorDef.tests.implementation[1];
      expect(secondTest.expectError).toBe(true);
      expect(secondTest.assertions).toContain('expect(error.message)');
    });

    test('should run tests against actor implementation', async () => {
      // Define an actor with test cases
      const databaseActor = dsl.actor('DatabaseActor', {
        description: 'Database access actor',
        version: '1.0.0',
        messageHandlers: {
          query: {
            input: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            },
            output: {
              type: 'object',
              properties: {
                result: { type: 'object' }
              }
            }
          }
        },
        tests: [
          {
            description: 'Should return data for valid ID',
            when: {
              message: 'query',
              input: { id: 'doc1' }
            },
            then: {
              expect: {
                output: {
                  result: { title: 'Document One', content: 'Content of doc 1' }
                }
              }
            }
          },
          {
            description: 'Should throw for missing ID',
            when: {
              message: 'query',
              input: { id: '' }
            },
            then: {
              expect: {
                error: 'ID is required'
              }
            }
          }
        ]
      });

      // Implement the actor
      dsl.implementActor('DatabaseActor', {
        query: async (msg, ctx) => {
          if (!msg.id) {
            throw new Error('ID is required');
          }
          
          if (msg.id === 'doc1') {
            return {
              result: { 
                title: 'Document One', 
                content: 'Content of doc 1' 
              }
            };
          }
          
          return { result: { status: 'unknown' } };
        }
      });

      // Run the tests
      const results = await dsl.runActorTests('DatabaseActor');
      
      expect(results.passed).toBe(true);
      expect(results.results).toHaveLength(2);
      expect(results.results[0].passed).toBe(true);
      expect(results.results[1].passed).toBe(true);
    });

    test('should detect implementation that fails tests', async () => {
      // Define an actor with tests
      const counterActor = dsl.actor('CounterActor', {
        description: 'Simple counter',
        version: '1.0.0',
        messageHandlers: {
          increment: {
            input: {
              type: 'object',
              properties: {
                amount: { type: 'number' }
              }
            },
            output: {
              type: 'object',
              properties: {
                value: { type: 'number' }
              }
            }
          }
        },
        tests: [
          {
            description: 'Should increment counter by amount',
            given: {
              state: { counter: 5 }
            },
            when: {
              message: 'increment',
              input: { amount: 3 }
            },
            then: {
              expect: {
                output: { value: 8 },
                state: { counter: 8 } // Expect state to be updated
              }
            }
          }
        ]
      });

      // Implement the actor but with a bug - it doesn't update state
      dsl.implementActor('CounterActor', {
        increment: async (msg, ctx) => {
          // Bug: uses state but doesn't update it
          const currentValue = (ctx.state.counter || 0);
          const newValue = currentValue + msg.amount;
          
          // Return correct value but don't update state!
          return { value: newValue };
        }
      });

      // Run the tests
      const results = await dsl.runActorTests('CounterActor');
      
      // The output is correct but state wasn't updated
      expect(results.passed).toBe(false);
      expect(results.results[0].passed).toBe(false);
      expect(results.results[0].actual.output.value).toBe(8); // Output is correct
      expect(results.results[0].actual.state.counter).toBeUndefined(); // But state wasn't updated
    });

    test('should handle missing implementations', async () => {
      // Define an actor with tests
      dsl.actor('UnimplementedActor', {
        description: 'Actor without implementation',
        version: '1.0.0',
        messageHandlers: {
          doSomething: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        },
        tests: [
          {
            description: 'Test for unimplemented handler',
            when: {
              message: 'doSomething',
              input: {}
            },
            then: {
              expect: {
                output: { result: true }
              }
            }
          }
        ]
      });

      // Run tests without implementing the actor
      const results = await dsl.runActorTests('UnimplementedActor');
      
      expect(results.passed).toBe(false);
      expect(results.results[0].passed).toBe(false);
      expect(results.results[0].error).toContain('Implementation for UnimplementedActor.doSomething not found');
    });
  });

  describe('Test Runner', () => {
    test('should run multiple test cases for an actor', async () => {
      // Define an actor with multiple test cases
      const calculatorActor = dsl.actor('CalculatorActor', {
        description: 'Simple calculator',
        version: '1.0.0',
        messageHandlers: {
          add: {
            input: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
              }
            },
            output: {
              type: 'object',
              properties: {
                result: { type: 'number' }
              }
            }
          },
          divide: {
            input: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
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
        tests: [
          {
            description: 'Should add two numbers',
            when: {
              message: 'add',
              input: { a: 2, b: 3 }
            },
            then: {
              expect: {
                output: { result: 5 }
              }
            }
          },
          {
            description: 'Should handle division',
            when: {
              message: 'divide',
              input: { a: 10, b: 2 }
            },
            then: {
              expect: {
                output: { result: 5 }
              }
            }
          },
          {
            description: 'Should throw error on division by zero',
            when: {
              message: 'divide',
              input: { a: 10, b: 0 }
            },
            then: {
              expect: {
                error: 'Division by zero'
              }
            }
          }
        ]
      });

      // Implement the actor
      dsl.implementActor('CalculatorActor', {
        add: async (msg, ctx) => {
          return { result: msg.a + msg.b };
        },
        divide: async (msg, ctx) => {
          if (msg.b === 0) {
            throw new Error('Division by zero');
          }
          return { result: msg.a / msg.b };
        }
      });

      // Run all tests
      const results = await dsl.runActorTests('CalculatorActor');
      
      expect(results.passed).toBe(true);
      expect(results.results).toHaveLength(3);
      expect(results.results[0].passed).toBe(true);
      expect(results.results[1].passed).toBe(true);
      expect(results.results[2].passed).toBe(true);
    });

    test('should handle a mix of passing and failing tests', async () => {
      // Define an actor with a mix of tests that will pass and fail
      const mixedResultsActor = dsl.actor('MixedResultsActor', {
        description: 'Actor with mixed test results',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: {
              type: 'object',
              properties: {
                value: { type: 'number' }
              }
            },
            output: {
              type: 'object',
              properties: {
                processed: { type: 'boolean' },
                result: { type: 'number' }
              }
            }
          }
        },
        tests: [
          {
            description: 'This test will pass',
            when: {
              message: 'process',
              input: { value: 42 }
            },
            then: {
              expect: {
                output: {
                  processed: true,
                  result: 43  // Expect value + 1
                }
              }
            }
          },
          {
            description: 'This test will fail',
            when: {
              message: 'process',
              input: { value: 100 }
            },
            then: {
              expect: {
                output: {
                  processed: true,
                  result: 200  // Expect value * 2 but implementation does value + 1
                }
              }
            }
          }
        ]
      });

      // Implement the actor (adds 1 to all values)
      dsl.implementActor('MixedResultsActor', {
        process: async (msg, ctx) => {
          return {
            processed: true,
            result: msg.value + 1  // Always adds 1, so the second test will fail
          };
        }
      });

      // Run all tests
      const results = await dsl.runActorTests('MixedResultsActor');
      
      expect(results.passed).toBe(false); // Overall result is fail
      expect(results.results).toHaveLength(2);
      expect(results.results[0].passed).toBe(true);  // First test passes
      expect(results.results[1].passed).toBe(false); // Second test fails
      
      // Verify the actual vs expected values in the failing test
      expect(results.results[1].actual.output.result).toBe(101);   // value + 1
      expect(results.results[1].expected.output.result).toBe(200); // Expected value * 2
    });

    test('should run interface tests against an implementation', async () => {
      // Define an actor with interface tests
      dsl.actor('EmailValidator', {
        description: 'Validates email addresses',
        version: '1.0.0',
        messageHandlers: {
          validate: {
            input: { 
              type: 'object', 
              properties: { 
                email: { type: 'string' } 
              } 
            },
            output: { 
              type: 'object', 
              properties: { 
                valid: { type: 'boolean' },
                reason: { type: 'string', nullable: true }
              } 
            }
          }
        },
        tests: {
          interface: [
            {
              name: 'should validate correct email format',
              messageHandler: 'validate',
              input: { email: 'test@example.com' },
              expectedResult: { valid: true, reason: null }
            },
            {
              name: 'should reject invalid email format',
              messageHandler: 'validate',
              input: { email: 'not-an-email' },
              expectedResult: { valid: false, reason: expect.stringContaining('invalid format') }
            }
          ]
        }
      });
      
      // Implement the actor
      dsl.implementActor('EmailValidator', {
        validate: async (msg: { email: string }, ctx: any) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(msg.email)) {
            return { valid: true, reason: null };
          }
          return { valid: false, reason: 'invalid format' };
        }
      });
      
      // Run the tests
      const results = await dsl.runActorTests('EmailValidator');
      
      expect(results.passedTests).toHaveLength(2);
      expect(results.failedTests).toHaveLength(0);
    });

    test('should detect test failures', async () => {
      // Define an actor with interface tests
      dsl.actor('PasswordValidator', {
        description: 'Validates passwords',
        version: '1.0.0',
        messageHandlers: {
          validate: {
            input: { 
              type: 'object', 
              properties: { 
                password: { type: 'string' } 
              } 
            },
            output: { 
              type: 'object', 
              properties: { 
                valid: { type: 'boolean' },
                errors: { type: 'array', items: { type: 'string' } }
              } 
            }
          }
        },
        tests: {
          interface: [
            {
              name: 'should validate strong password',
              messageHandler: 'validate',
              input: { password: 'StrongP@ss123' },
              expectedResult: { valid: true, errors: [] }
            },
            {
              name: 'should reject weak password',
              messageHandler: 'validate',
              input: { password: 'weak' },
              expectedResult: { valid: false, errors: expect.arrayContaining(['too short']) }
            }
          ]
        }
      });
      
      // Implement the actor with a bug
      dsl.implementActor('PasswordValidator', {
        validate: async (msg: { password: string }, ctx: any) => {
          // Bug: Always returns valid regardless of password
          return { valid: true, errors: [] };
        }
      });
      
      // Run the tests
      const results = await dsl.runActorTests('PasswordValidator');
      
      expect(results.passedTests).toHaveLength(1); // Only the first test passes
      expect(results.failedTests).toHaveLength(1); // The second test fails
      expect(results.failedTests[0].name).toBe('should reject weak password');
    });
  });
}); 