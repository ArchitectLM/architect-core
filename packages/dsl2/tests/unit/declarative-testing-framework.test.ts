import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType, ActorContext, TestScenario, FlowBuilder } from '../../src/models/component.js';

/**
 * Declarative Testing Framework Test Suite
 * 
 * This test file demonstrates how to use the declarative testing framework
 * to define, execute, and validate test scenarios for components.
 */
describe('Declarative Testing Framework', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('Test Definition', () => {
    it('should define test scenarios with given-when-then structure', () => {
      // Define a simple actor to test
      dsl.component('UserActor', {
        type: ComponentType.ACTOR,
        description: 'Actor for user management',
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
          }
        }
      });

      // Define a test with the declarative structure
      const actorTest = dsl.component('UserActorTest', {
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
                },
                store: 'result'
              }
            ],
            then: [
              { assert: 'result.name', equals: 'Test User' },
              { assert: 'result.email', equals: 'test@example.com' },
              { assert: 'result.id', matches: /^user-\d+$/ },
              { assert: 'actorState.users.length', equals: 1 }
            ]
          }
        ]
      });

      // Verify test structure
      expect(actorTest).toBeDefined();
      expect(actorTest.type).toBe(ComponentType.TEST);
      expect(actorTest.target?.ref).toBe('UserActor');
      expect(actorTest.scenarios).toHaveLength(1);
      
      const scenario = actorTest.scenarios?.[0];
      expect(scenario).toBeDefined();
      if (!scenario) return; // Early return if scenario is undefined, already asserted above
      
      expect(scenario.name).toBe('Create user successfully');
      expect(scenario.given).toHaveLength(1);
      expect(scenario.when).toHaveLength(1);
      expect(scenario.then).toHaveLength(4);
      
      // Verify the given step
      expect(scenario.given[0].setup).toBe('emptyState');
      
      // Verify the when step
      const whenStep = scenario.when[0];
      expect(whenStep.send).toBeDefined();
      if (!whenStep.send) return; // Early return if send is undefined, already asserted above
      
      expect(whenStep.send.message).toBe('createUser');
      expect(whenStep.send.payload.name).toBe('Test User');
      expect(whenStep.store).toBe('result');
      
      // Verify the then steps
      expect(scenario.then[0].assert).toBe('result.name');
      expect(scenario.then[0].equals).toBe('Test User');
      expect(scenario.then[3].assert).toBe('actorState.users.length');
    });

    it('should support multiple scenarios and complex assertions', () => {
      // Define a cart actor with multiple operations
      dsl.component('CartActor', {
        type: ComponentType.ACTOR,
        description: 'Shopping cart actor',
        version: '1.0.0',
        state: {
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            totalAmount: { type: 'number' }
          }
        },
        messageHandlers: {
          addItem: {
            input: {
              properties: {
                productId: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
                quantity: { type: 'number' }
              },
              required: ['productId', 'name', 'price', 'quantity']
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                itemCount: { type: 'number' },
                totalAmount: { type: 'number' }
              }
            }
          },
          removeItem: {
            input: {
              properties: {
                productId: { type: 'string' }
              },
              required: ['productId']
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                itemCount: { type: 'number' },
                totalAmount: { type: 'number' }
              }
            }
          },
          getCart: {
            input: { type: 'null' },
            output: {
              properties: {
                items: { type: 'array' },
                totalAmount: { type: 'number' }
              }
            }
          }
        }
      });

      // Define complex tests with multiple scenarios
      const cartTest = dsl.component('CartActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for CartActor',
        version: '1.0.0',
        target: { ref: 'CartActor' },
        scenarios: [
          {
            name: 'Add item to empty cart',
            given: [
              { setup: 'emptyState' }
            ],
            when: [
              {
                send: {
                  message: 'addItem',
                  payload: {
                    productId: 'prod-1',
                    name: 'Test Product',
                    price: 10.99,
                    quantity: 2
                  }
                },
                store: 'addResult'
              }
            ],
            then: [
              { assert: 'addResult.success', equals: true },
              { assert: 'addResult.itemCount', equals: 1 },
              { assert: 'addResult.totalAmount', equals: 21.98 },
              { assert: 'actorState.items.length', equals: 1 },
              { assert: 'actorState.items[0].productId', equals: 'prod-1' },
              { assert: 'actorState.items[0].quantity', equals: 2 }
            ]
          },
          {
            name: 'Remove item from cart',
            given: [
              { 
                setup: 'populatedCart',
                with: {
                  items: [
                    { productId: 'prod-1', name: 'Product 1', price: 10.99, quantity: 2 },
                    { productId: 'prod-2', name: 'Product 2', price: 5.99, quantity: 1 }
                  ],
                  totalAmount: 27.97
                }
              }
            ],
            when: [
              {
                send: {
                  message: 'removeItem',
                  payload: {
                    productId: 'prod-1'
                  }
                },
                store: 'removeResult'
              },
              {
                send: {
                  message: 'getCart',
                  payload: null // Add payload explicitly, even if it's null
                },
                store: 'cartState'
              }
            ],
            then: [
              { assert: 'removeResult.success', equals: true },
              { assert: 'removeResult.itemCount', equals: 1 },
              { assert: 'removeResult.totalAmount', equals: 5.99 },
              { assert: 'cartState.items.length', equals: 1 },
              { assert: 'cartState.items[0].productId', equals: 'prod-2' },
              { assert: 'cartState.totalAmount', equals: 5.99 }
            ]
          }
        ]
      });

      // Verify test structure with multiple scenarios
      expect(cartTest).toBeDefined();
      expect(cartTest.scenarios).toHaveLength(2);
      
      // Verify first scenario
      const addScenario = cartTest.scenarios?.[0];
      expect(addScenario).toBeDefined();
      if (!addScenario) return; // Early return if scenario is undefined, already asserted above
      
      expect(addScenario.name).toBe('Add item to empty cart');
      expect(addScenario.given[0].setup).toBe('emptyState');
      expect(addScenario.then).toHaveLength(6);
      
      // Verify second scenario
      const removeScenario = cartTest.scenarios?.[1];
      expect(removeScenario).toBeDefined();
      if (!removeScenario) return; // Early return if scenario is undefined, already asserted above
      
      expect(removeScenario.name).toBe('Remove item from cart');
      expect(removeScenario.given[0].setup).toBe('populatedCart');
      expect(removeScenario.given[0].with?.items).toHaveLength(2);
      expect(removeScenario.when).toHaveLength(2);
      expect(removeScenario.then).toHaveLength(6);
    });
  });

  describe('Test Execution', () => {
    // Create a mock flow builder that satisfies the FlowBuilder interface
    const createMockFlowBuilder = (): FlowBuilder => ({
      sendToActor: (_actorId: string, _message: any) => createMockFlowBuilder(),
      then: (_callback: (result: any) => any) => createMockFlowBuilder(),
      catch: (_errorHandler: (error: Error) => any) => createMockFlowBuilder(),
      finally: (_callback: () => void) => createMockFlowBuilder(),
      execute: async () => ({})
    });
    
    // Mock implementation for test execution
    class TestRunner {
      constructor(private dsl: DSL) {}
      
      // Execute a test scenario against an implementation
      async executeScenario(testComponent: any, scenario: TestScenario, implementation?: any): Promise<{ 
        success: boolean;
        results: Record<string, any>;
        errors: string[];
        actorState: Record<string, any>;
      }> {
        const errors: string[] = [];
        const results: Record<string, any> = {};
        let actorState: Record<string, any> = {};
        
        // Get target component
        const targetComponentId = testComponent.target.ref;
        const targetComponent = this.dsl.getComponent(targetComponentId);
        if (!targetComponent) {
          errors.push(`Target component ${targetComponentId} not found`);
          return { success: false, results, errors, actorState };
        }
        
        // Setup state based on given steps
        for (const givenStep of scenario.given) {
          if (givenStep.setup === 'emptyState') {
            actorState = { items: [], totalAmount: 0 };
          } else if (givenStep.setup === 'populatedCart' && givenStep.with) {
            actorState = { ...givenStep.with };
          } else if (givenStep.setup === 'initialState' && givenStep.with) {
            actorState = { ...givenStep.with };
          }
        }
        
        // Create a mock actor context
        const context: ActorContext = {
          state: actorState,
          flow: () => createMockFlowBuilder()
        };
        
        // Execute when steps
        for (const whenStep of scenario.when) {
          if (whenStep.send) {
            const { message, payload } = whenStep.send;
            
            // Attempt to find handler in implementation or mock a response
            let result;
            if (implementation && implementation.handlers && implementation.handlers[message]) {
              // Execute the actual implementation
              try {
                result = await implementation.handlers[message](payload, context);
              } catch (err: any) {
                errors.push(`Error executing ${message}: ${err.message}`);
                continue;
              }
            } else {
              // Mock based on message type
              switch (message) {
                case 'createUser':
                  result = {
                    id: `user-${Date.now()}`,
                    name: payload.name,
                    email: payload.email
                  };
                  if (!context.state) context.state = { users: [] };
                  else if (!context.state.users) context.state.users = [];
                  context.state.users.push(result);
                  break;
                case 'addItem':
                  if (!context.state) context.state = { items: [], totalAmount: 0 };
                  else if (!context.state.items) context.state.items = [];
                  
                  context.state.items.push({
                    productId: payload.productId,
                    name: payload.name,
                    price: payload.price,
                    quantity: payload.quantity
                  });
                  
                  // Calculate total amount
                  context.state.totalAmount = context.state.items.reduce(
                    (total: number, item: any) => total + (item.price * item.quantity), 0
                  );
                  
                  result = {
                    success: true,
                    itemCount: context.state.items.length,
                    totalAmount: context.state.totalAmount
                  };
                  break;
                case 'removeItem':
                  if (!context.state) context.state = { items: [], totalAmount: 0 };
                  else if (!context.state.items) context.state.items = [];
                  
                  const initialLength = context.state.items.length;
                  context.state.items = context.state.items.filter(
                    (item: any) => item.productId !== payload.productId
                  );
                  
                  // Calculate total amount
                  context.state.totalAmount = context.state.items.reduce(
                    (total: number, item: any) => total + (item.price * item.quantity), 0
                  );
                  
                  result = {
                    success: initialLength !== context.state.items.length,
                    itemCount: context.state.items.length,
                    totalAmount: context.state.totalAmount
                  };
                  break;
                case 'getCart':
                  if (!context.state) context.state = { items: [], totalAmount: 0 };
                  
                  result = {
                    items: context.state.items || [],
                    totalAmount: context.state.totalAmount || 0
                  };
                  break;
                default:
                  result = null;
              }
            }
            
            // Store result if specified
            if (whenStep.store) {
              results[whenStep.store] = result;
            }
          }
        }
        
        // Final actorState for assertions
        actorState = context.state || {};
        
        return { success: errors.length === 0, results, errors, actorState };
      }
      
      // Validate assertions against execution results
      validateAssertions(scenario: TestScenario, executionResult: any): { 
        valid: boolean;
        failedAssertions: string[];
      } {
        const failedAssertions: string[] = [];
        
        // Exit early if execution failed
        if (!executionResult.success) {
          return { valid: false, failedAssertions: [`Execution failed: ${executionResult.errors.join(', ')}`] };
        }
        
        // Process assertions
        for (const assertion of scenario.then) {
          const { assert, equals, contains, matches } = assertion;
          
          // Parse the assertion path (e.g., "result.name" or "actorState.users.length")
          const parts = assert.split('.');
          const root = parts[0];
          const path = parts.slice(1);
          
          // Get the value to assert against
          let value;
          if (root === 'actorState') {
            value = executionResult.actorState;
          } else {
            value = executionResult.results[root];
          }
          
          // Navigate the path
          for (const part of path) {
            if (value === undefined || value === null) {
              failedAssertions.push(`Assertion failed: ${assert} is undefined`);
              break;
            }
            value = value[part];
          }
          
          // Perform the assertion checks
          if (equals !== undefined) {
            if (value !== equals) {
              failedAssertions.push(`Assertion failed: ${assert} expected to equal ${equals} but got ${value}`);
            }
          } else if (contains !== undefined) {
            if (Array.isArray(value)) {
              const found = value.some(item => 
                typeof contains === 'object' ? 
                  Object.entries(contains).every(([k, v]) => item[k] === v) : 
                  item === contains
              );
              
              if (!found) {
                failedAssertions.push(`Assertion failed: ${assert} does not contain ${JSON.stringify(contains)}`);
              }
            } else if (typeof value === 'string') {
              if (!value.includes(contains)) {
                failedAssertions.push(`Assertion failed: ${assert} does not contain "${contains}"`);
              }
            } else {
              failedAssertions.push(`Assertion failed: ${assert} is not an array or string, cannot check contains`);
            }
          } else if (matches !== undefined) {
            if (typeof value !== 'string' || !new RegExp(matches).test(value)) {
              failedAssertions.push(`Assertion failed: ${assert} does not match pattern ${matches}`);
            }
          }
        }
        
        return { valid: failedAssertions.length === 0, failedAssertions };
      }
    }

    it('should execute test scenarios against mock implementations', async () => {
      // Define a cart actor for testing
      dsl.component('CartActor', {
        type: ComponentType.ACTOR,
        description: 'Shopping cart actor',
        version: '1.0.0',
        state: {
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            totalAmount: { type: 'number' }
          }
        },
        messageHandlers: {
          addItem: {
            input: {
              properties: {
                productId: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
                quantity: { type: 'number' }
              }
            },
            output: {
              properties: {
                success: { type: 'boolean' },
                itemCount: { type: 'number' },
                totalAmount: { type: 'number' }
              }
            }
          }
        }
      });

      // Define a test with simple scenario
      const cartTest = dsl.component('CartActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for CartActor',
        version: '1.0.0',
        target: { ref: 'CartActor' },
        scenarios: [
          {
            name: 'Add item to empty cart',
            given: [
              { setup: 'emptyState' }
            ],
            when: [
              {
                send: {
                  message: 'addItem',
                  payload: {
                    productId: 'prod-1',
                    name: 'Test Product',
                    price: 10.99,
                    quantity: 2
                  }
                },
                store: 'addResult'
              }
            ],
            then: [
              { assert: 'addResult.success', equals: true },
              { assert: 'addResult.itemCount', equals: 1 },
              { assert: 'addResult.totalAmount', equals: 21.98 }
            ]
          }
        ]
      });

      // Create test runner
      const testRunner = new TestRunner(dsl);
      
      // Execute scenario
      const executionResult = await testRunner.executeScenario(cartTest, cartTest.scenarios![0]);
      
      // Validate assertions
      const validationResult = testRunner.validateAssertions(cartTest.scenarios![0], executionResult);
      
      expect(executionResult.success).toBe(true);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.failedAssertions).toHaveLength(0);
      
      // Verify mock state changes
      expect(executionResult.actorState.items).toHaveLength(1);
      expect(executionResult.actorState.items[0].productId).toBe('prod-1');
      expect(executionResult.actorState.totalAmount).toBe(21.98);
    });

    it('should execute test scenarios with custom implementations', async () => {
      // Define an actor for testing
      dsl.component('CounterActor', {
        type: ComponentType.ACTOR,
        description: 'Counter actor',
        version: '1.0.0',
        state: {
          properties: {
            count: { type: 'number' }
          }
        },
        messageHandlers: {
          increment: {
            input: {
              properties: {
                value: { type: 'number' }
              }
            },
            output: {
              properties: {
                previousCount: { type: 'number' },
                newCount: { type: 'number' }
              }
            }
          },
          decrement: {
            input: {
              properties: {
                value: { type: 'number' }
              }
            },
            output: {
              properties: {
                previousCount: { type: 'number' },
                newCount: { type: 'number' }
              }
            }
          },
          getCount: {
            input: { type: 'null' },
            output: { type: 'number' }
          }
        }
      });

      // Define a test for the counter
      const counterTest = dsl.component('CounterActorTest', {
        type: ComponentType.TEST,
        description: 'Tests for CounterActor',
        version: '1.0.0',
        target: { ref: 'CounterActor' },
        scenarios: [
          {
            name: 'Increment counter',
            given: [
              { setup: 'initialState', with: { count: 5 } }
            ],
            when: [
              {
                send: {
                  message: 'increment',
                  payload: { value: 3 }
                },
                store: 'incrementResult'
              }
            ],
            then: [
              { assert: 'incrementResult.previousCount', equals: 5 },
              { assert: 'incrementResult.newCount', equals: 8 },
              { assert: 'actorState.count', equals: 8 }
            ]
          },
          {
            name: 'Decrement counter',
            given: [
              { setup: 'initialState', with: { count: 10 } }
            ],
            when: [
              {
                send: {
                  message: 'decrement',
                  payload: { value: 4 }
                },
                store: 'decrementResult'
              }
            ],
            then: [
              { assert: 'decrementResult.previousCount', equals: 10 },
              { assert: 'decrementResult.newCount', equals: 6 },
              { assert: 'actorState.count', equals: 6 }
            ]
          }
        ]
      });

      // Define a custom implementation
      const counterImpl = dsl.component('CounterActorImpl', {
        type: ComponentType.IMPLEMENTATION,
        description: 'Implementation of CounterActor',
        version: '1.0.0',
        targetComponent: 'CounterActor',
        handlers: {
          increment: async (input: any, context: ActorContext) => {
            if (!context.state) context.state = { count: 0 };
            const previousCount = context.state.count || 0;
            context.state.count = previousCount + input.value;
            return {
              previousCount,
              newCount: context.state.count
            };
          },
          decrement: async (input: any, context: ActorContext) => {
            if (!context.state) context.state = { count: 0 };
            const previousCount = context.state.count || 0;
            context.state.count = previousCount - input.value;
            return {
              previousCount,
              newCount: context.state.count
            };
          },
          getCount: async (_: any, context: ActorContext) => {
            return context.state?.count || 0;
          }
        }
      });

      // Create test runner
      const testRunner = new TestRunner(dsl);
      
      // Execute first scenario with implementation
      const incrementExecution = await testRunner.executeScenario(
        counterTest, 
        counterTest.scenarios![0], 
        counterImpl
      );
      
      // Validate assertions for first scenario
      const incrementValidation = testRunner.validateAssertions(
        counterTest.scenarios![0], 
        incrementExecution
      );
      
      expect(incrementExecution.success).toBe(true);
      expect(incrementValidation.valid).toBe(true);
      
      // Execute second scenario with implementation
      const decrementExecution = await testRunner.executeScenario(
        counterTest, 
        counterTest.scenarios![1], 
        counterImpl
      );
      
      // Validate assertions for second scenario
      const decrementValidation = testRunner.validateAssertions(
        counterTest.scenarios![1], 
        decrementExecution
      );
      
      expect(decrementExecution.success).toBe(true);
      expect(decrementValidation.valid).toBe(true);
      
      // Ensure we're getting the expected state changes
      expect(decrementExecution.actorState.count).toBe(6);
    });
  });
}); 