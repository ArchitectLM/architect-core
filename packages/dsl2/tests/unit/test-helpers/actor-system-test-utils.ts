import { vi } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ActorContext, ComponentType } from '../../../src/models/component.js';

/**
 * Utility functions to help test actor systems
 */

/**
 * Creates a basic mock context for testing actor implementations
 */
export function createMockContext(initialState: any = {}): ActorContext {
  return {
    state: initialState,
    flow: () => ({
      sendToActor: vi.fn().mockReturnValue({}),
      then: vi.fn().mockReturnValue({}),
      execute: vi.fn().mockResolvedValue({})
    } as any),
    behaviors: {},
    parent: {}
  };
}

/**
 * Creates a DSL instance with common test actors already defined
 */
export function createTestDSL(): DSL {
  const dsl = new DSL();
  
  // Define some common test actors
  dsl.component('LoggingActor', {
    type: ComponentType.ACTOR,
    description: 'Actor for logging test events',
    version: '1.0.0',
    messageHandlers: {
      log: {
        input: {
          properties: {
            level: { type: 'string' },
            message: { type: 'string' },
            data: { type: 'object' }
          },
          required: ['level', 'message']
        },
        output: { type: 'null' }
      }
    }
  });
  
  dsl.component('TestObserverActor', {
    type: ComponentType.ACTOR,
    description: 'Actor that observes test events and records them',
    version: '1.0.0',
    messageHandlers: {
      observeEvent: {
        input: { type: 'object' },
        output: { type: 'null' }
      },
      getObservations: {
        input: { type: 'object' },
        output: {
          type: 'array',
          items: { type: 'object' }
        }
      },
      clearObservations: {
        input: { type: 'object' },
        output: { type: 'null' }
      }
    }
  });
  
  return dsl;
}

/**
 * Creates a test event log for tracking events during tests
 */
export function createTestEventLog() {
  const events: Array<{
    source: string;
    action: string;
    timestamp: number;
    data?: any;
  }> = [];
  
  return {
    recordEvent: (source: string, action: string, data?: any) => {
      events.push({
        source,
        action,
        timestamp: Date.now(),
        data
      });
    },
    
    getEvents: () => [...events],
    
    getEventsBySource: (source: string) => 
      events.filter(event => event.source === source),
    
    getEventsByAction: (action: string) => 
      events.filter(event => event.action === action),
    
    clearEvents: () => {
      events.length = 0;
    }
  };
}

/**
 * Creates a mock persistence provider for testing stateful actors
 */
export function createMockPersistenceProvider() {
  const storedStates: Record<string, any> = {};
  const snapshots: Record<string, any[]> = {};
  
  return {
    saveState: vi.fn().mockImplementation((actorId: string, state: any) => {
      storedStates[actorId] = { ...state, lastSaved: Date.now() };
      return Promise.resolve({ success: true });
    }),
    
    loadState: vi.fn().mockImplementation((actorId: string) => {
      return Promise.resolve(storedStates[actorId] || null);
    }),
    
    createSnapshot: vi.fn().mockImplementation((actorId: string, state: any) => {
      if (!snapshots[actorId]) {
        snapshots[actorId] = [];
      }
      
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        timestamp: Date.now(),
        state: { ...state }
      };
      
      snapshots[actorId].push(snapshot);
      return Promise.resolve({ success: true, snapshotId: snapshot.id });
    }),
    
    getSnapshots: vi.fn().mockImplementation((actorId: string) => {
      return Promise.resolve(snapshots[actorId] || []);
    }),
    
    restoreSnapshot: vi.fn().mockImplementation((actorId: string, snapshotId: string) => {
      if (!snapshots[actorId]) {
        return Promise.resolve({ success: false, error: 'No snapshots found' });
      }
      
      const snapshot = snapshots[actorId].find(s => s.id === snapshotId);
      if (!snapshot) {
        return Promise.resolve({ success: false, error: 'Snapshot not found' });
      }
      
      storedStates[actorId] = { ...snapshot.state, restoredAt: Date.now() };
      return Promise.resolve({ success: true });
    }),
    
    // Helper for tests
    getAllStates: () => ({ ...storedStates }),
    getAllSnapshots: () => ({ ...snapshots })
  };
}

/**
 * Creates a mock actor system for testing interconnected actors
 */
export function createMockActorSystem() {
  const actors: Record<string, any> = {};
  const messageLog: Array<{
    from: string;
    to: string;
    pattern: string;
    message: any;
    timestamp: number;
  }> = [];
  
  const system = {
    registerActor: (id: string, implementation: any) => {
      actors[id] = implementation;
    },
    
    sendMessage: async (from: string, to: string, pattern: string, message: any) => {
      messageLog.push({
        from,
        to,
        pattern,
        message,
        timestamp: Date.now()
      });
      
      const targetActor = actors[to];
      if (!targetActor) {
        throw new Error(`Actor not found: ${to}`);
      }
      
      if (typeof targetActor.handleMessage === 'function') {
        return await targetActor.handleMessage(pattern, message, createMockContext());
      } else if (targetActor[pattern]) {
        return await targetActor[pattern](message, createMockContext());
      } else {
        throw new Error(`Message handler not found: ${pattern}`);
      }
    },
    
    // Helper methods for tests
    getMessageLog: () => [...messageLog],
    getRegisteredActors: () => Object.keys(actors),
    reset: () => {
      Object.keys(actors).forEach(key => delete actors[key]);
      messageLog.length = 0;
    }
  };
  
  return system;
}

/**
 * Helper to simulate a time delay in tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a test scenario runner for actor system tests
 */
export function createTestScenarioRunner(dsl: DSL) {
  return {
    runScenario: async (scenario: {
      setup: () => Promise<any>;
      actions: Array<() => Promise<any>>;
      cleanup?: () => Promise<any>;
    }) => {
      let setupResult;
      const actionResults = [];
      
      try {
        // Run setup
        setupResult = await scenario.setup();
        
        // Run each action
        for (const action of scenario.actions) {
          const result = await action();
          actionResults.push(result);
        }
      } finally {
        // Run cleanup if provided
        if (scenario.cleanup) {
          await scenario.cleanup();
        }
      }
      
      return {
        setupResult,
        actionResults
      };
    }
  };
} 