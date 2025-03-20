import { describe, test, expect, vi, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';
import { RuntimeAdapter } from '../../src/runtime/adapter.js';

describe('Actor Runtime Adapter', () => {
  let dsl: DSL;
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    dsl = new DSL();
    adapter = new RuntimeAdapter(dsl);
  });

  describe('Actor System Creation', () => {
    test('should create actor system from DSL definition', () => {
      // Define some actors
      dsl.actor('UserActor', {
        description: 'User management actor',
        version: '1.0.0',
        messageHandlers: {
          createUser: {
            input: { 
              type: 'object', 
              properties: { 
                name: { type: 'string' },
                email: { type: 'string' } 
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
        }
      });

      dsl.actor('OrderActor', {
        description: 'Order processing actor',
        version: '1.0.0',
        messageHandlers: {
          createOrder: {
            input: { 
              type: 'object', 
              properties: { 
                userId: { type: 'string' },
                items: { type: 'array', items: { type: 'string' } }
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

      // Define a system with actors
      dsl.system('ECommerceSystem', {
        description: 'E-commerce system with actors',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'UserActor' },
            { ref: 'OrderActor' }
          ]
        }
      });

      // Create an actor system
      const actorSystem = adapter.createActorSystem('ECommerceSystem');
      
      expect(actorSystem).toBeDefined();
      expect(actorSystem.id).toBe('ECommerceSystem');
      expect(actorSystem.actors).toHaveLength(2);
      expect(actorSystem.actors[0].id).toBe('UserActor');
      expect(actorSystem.actors[1].id).toBe('OrderActor');
    });

    test('should configure actor backpressure and supervision', () => {
      // Define actor with configuration
      dsl.actor('ConfiguredActor', {
        description: 'Actor with specific configuration',
        version: '1.0.0',
        messageHandlers: {
          doWork: {
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

      // Define a system with the configured actor
      dsl.system('ConfiguredSystem', {
        description: 'System with configured actors',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'ConfiguredActor' }
          ]
        }
      });

      // Create an actor system
      const actorSystem = adapter.createActorSystem('ConfiguredSystem');
      const actorConfig = actorSystem.actors[0].config;
      
      expect(actorConfig).toBeDefined();
      expect(actorConfig.backpressure.strategy).toBe('drop');
      expect(actorConfig.backpressure.maxMailboxSize).toBe(100);
      expect(actorConfig.supervision.maxRetries).toBe(3);
      expect(actorConfig.stateManagement.persistence).toBe(true);
    });
  });

  describe('Actor Message Handling', () => {
    test('should send messages to actors and receive responses', async () => {
      // Define and implement an actor
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
          }
        }
      });

      dsl.implementActor('CalculatorActor', {
        add: async (msg: { a: number, b: number }, ctx: any) => {
          return { result: msg.a + msg.b };
        }
      });

      // Define a system
      dsl.system('CalcSystem', {
        description: 'Calculator system',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'CalculatorActor' }
          ]
        }
      });

      // Create actor system and reference to actor
      const actorSystem = adapter.createActorSystem('CalcSystem');
      const calculator = actorSystem.getActor('CalculatorActor');
      
      // Send a message
      const result = await calculator.send('add', { a: 5, b: 3 });
      
      expect(result).toEqual({ result: 8 });
    });

    test('should handle errors gracefully', async () => {
      // Define and implement an actor with error handling
      dsl.actor('ErrorActor', {
        description: 'Actor that can produce errors',
        version: '1.0.0',
        messageHandlers: {
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
        }
      });

      dsl.implementActor('ErrorActor', {
        divide: async (msg: { a: number, b: number }, ctx: any) => {
          if (msg.b === 0) {
            throw new Error('Division by zero');
          }
          return { result: msg.a / msg.b };
        }
      });

      // Define a system
      dsl.system('ErrorSystem', {
        description: 'System with error handling',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'ErrorActor' }
          ]
        }
      });

      // Create actor system and reference to actor
      const actorSystem = adapter.createActorSystem('ErrorSystem');
      const actor = actorSystem.getActor('ErrorActor');
      
      // Successful message
      const result1 = await actor.send('divide', { a: 10, b: 2 });
      expect(result1).toEqual({ result: 5 });
      
      // Error handling
      try {
        await actor.send('divide', { a: 10, b: 0 });
        fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).toContain('Division by zero');
      }
    });
  });

  describe('Actor Lifecycle Management', () => {
    test('should start and stop actors', async () => {
      // Define an actor with lifecycle hooks
      dsl.actor('ManagedActor', {
        description: 'Actor with lifecycle management',
        version: '1.0.0',
        messageHandlers: {
          ping: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: { status: { type: 'string' } } }
          }
        }
      });

      // Mock implementations for lifecycle hooks
      const startMock = vi.fn();
      const stopMock = vi.fn();
      
      dsl.implementActor('ManagedActor', {
        ping: async (msg: any, ctx: any) => {
          return { status: 'alive' };
        },
        _start: async (ctx: any) => {
          startMock();
          return { initialized: true };
        },
        _stop: async (ctx: any) => {
          stopMock();
        }
      });

      // Define a system
      dsl.system('LifecycleSystem', {
        description: 'System with lifecycle management',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'ManagedActor' }
          ]
        }
      });

      // Create actor system
      const actorSystem = adapter.createActorSystem('LifecycleSystem');
      
      // Start actors
      await actorSystem.start();
      expect(startMock).toHaveBeenCalledTimes(1);
      
      // Stop actors
      await actorSystem.stop();
      expect(stopMock).toHaveBeenCalledTimes(1);
    });

    test('should persist actor state', async () => {
      // Define a stateful actor
      dsl.actor('CounterActor', {
        description: 'Actor that maintains count state',
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
                count: { type: 'number' } 
              } 
            }
          },
          getCount: {
            input: { type: 'object', properties: {} },
            output: { 
              type: 'object', 
              properties: { 
                count: { type: 'number' } 
              } 
            }
          }
        },
        config: {
          stateManagement: {
            persistence: true
          }
        }
      });

      // Implement actor with state
      dsl.implementActor('CounterActor', {
        // Initialize state
        _start: async (ctx: any) => {
          ctx.state = { count: 0 };
        },
        
        // Message handlers
        increment: async (msg: { amount: number }, ctx: any) => {
          ctx.state.count += msg.amount;
          return { count: ctx.state.count };
        },
        
        getCount: async (msg: any, ctx: any) => {
          return { count: ctx.state.count };
        }
      });

      // Define a system
      dsl.system('StateSystem', {
        description: 'System with stateful actors',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'CounterActor' }
          ]
        }
      });

      // Create actor system
      const actorSystem = adapter.createActorSystem('StateSystem');
      await actorSystem.start();
      
      const counter = actorSystem.getActor('CounterActor');
      
      // Increment counter a few times
      await counter.send('increment', { amount: 5 });
      await counter.send('increment', { amount: 3 });
      
      // Get current count
      const result = await counter.send('getCount', {});
      expect(result).toEqual({ count: 8 });
      
      // Simulate actor restart (preserving state)
      await actorSystem.restartActor('CounterActor');
      
      // State should be preserved
      const resultAfterRestart = await counter.send('getCount', {});
      expect(resultAfterRestart).toEqual({ count: 8 });
    });
  });

  describe('Actor System Monitoring', () => {
    test('should track dead letters', async () => {
      // Create a simple actor system
      dsl.actor('SimpleActor', {
        description: 'Simple actor',
        version: '1.0.0',
        messageHandlers: {
          greet: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} }
          }
        }
      });

      dsl.implementActor('SimpleActor', {
        greet: async (msg: any, ctx: any) => {
          return { greeting: 'Hello' };
        }
      });

      dsl.system('MonitoredSystem', {
        description: 'System with monitoring',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'SimpleActor' }
          ]
        }
      });

      // Mock for dead letter monitoring
      const deadLetterHandler = vi.fn();
      
      // Create actor system with monitoring
      const actorSystem = adapter.createActorSystem('MonitoredSystem', {
        monitoring: {
          deadLetters: deadLetterHandler
        }
      });
      
      // Start the system
      await actorSystem.start();
      
      // Send to non-existent actor - should be caught as dead letter
      try {
        await actorSystem.sendMessage('NonExistentActor', 'someMessage', {});
      } catch (err) {
        // Error is expected
      }
      
      expect(deadLetterHandler).toHaveBeenCalledTimes(1);
      expect(deadLetterHandler.mock.calls[0][0]).toMatchObject({
        target: 'NonExistentActor',
        message: 'someMessage'
      });
    });

    test('should implement circuit breaking for failing actors', async () => {
      // Define an actor that fails frequently
      dsl.actor('UnstableActor', {
        description: 'Actor that fails frequently',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} }
          }
        },
        config: {
          supervision: {
            maxRetries: 3,
            circuitBreaker: {
              enabled: true,
              failureThreshold: 3,
              resetTimeout: 1000
            }
          }
        }
      });

      // Implement actor that fails
      let failures = 0;
      dsl.implementActor('UnstableActor', {
        process: async (msg: any, ctx: any) => {
          failures++;
          
          if (failures <= 3) {
            throw new Error('Simulated failure');
          }
          
          return { status: 'success' };
        }
      });

      dsl.system('CircuitBreakerSystem', {
        description: 'System with circuit breaker',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'UnstableActor' }
          ]
        }
      });

      // Create actor system with circuit breaker support
      const actorSystem = adapter.createActorSystem('CircuitBreakerSystem');
      await actorSystem.start();
      
      const actor = actorSystem.getActor('UnstableActor');
      
      // First 3 calls should fail and trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await actor.send('process', {});
        } catch (err) {
          // Expected error
        }
      }
      
      // Circuit should be open now - trying to send another message should
      // result in a circuit breaker error, not the original error
      try {
        await actor.send('process', {});
        fail('Should have thrown circuit breaker error');
      } catch (err: any) {
        expect(err.message).toContain('Circuit breaker open');
      }
      
      // Wait for circuit breaker to reset
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Now the call should succeed (failures will be > 3)
      const result = await actor.send('process', {});
      expect(result).toEqual({ status: 'success' });
    });
  });
}); 