import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../../src/models/component.js';

/**
 * Tests for Actor System Shutdown
 * 
 * These tests cover:
 * - Graceful shutdown of actor systems
 * - Resource cleanup and finalization
 * - Shutdown sequence ordering
 * - Shutdown timeout and forced termination
 */
describe('Actor System Shutdown', () => {
  let dsl: DSL;
  let shutdownSequence: string[] = [];
  
  beforeEach(() => {
    dsl = new DSL();
    shutdownSequence = [];
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('should gracefully shut down all actors in reverse initialization order', async () => {
    // Define three actors with initialization priorities
    dsl.component('DatabaseActor', {
      type: ComponentType.ACTOR,
      description: 'Database connection actor',
      version: '1.0.0',
      attributes: {
        initializationPriority: 1, // Starts first
        shutdownPriority: 3        // Shuts down last
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('CacheActor', {
      type: ComponentType.ACTOR,
      description: 'Cache actor',
      version: '1.0.0',
      attributes: {
        initializationPriority: 2,
        shutdownPriority: 2
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('ApiActor', {
      type: ComponentType.ACTOR,
      description: 'API handler actor',
      version: '1.0.0',
      attributes: {
        initializationPriority: 3, // Starts last
        shutdownPriority: 1        // Shuts down first
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
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
          { ref: 'DatabaseActor' },
          { ref: 'CacheActor' },
          { ref: 'ApiActor' }
        ]
      }
    });
    
    // Mock implementations
    const dbActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        context.state = { 
          connections: 5,
          initialized: true 
        };
        return { success: true };
      },
      shutdown: async (input: any, context: ActorContext) => {
        if (context.state?.connections) {
          // Close all connections
          for (let i = 0; i < context.state.connections; i++) {
            // Simulate closing a connection
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        shutdownSequence.push('DatabaseActor');
        return { success: true };
      }
    };
    
    const cacheActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        context.state = { cacheSize: 100, initialized: true };
        return { success: true };
      },
      shutdown: async (input: any, context: ActorContext) => {
        // Simulate cache flush
        await new Promise(resolve => setTimeout(resolve, 20));
        shutdownSequence.push('CacheActor');
        return { success: true };
      }
    };
    
    const apiActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        context.state = { activeRequests: 3, initialized: true };
        return { success: true };
      },
      shutdown: async (input: any, context: ActorContext) => {
        // Wait for active requests to complete
        if (context.state?.activeRequests) {
          for (let i = 0; i < context.state.activeRequests; i++) {
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }
        shutdownSequence.push('ApiActor');
        return { success: true };
      }
    };
    
    // Register implementations
    dsl.implementation('DatabaseActorImpl', {
      targetComponent: 'DatabaseActor',
      description: 'Database actor implementation',
      version: '1.0.0',
      handlers: dbActorImpl
    });
    
    dsl.implementation('CacheActorImpl', {
      targetComponent: 'CacheActor',
      description: 'Cache actor implementation',
      version: '1.0.0',
      handlers: cacheActorImpl
    });
    
    dsl.implementation('ApiActorImpl', {
      targetComponent: 'ApiActor',
      description: 'API actor implementation',
      version: '1.0.0',
      handlers: apiActorImpl
    });
    
    // Mock actors and states
    const actorStates: Record<string, any> = {
      DatabaseActor: { connections: 5, initialized: true },
      CacheActor: { cacheSize: 100, initialized: true },
      ApiActor: { activeRequests: 3, initialized: true }
    };
    
    // Mock implementations lookup
    const actorImpls: Record<string, any> = {
      DatabaseActor: dbActorImpl,
      CacheActor: cacheActorImpl,
      ApiActor: apiActorImpl
    };
    
    // Mock system shutdown implementation
    const systemShutdown = async () => {
      // Get all actors from the system definition
      const actorComponents = system.components?.actors?.map(actor => {
        const component = dsl.getComponent(actor.ref);
        return component;
      }) || [];
      
      // Sort actors by shutdown priority
      const shutdownOrder = [...actorComponents].sort((a, b) => {
        const priorityA = a?.attributes?.shutdownPriority || 99;
        const priorityB = b?.attributes?.shutdownPriority || 99;
        return priorityA - priorityB;
      });
      
      // Shut down actors in order
      for (const actor of shutdownOrder) {
        if (actor) {
          const impl = actorImpls[actor.id];
          const state = actorStates[actor.id];
          
          if (impl && impl.shutdown) {
            const context: ActorContext = {
              flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
              state
            };
            
            await impl.shutdown({}, context);
          }
        }
      }
      
      return { success: true };
    };
    
    // Execute system shutdown
    await systemShutdown();
    
    // Verify shutdown sequence followed priority order
    expect(shutdownSequence).toEqual([
      'ApiActor',
      'CacheActor',
      'DatabaseActor'
    ]);
  });
  
  it('should handle resources cleanup and error handling during shutdown', async () => {
    // Define actors with resources
    dsl.component('ResourceActor', {
      type: ComponentType.ACTOR,
      description: 'Actor managing external resources',
      version: '1.0.0',
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('ProblemActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with problematic shutdown',
      version: '1.0.0',
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define system
    const system = dsl.system('CleanupSystem', {
      description: 'System testing resource cleanup',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'ResourceActor' },
          { ref: 'ProblemActor' }
        ]
      }
    });
    
    // External resource mock
    const externalResource = {
      open: vi.fn(),
      close: vi.fn().mockResolvedValue(true),
      isOpen: true
    };
    
    // Mock implementations
    const resourceActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        // Open external resource
        externalResource.open();
        externalResource.isOpen = true;
        
        context.state = { 
          resourceId: 'external-resource-123',
          initialized: true 
        };
        return { success: true };
      },
      shutdown: async (input: any, context: ActorContext) => {
        // Close external resource
        await externalResource.close();
        externalResource.isOpen = false;
        
        shutdownSequence.push('ResourceActor');
        return { success: true, resourceClosed: true };
      }
    };
    
    const problemActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        context.state = { initialized: true };
        return { success: true };
      },
      shutdown: async (input: any, context: ActorContext) => {
        // Simulate an error during shutdown
        throw new Error('Failed to shut down properly');
      }
    };
    
    // Register implementations
    dsl.implementation('ResourceActorImpl', {
      targetComponent: 'ResourceActor',
      description: 'Resource actor implementation',
      version: '1.0.0',
      handlers: resourceActorImpl
    });
    
    dsl.implementation('ProblemActorImpl', {
      targetComponent: 'ProblemActor',
      description: 'Problem actor implementation',
      version: '1.0.0',
      handlers: problemActorImpl
    });
    
    // Mock actor states
    const actorStates: Record<string, any> = {
      ResourceActor: { resourceId: 'external-resource-123', initialized: true },
      ProblemActor: { initialized: true }
    };
    
    // Mock implementations lookup
    const actorImpls: Record<string, any> = {
      ResourceActor: resourceActorImpl,
      ProblemActor: problemActorImpl
    };
    
    // Mock system shutdown with error handling
    const systemShutdownWithErrorHandling = async () => {
      const errors: Record<string, Error> = {};
      const shutdownResults: Record<string, boolean> = {};
      
      // Get all actors from the system
      const actorIds = Object.keys(actorImpls);
      
      // Shut down each actor, catching errors
      for (const actorId of actorIds) {
        const impl = actorImpls[actorId];
        const state = actorStates[actorId];
        
        if (impl && impl.shutdown) {
          const context: ActorContext = {
            flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
            state
          };
          
          try {
            await impl.shutdown({}, context);
            shutdownResults[actorId] = true;
          } catch (error) {
            errors[actorId] = error as Error;
            shutdownResults[actorId] = false;
          }
        }
      }
      
      return { 
        success: Object.keys(errors).length === 0,
        errors,
        shutdownResults
      };
    };
    
    // Execute system shutdown
    const result = await systemShutdownWithErrorHandling();
    
    // Verify external resource was closed
    expect(externalResource.close).toHaveBeenCalled();
    expect(externalResource.isOpen).toBe(false);
    
    // Verify error was caught
    expect(result.success).toBe(false);
    expect(result.errors.ProblemActor).toBeDefined();
    expect(result.errors.ProblemActor.message).toBe('Failed to shut down properly');
    
    // Verify partial shutdown results
    expect(result.shutdownResults.ResourceActor).toBe(true);
    expect(result.shutdownResults.ProblemActor).toBe(false);
    expect(shutdownSequence).toContain('ResourceActor');
    expect(shutdownSequence).not.toContain('ProblemActor');
  });
  
  it('should implement shutdown timeout and forced termination', async () => {
    // Define actor with slow shutdown
    dsl.component('SlowActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with slow shutdown process',
      version: '1.0.0',
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define system
    const system = dsl.system('TimeoutSystem', {
      description: 'System testing shutdown timeouts',
      version: '1.0.0',
      components: {
        actors: [{ ref: 'SlowActor' }]
      },
      attributes: {
        shutdownTimeout: 1000 // 1 second timeout
      }
    });
    
    // Track force shutdown
    let forcedShutdown = false;
    
    // Mock implementation with very slow shutdown
    const slowActorImpl = {
      initialize: async (input: any, context: ActorContext) => {
        context.state = { initialized: true };
        return { success: true };
      },
      shutdown: async (input: any, context: ActorContext) => {
        // Simulate a very slow shutdown process
        await new Promise(resolve => {
          const timeoutId = setTimeout(() => {
            shutdownSequence.push('SlowActor-Completed');
            resolve(true);
          }, 5000); // 5 seconds, longer than timeout
          
          // Store the timeout ID to cancel it if forced
          context.state.shutdownTimeoutId = timeoutId;
        });
        
        return { success: true };
      },
      forceShutdown: async (context: ActorContext) => {
        // Cancel the pending timeout
        if (context.state?.shutdownTimeoutId) {
          clearTimeout(context.state.shutdownTimeoutId);
        }
        
        forcedShutdown = true;
        shutdownSequence.push('SlowActor-Forced');
        return { forced: true };
      }
    };
    
    // Register implementation
    dsl.implementation('SlowActorImpl', {
      targetComponent: 'SlowActor',
      description: 'Slow actor implementation',
      version: '1.0.0',
      handlers: slowActorImpl
    });
    
    // Mock context
    const context: ActorContext = {
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      state: { initialized: true }
    };
    
    // Mock system shutdown with timeout
    const shutdownWithTimeout = async (timeout: number) => {
      // Start the regular shutdown
      const shutdownPromise = slowActorImpl.shutdown({}, context);
      
      // Create a timeout promise
      const timeoutPromise = new Promise(resolve => {
        setTimeout(() => {
          resolve({ timedOut: true });
        }, timeout);
      });
      
      // Race between normal shutdown and timeout
      const result = await Promise.race([
        shutdownPromise.then(() => ({ completed: true })),
        timeoutPromise
      ]);
      
      // If timeout occurred, force shutdown
      if ('timedOut' in result) {
        await slowActorImpl.forceShutdown(context);
        return { timedOut: true, forced: true };
      }
      
      return { completed: true };
    };
    
    // Execute shutdown with timeout
    const result = await shutdownWithTimeout(1000);
    
    // Advance timer to simulate timeout
    vi.advanceTimersByTime(1500); 
    
    // Verify timeout occurred and forced shutdown was called
    expect(result.timedOut).toBe(true);
    expect(result.forced).toBe(true);
    expect(forcedShutdown).toBe(true);
    
    // Verify shutdown sequence
    expect(shutdownSequence).toContain('SlowActor-Forced');
    expect(shutdownSequence).not.toContain('SlowActor-Completed');
  });
}); 