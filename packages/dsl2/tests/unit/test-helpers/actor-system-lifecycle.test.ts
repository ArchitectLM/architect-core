import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { createTestDSL, createMockContext, createTestEventLog } from './actor-system-test-utils.js';

/**
 * Tests for Actor System Lifecycle in the DSL
 * 
 * These tests focus on DSL's ability to define lifecycle hooks and management
 * capabilities, not on the actual runtime behavior (which is in core2)
 */
describe('Actor System Lifecycle', () => {
  let dsl: DSL;
  let eventLog: ReturnType<typeof createTestEventLog>;
  
  beforeEach(() => {
    dsl = createTestDSL();
    eventLog = createTestEventLog();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should define actors with lifecycle hooks', () => {
    // Define an actor with lifecycle hooks
    const actor = dsl.component('LifecycleActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with lifecycle hooks',
      version: '1.0.0',
      messageHandlers: {
        // Specific lifecycle message handlers
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        start: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        stop: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        // Regular message handler
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify actor definition
    expect(actor.id).toBe('LifecycleActor');
    expect(actor.messageHandlers).toBeDefined();
    // Using optional chaining to fix 'possibly undefined' errors
    expect(actor.messageHandlers?.initialize).toBeDefined();
    expect(actor.messageHandlers?.start).toBeDefined();
    expect(actor.messageHandlers?.stop).toBeDefined();
    expect(actor.messageHandlers?.shutdown).toBeDefined();
    expect(actor.messageHandlers?.process).toBeDefined();
  });

  it('should define system with startup and shutdown ordering', () => {
    // Define base actor type for lifecycle components
    dsl.component('LifecycleActor', {
      type: ComponentType.ACTOR,
      description: 'Base actor with lifecycle hooks',
      version: '1.0.0',
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        start: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        stop: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define specific actors with attributes
    dsl.component('DatabaseActor', {
      type: ComponentType.ACTOR,
      description: 'Database actor',
      version: '1.0.0',
      behaviors: [
        { ref: 'LifecycleActor' }
      ],
      attributes: {
        startupPriority: 10, // Start early (lower number = higher priority)
        shutdownPriority: 90 // Shutdown late (higher number = lower priority)
      },
      messageHandlers: {
        query: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('CacheActor', {
      type: ComponentType.ACTOR,
      description: 'Cache actor',
      version: '1.0.0',
      behaviors: [
        { ref: 'LifecycleActor' }
      ],
      attributes: {
        startupPriority: 20, // Start after database
        shutdownPriority: 80 // Shutdown before database
      },
      messageHandlers: {
        get: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        set: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('ApiActor', {
      type: ComponentType.ACTOR,
      description: 'API actor',
      version: '1.0.0',
      behaviors: [
        { ref: 'LifecycleActor' }
      ],
      attributes: {
        startupPriority: 30, // Start last
        shutdownPriority: 70 // Shutdown first
      },
      messageHandlers: {
        handleRequest: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define a system with these actors
    const system = dsl.system('LifecycleSystem', {
      description: 'System with lifecycle management',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'DatabaseActor' },
          { ref: 'CacheActor' },
          { ref: 'ApiActor' }
        ]
      }
    });
    
    // Verify system definition
    expect(system.id).toBe('LifecycleSystem');
    expect(system.components?.actors?.length).toBe(3);
    
    // Get the actors to check their lifecycle properties
    const dbActor = dsl.getComponent('DatabaseActor');
    const cacheActor = dsl.getComponent('CacheActor');
    const apiActor = dsl.getComponent('ApiActor');
    
    // Verify lifecycle properties from attributes
    expect(dbActor?.attributes?.startupPriority).toBe(10);
    expect(dbActor?.attributes?.shutdownPriority).toBe(90);
    
    expect(cacheActor?.attributes?.startupPriority).toBe(20);
    expect(cacheActor?.attributes?.shutdownPriority).toBe(80);
    
    expect(apiActor?.attributes?.startupPriority).toBe(30);
    expect(apiActor?.attributes?.shutdownPriority).toBe(70);
  });

  it('should define actors with dependency-based initialization', () => {
    // Define actors with dependencies
    dsl.component('ConfigActor', {
      type: ComponentType.ACTOR,
      description: 'Configuration actor',
      version: '1.0.0',
      attributes: {
        dependencies: [] // No dependencies
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
    
    dsl.component('DatabaseActor', {
      type: ComponentType.ACTOR,
      description: 'Database actor that depends on config',
      version: '1.0.0',
      attributes: {
        dependencies: ['ConfigActor'] // Depends on config
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        query: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('ApiActor', {
      type: ComponentType.ACTOR,
      description: 'API actor that depends on database and config',
      version: '1.0.0',
      attributes: {
        dependencies: ['ConfigActor', 'DatabaseActor'] // Multiple dependencies
      },
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        handleRequest: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define a system with these actors
    const system = dsl.system('DependencySystem', {
      description: 'System with dependency-based initialization',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'ConfigActor' },
          { ref: 'DatabaseActor' },
          { ref: 'ApiActor' }
        ]
      }
    });
    
    // Verify system definition
    expect(system.id).toBe('DependencySystem');
    expect(system.components?.actors?.length).toBe(3);
    
    // Verify actor dependencies
    const configActor = dsl.getComponent('ConfigActor');
    const dbActor = dsl.getComponent('DatabaseActor');
    const apiActor = dsl.getComponent('ApiActor');
    
    expect(configActor?.attributes?.dependencies).toEqual([]);
    expect(dbActor?.attributes?.dependencies).toEqual(['ConfigActor']);
    expect(apiActor?.attributes?.dependencies).toEqual(['ConfigActor', 'DatabaseActor']);
  });

  it('should define actors with health check and readiness indicators', () => {
    // Define an actor with health check
    dsl.component('HealthAwareActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with health check',
      version: '1.0.0',
      attributes: {
        healthCheck: {
          interval: '10s',
          timeout: '5s',
          retries: 3
        },
        readiness: {
          endpoint: 'isReady',
          timeout: '30s'
        }
      },
      messageHandlers: {
        isHealthy: {
          input: { type: 'object' },
          output: { 
            properties: { 
              healthy: { type: 'boolean' },
              status: { type: 'string' }
            } 
          }
        },
        isReady: {
          input: { type: 'object' },
          output: { 
            properties: { 
              ready: { type: 'boolean' },
              message: { type: 'string' }
            } 
          }
        },
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define a system with health check
    const system = dsl.system('HealthAwareSystem', {
      description: 'System with health checks',
      version: '1.0.0',
      attributes: {
        healthCheck: {
          interval: '30s',
          endpoint: '/health'
        },
        readiness: {
          timeout: '60s',
          endpoint: '/ready'
        }
      },
      components: {
        actors: [
          { ref: 'HealthAwareActor' }
        ]
      }
    });
    
    // Verify actor and system definitions
    const actor = dsl.getComponent('HealthAwareActor');
    
    expect(actor?.attributes?.healthCheck?.interval).toBe('10s');
    expect(actor?.attributes?.healthCheck?.timeout).toBe('5s');
    expect(actor?.attributes?.healthCheck?.retries).toBe(3);
    expect(actor?.attributes?.readiness?.endpoint).toBe('isReady');
    expect(actor?.attributes?.readiness?.timeout).toBe('30s');
    
    expect(system.attributes?.healthCheck?.interval).toBe('30s');
    expect(system.attributes?.healthCheck?.endpoint).toBe('/health');
    expect(system.attributes?.readiness?.timeout).toBe('60s');
    expect(system.attributes?.readiness?.endpoint).toBe('/ready');
  });

  it('should define actors with graceful shutdown capabilities', () => {
    // Define an actor with graceful shutdown
    const actor = dsl.component('GracefulActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with graceful shutdown',
      version: '1.0.0',
      attributes: {
        shutdownTimeout: '30s',
        gracePeriod: '5s'
      },
      messageHandlers: {
        shutdown: {
          input: { 
            properties: { 
              force: { type: 'boolean' } 
            } 
          },
          output: { 
            properties: { 
              success: { type: 'boolean' },
              pendingTasks: { type: 'number' }
            } 
          }
        },
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Verify actor definition
    expect(actor.id).toBe('GracefulActor');
    expect(actor.attributes?.shutdownTimeout).toBe('30s');
    expect(actor.attributes?.gracePeriod).toBe('5s');
    expect(actor.messageHandlers?.shutdown).toBeDefined();
    expect(actor.messageHandlers?.process).toBeDefined();
  });

  it('should define system with persistence and recovery capabilities', () => {
    // Define actors with persistence capabilities
    dsl.component('PersistentActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with state persistence',
      version: '1.0.0',
      attributes: {
        persistence: {
          enabled: true,
          snapshotInterval: 100, // Take snapshot every 100 state changes
          recoveryStrategy: 'latest' // Use latest snapshot for recovery
        }
      },
      messageHandlers: {
        saveState: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        restoreState: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define system with recovery settings
    const system = dsl.system('PersistenceSystem', {
      description: 'System with persistence and recovery',
      version: '1.0.0',
      attributes: {
        persistence: {
          provider: 'FileSystem',
          location: './state',
          recoveryTimeout: '60s'
        }
      },
      components: {
        actors: [
          { ref: 'PersistentActor' }
        ]
      }
    });
    
    // Verify component and system definitions
    const actor = dsl.getComponent('PersistentActor');
    
    expect(actor?.attributes?.persistence?.enabled).toBe(true);
    expect(actor?.attributes?.persistence?.snapshotInterval).toBe(100);
    expect(actor?.attributes?.persistence?.recoveryStrategy).toBe('latest');
    
    expect(system.attributes?.persistence?.provider).toBe('FileSystem');
    expect(system.attributes?.persistence?.location).toBe('./state');
    expect(system.attributes?.persistence?.recoveryTimeout).toBe('60s');
  });

  it('should define implementations with lifecycle hooks', () => {
    // Define an actor with lifecycle hooks
    dsl.component('LifecycleActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with lifecycle hooks',
      version: '1.0.0',
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        start: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        stop: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Implement the lifecycle actor
    const implementation = dsl.implementation('LifecycleActorImpl', {
      targetComponent: 'LifecycleActor',
      description: 'Implementation of lifecycle actor',
      version: '1.0.0',
      handlers: {
        // Lifecycle handlers
        initialize: async (input: any, context: any) => {
          eventLog.recordEvent('LifecycleActor', 'initialize');
          return { initialized: true };
        },
        start: async (input: any, context: any) => {
          eventLog.recordEvent('LifecycleActor', 'start');
          return { started: true };
        },
        stop: async (input: any, context: any) => {
          eventLog.recordEvent('LifecycleActor', 'stop');
          return { stopped: true };
        },
        shutdown: async (input: any, context: any) => {
          eventLog.recordEvent('LifecycleActor', 'shutdown');
          return { shutdown: true };
        },
        // Regular message handler
        process: async (input: any, context: any) => {
          eventLog.recordEvent('LifecycleActor', 'process', input);
          return { processed: true, input };
        }
      }
    });
    
    // Verify implementation
    expect(implementation.id).toBe('LifecycleActorImpl');
    expect(implementation.targetComponent).toBe('LifecycleActor');
    expect(typeof implementation.handlers.initialize).toBe('function');
    expect(typeof implementation.handlers.start).toBe('function');
    expect(typeof implementation.handlers.stop).toBe('function');
    expect(typeof implementation.handlers.shutdown).toBe('function');
    expect(typeof implementation.handlers.process).toBe('function');
  });
}); 