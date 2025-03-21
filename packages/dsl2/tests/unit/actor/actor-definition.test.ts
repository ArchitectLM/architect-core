import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

describe('Actor Definition', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  it('should define an actor with basic properties', () => {
    const actor = dsl.component('UserActor', {
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
          output: { ref: 'User' }
        },
        getUser: {
          input: {
            type: 'object',
            properties: {
              userId: { type: 'string' }
            },
            required: ['userId']
          },
          output: { ref: 'User' }
        }
      }
    });

    expect(actor).toBeDefined();
    expect(actor.id).toBe('UserActor');
    expect(actor.type).toBe(ComponentType.ACTOR);
    expect(actor.description).toBe('Actor managing user operations');
    expect(actor.version).toBe('1.0.0');
    expect(actor.messageHandlers).toBeDefined();
    expect(actor.messageHandlers).toHaveProperty('createUser');
    expect(actor.messageHandlers).toHaveProperty('getUser');
  });

  it('should define actor state schema', () => {
    const actor = dsl.component('CartActor', {
      type: ComponentType.ACTOR,
      description: 'Actor managing shopping cart',
      version: '1.0.0',
      state: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number' },
                price: { type: 'number' }
              },
              required: ['productId', 'quantity', 'price']
            }
          },
          totalItems: { type: 'number', default: 0 },
          totalPrice: { type: 'number', default: 0 }
        }
      },
      messageHandlers: {
        addItem: {
          input: { ref: 'CartItem' },
          output: { ref: 'Cart' }
        }
      }
    });

    expect(actor).toBeDefined();
    expect(actor.state).toBeDefined();
    expect(actor.state.properties).toHaveProperty('items');
    expect(actor.state.properties).toHaveProperty('totalItems');
    expect(actor.state.properties.totalItems).toHaveProperty('default', 0);
  });

  it('should define actor lifecycle hooks', () => {
    const actor = dsl.component('ServiceActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with lifecycle hooks',
      version: '1.0.0',
      lifecycle: {
        onCreate: { task: 'initializeState' },
        onStart: { task: 'connectDependencies' },
        onStop: { task: 'cleanupResources' },
        onRestart: { task: 'reinitialize' }
      },
      messageHandlers: {
        performService: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    expect(actor).toBeDefined();
    expect(actor.lifecycle).toBeDefined();
    expect(actor.lifecycle).toHaveProperty('onCreate');
    expect(actor.lifecycle).toHaveProperty('onStart');
    expect(actor.lifecycle).toHaveProperty('onStop');
    expect(actor.lifecycle).toHaveProperty('onRestart');
  });

  it('should define actor supervision strategy', () => {
    const actor = dsl.component('SupervisedActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with supervision strategy',
      version: '1.0.0',
      supervision: {
        strategy: 'restart',
        maxRestarts: 3,
        withinTimeWindow: 60000,
        escalationPolicy: 'stop'
      },
      messageHandlers: {
        riskyOperation: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    expect(actor).toBeDefined();
    expect(actor.supervision).toBeDefined();
    expect(actor.supervision.strategy).toBe('restart');
    expect(actor.supervision.maxRestarts).toBe(3);
    expect(actor.supervision.withinTimeWindow).toBe(60000);
    expect(actor.supervision.escalationPolicy).toBe('stop');
  });
}); 