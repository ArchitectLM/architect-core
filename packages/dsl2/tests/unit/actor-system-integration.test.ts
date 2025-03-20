import { describe, test, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';
import { RuntimeAdapter } from '../../src/runtime/adapter.js';

describe('Actor System Integration', () => {
  let dsl: DSL;
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    dsl = new DSL();
    adapter = new RuntimeAdapter(dsl);
  });

  describe('System Definition with Actors', () => {
    test('should define a system with actors as components', () => {
      // Define actors
      const userActor = dsl.actor('UserActor', {
        description: 'User management actor',
        version: '1.0.0',
        messageHandlers: {
          getUser: {
            input: { type: 'object', properties: { id: { type: 'string' } } },
            output: { type: 'object', properties: { name: { type: 'string' } } }
          },
          createUser: {
            input: { type: 'object', properties: { name: { type: 'string' } } },
            output: { type: 'object', properties: { id: { type: 'string' } } }
          }
        }
      });

      const orderActor = dsl.actor('OrderActor', {
        description: 'Order management actor',
        version: '1.0.0',
        messageHandlers: {
          createOrder: {
            input: { 
              type: 'object', 
              properties: { 
                userId: { type: 'string' },
                items: { type: 'array' }
              } 
            },
            output: { 
              type: 'object', 
              properties: { 
                orderId: { type: 'string' },
                status: { type: 'string' }
              } 
            }
          }
        }
      });

      // Define a system with these actors
      const system = dsl.system('ECommerceSystem', {
        description: 'E-Commerce System with Actor Components',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'UserActor' },
            { ref: 'OrderActor' }
          ]
        }
      });

      expect(system).toBeDefined();
      expect(system.id).toBe('ECommerceSystem');
      expect(system.description).toBe('E-Commerce System with Actor Components');
      expect(system.components.actors).toHaveLength(2);
      expect(system.components.actors?.[0].ref).toBe('UserActor');
      expect(system.components.actors?.[1].ref).toBe('OrderActor');
    });

    test('should create an actor system from a system definition', () => {
      // Define an actor 
      dsl.actor('GreeterActor', {
        description: 'Simple greeter actor',
        version: '1.0.0',
        messageHandlers: {
          greet: {
            input: { type: 'object', properties: { name: { type: 'string' } } },
            output: { type: 'object', properties: { greeting: { type: 'string' } } }
          }
        }
      });

      // Implement the actor
      dsl.implementActor('GreeterActor', {
        greet: async (msg: { name: string }, ctx: any) => {
          return { greeting: `Hello, ${msg.name}!` };
        }
      });

      // Define a system with the actor
      dsl.system('SimpleSystem', {
        description: 'Simple system with a greeter actor',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'GreeterActor' }
          ]
        }
      });

      // Create an actor system
      const actorSystem = adapter.createActorSystem('SimpleSystem');
      
      expect(actorSystem).toBeDefined();
      expect(actorSystem.id).toBe('SimpleSystem');
    });
  });

  describe('Actor Message Handling', () => {
    test('should send messages to actors and receive responses', async () => {
      // Define an actor
      dsl.actor('CalculatorActor', {
        description: 'Simple calculator actor',
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
          multiply: {
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
        }
      });

      // Implement the actor
      dsl.implementActor('CalculatorActor', {
        add: async (msg: { a: number; b: number }, ctx: any) => {
          return { result: msg.a + msg.b };
        },
        multiply: async (msg: { a: number; b: number }, ctx: any) => {
          return { result: msg.a * msg.b };
        }
      });

      // Define a system with the actor
      dsl.system('MathSystem', {
        description: 'Math system with calculator actor',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'CalculatorActor' }
          ]
        }
      });

      // Create actor system and actor
      const actorSystem = adapter.createActorSystem('MathSystem');
      const calculator = actorSystem.createActor('CalculatorActor');
      
      // Send messages
      const addResult = await calculator.send('add', { a: 5, b: 3 });
      const multiplyResult = await calculator.send('multiply', { a: 4, b: 7 });
      
      expect(addResult).toEqual({ result: 8 });
      expect(multiplyResult).toEqual({ result: 28 });
    });

    test('should handle errors gracefully', async () => {
      // Define an actor with a handler that can fail
      dsl.actor('ErrorProne', {
        description: 'Actor that can fail',
        version: '1.0.0',
        messageHandlers: {
          doSomething: {
            input: { 
              type: 'object', 
              properties: { shouldFail: { type: 'boolean' } } 
            },
            output: { 
              type: 'object', 
              properties: { success: { type: 'boolean' } } 
            }
          }
        }
      });

      // Implement the actor
      dsl.implementActor('ErrorProne', {
        doSomething: async (msg: { shouldFail: boolean }, ctx: any) => {
          if (msg.shouldFail) {
            throw new Error('Operation failed as requested');
          }
          return { success: true };
        }
      });

      // Define a system with the actor
      dsl.system('ErrorHandlingSystem', {
        description: 'System for testing error handling',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'ErrorProne' }
          ]
        }
      });

      // Create actor system and actor
      const actorSystem = adapter.createActorSystem('ErrorHandlingSystem');
      const errorProneActor = actorSystem.createActor('ErrorProne');
      
      // Successful operation
      const successResult = await errorProneActor.send('doSomething', { shouldFail: false });
      expect(successResult).toEqual({ success: true });
      
      // Failed operation
      await expect(errorProneActor.send('doSomething', { shouldFail: true }))
        .rejects.toThrow('Operation failed as requested');
      
      // Check actor status
      expect(errorProneActor.status()).toBe('failed');
      
      // Restart the actor
      await errorProneActor.restart();
      expect(errorProneActor.status()).toBe('idle');
      
      // Should be able to handle messages again
      const afterRestartResult = await errorProneActor.send('doSomething', { shouldFail: false });
      expect(afterRestartResult).toEqual({ success: true });
    });
  });

  describe('Actor Lifecycle Management', () => {
    test('should manage actor lifecycle (start, stop, restart)', async () => {
      // Define an actor
      dsl.actor('LifecycleActor', {
        description: 'Actor for lifecycle testing',
        version: '1.0.0',
        messageHandlers: {
          ping: {
            input: { type: 'object' },
            output: { type: 'object', properties: { pong: { type: 'boolean' } } }
          }
        }
      });

      // Implement the actor
      dsl.implementActor('LifecycleActor', {
        ping: async (msg, ctx) => {
          return { pong: true };
        }
      });

      // Define a system
      dsl.system('LifecycleSystem', {
        description: 'System for testing actor lifecycle',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'LifecycleActor' }
          ]
        }
      });

      // Create actor system and actor
      const actorSystem = adapter.createActorSystem('LifecycleSystem');
      const lifecycleActor = actorSystem.createActor('LifecycleActor');
      
      // Initial state
      expect(lifecycleActor.status()).toBe('idle');
      
      // Send a message
      const result = await lifecycleActor.send('ping', {});
      expect(result).toEqual({ pong: true });
      
      // Stop the actor
      await lifecycleActor.stop();
      expect(lifecycleActor.status()).toBe('stopped');
      
      // Sending message to stopped actor should fail
      await expect(lifecycleActor.send('ping', {}))
        .rejects.toThrow('Cannot send message to actor');
      
      // Restart actor
      await lifecycleActor.restart();
      expect(lifecycleActor.status()).toBe('idle');
      
      // Should work again
      const afterRestartResult = await lifecycleActor.send('ping', {});
      expect(afterRestartResult).toEqual({ pong: true });
      
      // Stop all actors
      await actorSystem.stopAll();
      expect(lifecycleActor.status()).toBe('stopped');
    });
  });

  describe('Actor System Monitoring', () => {
    test('should provide system metrics', async () => {
      // Define actors
      dsl.actor('MetricsActor1', {
        description: 'First metrics actor',
        version: '1.0.0',
        messageHandlers: {
          ping: { input: { type: 'object' }, output: { type: 'object' } }
        }
      });
      
      dsl.actor('MetricsActor2', {
        description: 'Second metrics actor',
        version: '1.0.0',
        messageHandlers: {
          ping: { input: { type: 'object' }, output: { type: 'object' } }
        }
      });

      // Implement actors
      dsl.implementActor('MetricsActor1', {
        ping: async () => ({ pong: true })
      });
      
      dsl.implementActor('MetricsActor2', {
        ping: async () => ({ pong: true })
      });

      // Define system
      dsl.system('MetricsSystem', {
        description: 'System for testing metrics',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'MetricsActor1' },
            { ref: 'MetricsActor2' }
          ]
        }
      });

      // Create actor system
      const actorSystem = adapter.createActorSystem('MetricsSystem');
      
      // Create actors
      const actor1 = actorSystem.createActor('MetricsActor1');
      const actor2 = actorSystem.createActor('MetricsActor2');
      
      // Initial metrics
      let metrics = actorSystem.metrics();
      expect(metrics.activeActors).toBe(2);
      expect(metrics.messagesProcessed).toBe(0);
      expect(metrics.deadLetters).toBe(0);
      
      // Send some messages
      await actor1.send('ping', {});
      await actor1.send('ping', {});
      await actor2.send('ping', {});
      
      // Check metrics after messages
      metrics = actorSystem.metrics();
      expect(metrics.activeActors).toBe(2);
      expect(metrics.messagesProcessed).toBe(3);
      expect(metrics.deadLetters).toBe(0);
      
      // Stop one actor
      await actor1.stop();
      metrics = actorSystem.metrics();
      expect(metrics.activeActors).toBe(1);
      
      // Try to send to stopped actor (creates dead letter)
      await expect(actor1.send('ping', {})).rejects.toThrow();
      
      metrics = actorSystem.metrics();
      expect(metrics.deadLetters).toBe(1);
    });
  });
}); 