import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../../src/models/component.js';

/**
 * Tests for Actor System Initialization and Startup
 * 
 * These tests cover:
 * - Creation of an actor system with multiple actors
 * - Initialization sequence of actors
 * - Dependency resolution between actors
 * - System readiness detection
 */
describe('Actor System Initialization', () => {
  let dsl: DSL;
  let initializationSequence: string[] = [];

  beforeEach(() => {
    dsl = new DSL();
    initializationSequence = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create and initialize an actor system with multiple actors', async () => {
    // Define actors with initialization hooks
    dsl.component('RootActor', {
      type: ComponentType.ACTOR,
      description: 'Root actor that starts first',
      version: '1.0.0',
      attributes: {
        initializationPriority: 1 // Highest priority
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        getStatus: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    dsl.component('DatabaseActor', {
      type: ComponentType.ACTOR,
      description: 'Actor managing database connections',
      version: '1.0.0',
      attributes: {
        initializationPriority: 2,
        dependencies: ['RootActor']
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        connect: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    dsl.component('BusinessLogicActor', {
      type: ComponentType.ACTOR,
      description: 'Actor implementing business logic',
      version: '1.0.0',
      attributes: {
        initializationPriority: 3,
        dependencies: ['DatabaseActor']
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        processData: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    // Define system
    const system = dsl.system('TestSystem', {
      description: 'Test actor system',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'RootActor' },
          { ref: 'DatabaseActor' },
          { ref: 'BusinessLogicActor' }
        ]
      }
    });

    // Mock implementations
    const rootActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        initializationSequence.push('RootActor');
        context.state = { initialized: true, timestamp: Date.now() };
        return { success: true, actorId: 'RootActor' };
      },
      getStatus: async (input: any, context: ActorContext) => {
        return { status: 'active', ...context.state };
      }
    };

    const dbActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        initializationSequence.push('DatabaseActor');
        context.state = { 
          initialized: true, 
          connections: 0,
          timestamp: Date.now()
        };
        return { success: true, actorId: 'DatabaseActor' };
      },
      connect: async (input: any, context: ActorContext) => {
        if (!context.state?.initialized) {
          throw new Error('Database actor not initialized');
        }
        context.state.connections++;
        return { connected: true, totalConnections: context.state.connections };
      }
    };

    const businessLogicImpl = {
      initialize: async (input: any, context: ActorContext) => {
        initializationSequence.push('BusinessLogicActor');
        context.state = { initialized: true, timestamp: Date.now() };
        return { success: true, actorId: 'BusinessLogicActor' };
      },
      processData: async (input: any, context: ActorContext) => {
        if (!context.state?.initialized) {
          throw new Error('Business logic actor not initialized');
        }
        return { processed: true, data: input.data };
      }
    };

    // Register implementations
    dsl.implementation('RootActorImpl', {
      targetComponent: 'RootActor',
      description: 'Root actor implementation',
      version: '1.0.0',
      handlers: rootActorImpl
    });

    dsl.implementation('DatabaseActorImpl', {
      targetComponent: 'DatabaseActor',
      description: 'Database actor implementation',
      version: '1.0.0',
      handlers: dbActorImpl
    });

    dsl.implementation('BusinessLogicActorImpl', {
      targetComponent: 'BusinessLogicActor',
      description: 'Business logic actor implementation',
      version: '1.0.0',
      handlers: businessLogicImpl
    });

    // Mock the system start implementation
    const systemStartFn = vi.fn().mockImplementation(async () => {
      // Create actor instances
      const actors: Record<string, any> = {};
      const actorStates: Record<string, any> = {};
      
      // Sort actors by initialization priority
      const sortedActors = system.components.actors
        .map(actor => dsl.getComponent(actor.ref))
        .sort((a, b) => {
          const priorityA = a.attributes?.initializationPriority || 99;
          const priorityB = b.attributes?.initializationPriority || 99;
          return priorityA - priorityB;
        });
      
      // Initialize actors in order
      for (const actor of sortedActors) {
        const impl = dsl.getImplementation(actor.id);
        if (impl && impl.handlers.initialize) {
          const context: ActorContext = { 
            flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
            state: {}
          };
          
          await impl.handlers.initialize({}, context);
          actors[actor.id] = impl;
          actorStates[actor.id] = context.state;
        }
      }
      
      return { 
        actors,
        actorStates,
        isRunning: true
      };
    });
    
    // Start the system
    const runningSystem = await systemStartFn();
    
    // Verify initialization sequence
    expect(initializationSequence).toEqual([
      'RootActor',
      'DatabaseActor',
      'BusinessLogicActor'
    ]);
    
    // Verify actor states
    expect(runningSystem.actors).toHaveProperty('RootActor');
    expect(runningSystem.actors).toHaveProperty('DatabaseActor');
    expect(runningSystem.actors).toHaveProperty('BusinessLogicActor');
    
    expect(runningSystem.actorStates.RootActor.initialized).toBe(true);
    expect(runningSystem.actorStates.DatabaseActor.initialized).toBe(true);
    expect(runningSystem.actorStates.BusinessLogicActor.initialized).toBe(true);
    
    expect(runningSystem.isRunning).toBe(true);
  });

  it('should handle actor initialization failures and dependencies correctly', async () => {
    // Define actors with dependencies
    dsl.component('ConfigActor', {
      type: ComponentType.ACTOR,
      description: 'Configuration actor',
      version: '1.0.0',
      attributes: {
        initializationPriority: 1
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        getConfig: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    dsl.component('DependentActor', {
      type: ComponentType.ACTOR,
      description: 'Actor depending on ConfigActor',
      version: '1.0.0',
      attributes: {
        dependencies: ['ConfigActor']
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });

    // Define system
    const system = dsl.system('DependencySystem', {
      description: 'System with actor dependencies',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'ConfigActor' },
          { ref: 'DependentActor' }
        ]
      }
    });

    // Mock implementations 
    let configInitSucceeds = false;

    const configActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        if (configInitSucceeds) {
          initializationSequence.push('ConfigActor');
          context.state = { initialized: true, config: { key: 'value' } };
          return { success: true };
        } else {
          throw new Error('Configuration error');
        }
      },
      getConfig: async (input: any, context: ActorContext) => {
        return context.state.config;
      }
    };

    const dependentActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        initializationSequence.push('DependentActor');
        
        // This should fail if ConfigActor isn't initialized
        const configActor = context.actorOf('ConfigActor');
        const config = await configActor.ask('getConfig', {});
        
        context.state = { 
          initialized: true,
          configRef: config
        };
        
        return { success: true };
      }
    };

    // Register implementations
    dsl.implementation('ConfigActorImpl', {
      targetComponent: 'ConfigActor',
      description: 'Config actor implementation',
      version: '1.0.0',
      handlers: configActorImpl
    });

    dsl.implementation('DependentActorImpl', {
      targetComponent: 'DependentActor',
      description: 'Dependent actor implementation',
      version: '1.0.0',
      handlers: dependentActorImpl
    });

    // Implementation of system start with dependency checking
    const systemStartWithDependencies = async () => {
      const actors: Record<string, any> = {};
      const actorStates: Record<string, any> = {};
      
      // Sort actors by dependencies
      const actorComponents = system.components.actors.map(actor => dsl.getComponent(actor.ref));
      const visited = new Set<string>();
      const actorsInOrder: any[] = [];
      
      // Simple topological sort
      const visit = (actor: any) => {
        if (visited.has(actor.id)) return;
        visited.add(actor.id);
        
        const dependencies = actor.attributes?.dependencies || [];
        for (const depId of dependencies) {
          const depActor = actorComponents.find(a => a.id === depId);
          if (depActor) {
            visit(depActor);
          }
        }
        
        actorsInOrder.push(actor);
      };
      
      actorComponents.forEach(visit);
      
      // Mock actor context factory
      const createContext = (actorId: string) => {
        const context: ActorContext = {
          flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
          state: {},
          actorOf: (targetId: string) => ({
            ask: async (msg: string, payload: any) => {
              const targetImpl = actors[targetId];
              if (!targetImpl || !targetImpl.handlers[msg]) {
                throw new Error(`Actor ${targetId} cannot handle message ${msg}`);
              }
              return targetImpl.handlers[msg](payload, actorStates[targetId]);
            }
          })
        };
        return context;
      };
      
      // Initialize actors in dependency order
      for (const actor of actorsInOrder) {
        const impl = dsl.getImplementation(actor.id);
        if (impl && impl.handlers.initialize) {
          try {
            const context = createContext(actor.id);
            await impl.handlers.initialize({}, context);
            actors[actor.id] = impl;
            actorStates[actor.id] = context;
          } catch (error) {
            return {
              success: false,
              error: `Failed to initialize ${actor.id}: ${(error as Error).message}`,
              initializedActors: Object.keys(actors)
            };
          }
        }
      }
      
      return { 
        success: true,
        actors,
        actorStates,
        isRunning: true
      };
    };
    
    // First attempt - config actor fails
    configInitSucceeds = false;
    const failedStart = await systemStartWithDependencies();
    
    expect(failedStart.success).toBe(false);
    expect(failedStart.error).toContain('Failed to initialize ConfigActor');
    expect(initializationSequence).toEqual([]);
    
    // Reset and retry with successful config
    initializationSequence = [];
    configInitSucceeds = true;
    const successfulStart = await systemStartWithDependencies();
    
    expect(successfulStart.success).toBe(true);
    expect(successfulStart.isRunning).toBe(true);
    
    // Verify initialization sequence respected dependencies
    expect(initializationSequence).toEqual([
      'ConfigActor',
      'DependentActor'
    ]);
  });

  it('should detect when the system is ready', async () => {
    // Define actor with async initialization that takes time
    dsl.component('SlowStartupActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with slow startup',
      version: '1.0.0',
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        isReady: {
          input: { type: 'object' },
          output: { type: 'boolean' }
        }
      }
    });

    // Define system
    const system = dsl.system('ReadinessSystem', {
      description: 'System with readiness detection',
      version: '1.0.0',
      components: {
        actors: [{ ref: 'SlowStartupActor' }]
      }
    });

    // Mock implementation with delayed readiness
    let isReady = false;
    const slowActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        context.state = { initialized: true, ready: false };
        
        // Simulate async initialization
        setTimeout(() => {
          context.state.ready = true;
          isReady = true;
        }, 2000); // 2 seconds delay
        
        return { initialized: true };
      },
      isReady: async (input: any, context: ActorContext) => {
        return context.state.ready;
      }
    };

    // Register implementation
    dsl.implementation('SlowActorImpl', {
      targetComponent: 'SlowStartupActor',
      description: 'Slow actor implementation',
      version: '1.0.0',
      handlers: slowActorImpl
    });

    // Start system
    const actorContext: ActorContext = {
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      state: {}
    };
    
    await slowActorImpl.initialize({}, actorContext);
    
    // Check initial readiness
    expect(await slowActorImpl.isReady({}, actorContext)).toBe(false);
    
    // Advance time and check again
    vi.advanceTimersByTime(1000);
    expect(await slowActorImpl.isReady({}, actorContext)).toBe(false);
    
    // Advance more time to reach readiness
    vi.advanceTimersByTime(1500);
    expect(await slowActorImpl.isReady({}, actorContext)).toBe(true);
    expect(isReady).toBe(true);
  });
}); 