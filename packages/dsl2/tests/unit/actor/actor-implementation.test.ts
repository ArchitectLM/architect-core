import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

describe('Actor Implementation', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  it('should implement an actor with message handlers', () => {
    // Define the actor
    dsl.component('UserActor', {
      type: ComponentType.ACTOR,
      description: 'Actor managing user operations',
      version: '1.0.0',
      messageHandlers: {
        createUser: {
          input: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['name', 'email']
          },
          output: { type: 'object' }
        },
        getUser: {
          input: {
            type: 'object',
            properties: {
              userId: { type: 'string' }
            },
            required: ['userId']
          },
          output: { type: 'object' }
        }
      }
    });

    // Implement the actor
    const implementation = {
      createUser: async (msg: any, ctx: any) => {
        return {
          id: 'user-123',
          name: msg.name,
          email: msg.email,
          createdAt: new Date().toISOString()
        };
      },
      getUser: async (msg: any, ctx: any) => {
        return {
          id: msg.userId,
          name: 'Test User',
          email: 'test@example.com'
        };
      }
    };

    const impl = dsl.implementActor('UserActor', implementation);
    
    expect(impl).toBeDefined();
    expect(impl.createUser).toBeDefined();
    expect(impl.getUser).toBeDefined();
    expect(typeof impl.createUser).toBe('function');
    expect(typeof impl.getUser).toBe('function');
  });

  it('should handle actor state in implementations', async () => {
    // Define an actor with state
    dsl.component('CounterActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with counter state',
      version: '1.0.0',
      state: {
        type: 'object',
        properties: {
          count: { type: 'number', default: 0 }
        }
      },
      messageHandlers: {
        increment: {
          input: {
            type: 'object',
            properties: {
              amount: { type: 'number', default: 1 }
            }
          },
          output: { type: 'object' }
        },
        getCount: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    // Mock state management
    const state = { count: 0 };

    // Implement the actor
    const implementation = {
      increment: async (msg: any, ctx: { state: any }) => {
        const amount = msg.amount || 1;
        state.count += amount;
        return { count: state.count };
      },
      getCount: async (_: any, ctx: { state: any }) => {
        return { count: state.count };
      }
    };

    const impl = dsl.implementActor('CounterActor', implementation);
    
    // Test increment
    await impl.increment({ amount: 5 }, { state });
    expect(state.count).toBe(5);
    
    // Test increment again
    await impl.increment({ amount: 3 }, { state });
    expect(state.count).toBe(8);
    
    // Test getCount
    const result = await impl.getCount({}, { state });
    expect(result.count).toBe(8);
  });

  it('should implement lifecycle hooks', () => {
    // Define actor with lifecycle hooks
    dsl.component('ServiceActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with lifecycle hooks',
      version: '1.0.0',
      lifecycle: {
        onCreate: { handler: 'initialize' },
        onStart: { handler: 'connect' },
        onStop: { handler: 'disconnect' }
      },
      messageHandlers: {
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    // Spy functions for hooks
    const initialize = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const process = vi.fn().mockResolvedValue({ result: 'processed' });

    // Implement the actor
    const implementation = {
      initialize,
      connect,
      disconnect,
      process
    };

    const impl = dsl.implementActor('ServiceActor', implementation);
    
    expect(impl).toBeDefined();
    expect(impl.initialize).toBe(initialize);
    expect(impl.connect).toBe(connect);
    expect(impl.disconnect).toBe(disconnect);
    expect(impl.process).toBe(process);
  });

  it('should throw error when implementing undefined actor', () => {
    const implementation = {
      process: async (msg: any) => ({ result: 'processed' })
    };

    expect(() => dsl.implementActor('NonExistentActor', implementation))
      .toThrow(/actor not found/i);
  });

  it('should validate that all required message handlers are implemented', () => {
    dsl.component('ValidationActor', {
      type: ComponentType.ACTOR,
      description: 'Actor for validation testing',
      version: '1.0.0',
      messageHandlers: {
        required1: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        required2: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        optional: {
          input: { type: 'object' },
          output: { type: 'object' },
          optional: true
        }
      }
    });

    // Missing required2
    const incompleteImpl = {
      required1: async (msg: any) => ({ success: true })
    };

    expect(() => dsl.implementActor('ValidationActor', incompleteImpl))
      .toThrow(/required message handler.*required2/i);

    // All required handlers implemented
    const completeImpl = {
      required1: async (msg: any) => ({ success: true }),
      required2: async (msg: any) => ({ success: true })
    };

    // Should not throw
    const impl = dsl.implementActor('ValidationActor', completeImpl);
    expect(impl).toBeDefined();
  });
}); 