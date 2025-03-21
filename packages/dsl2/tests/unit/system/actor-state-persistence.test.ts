import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../../src/models/component.js';

/**
 * Tests for Actor State Persistence and Recovery
 * 
 * These tests cover:
 * - Persisting actor state
 * - Recovering actor state after restart
 * - State snapshots and versioning
 * - Conflict resolution for state updates
 */
describe('Actor State Persistence', () => {
  let dsl: DSL;
  let persistedState: Record<string, any> = {};
  let persistenceEvents: Array<{ 
    actorId: string; 
    operation: 'save' | 'load' | 'snapshot' | 'recover';
    state: any 
  }> = [];
  
  beforeEach(() => {
    dsl = new DSL();
    persistedState = {};
    persistenceEvents = [];
  });
  
  it('should persist and recover actor state', async () => {
    // Define stateful actor
    dsl.component('CounterActor', {
      type: ComponentType.ACTOR,
      description: 'Actor managing a counter',
      version: '1.0.0',
      messageHandlers: {
        increment: {
          input: { 
            properties: { amount: { type: 'number' } },
            required: []
          },
          output: { type: 'object' }
        },
        getCount: {
          input: { type: 'object' },
          output: { type: 'number' }
        },
        reset: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      },
      attributes: {
        stateful: true,
        persistenceId: 'counter'
      }
    });
    
    // Define system
    const system = dsl.system('PersistenceSystem', {
      description: 'System for testing state persistence',
      version: '1.0.0',
      components: {
        actors: [{ ref: 'CounterActor' }]
      }
    });
    
    // Mock persistence provider
    const persistenceProvider = {
      saveState: vi.fn().mockImplementation((actorId: string, state: any) => {
        persistedState[actorId] = JSON.parse(JSON.stringify(state)); // Deep copy
        persistenceEvents.push({ 
          actorId, 
          operation: 'save',
          state: JSON.parse(JSON.stringify(state))
        });
        return Promise.resolve({ success: true });
      }),
      
      loadState: vi.fn().mockImplementation((actorId: string) => {
        const state = persistedState[actorId];
        if (state) {
          persistenceEvents.push({ 
            actorId, 
            operation: 'load',
            state: JSON.parse(JSON.stringify(state))
          });
        }
        return Promise.resolve(state ? JSON.parse(JSON.stringify(state)) : null);
      })
    };
    
    // Implementation
    const counterActorImpl = {
      // State initialization
      initializeState: async (context: ActorContext) => {
        // Try to load persisted state
        const persistenceId = 'counter';
        const loadedState = await persistenceProvider.loadState(persistenceId);
        
        if (loadedState) {
          // Use loaded state
          context.state = loadedState;
        } else {
          // Initialize with default state
          context.state = { count: 0, lastUpdated: Date.now() };
        }
        
        return { initialized: true };
      },
      
      // Message handlers
      increment: async (input: any, context: ActorContext) => {
        const amount = input.amount || 1;
        
        if (!context.state) {
          await counterActorImpl.initializeState(context);
        }
        
        // Update state
        context.state.count += amount;
        context.state.lastUpdated = Date.now();
        
        // Persist the updated state
        await persistenceProvider.saveState('counter', context.state);
        
        return { 
          success: true, 
          newCount: context.state.count
        };
      },
      
      getCount: async (input: any, context: ActorContext) => {
        if (!context.state) {
          await counterActorImpl.initializeState(context);
        }
        
        return context.state.count;
      },
      
      reset: async (input: any, context: ActorContext) => {
        // Reset to initial state
        context.state = { count: 0, lastUpdated: Date.now() };
        
        // Persist the reset state
        await persistenceProvider.saveState('counter', context.state);
        
        return { success: true };
      }
    };
    
    // Register implementation
    dsl.implementation('CounterActorImpl', {
      targetComponent: 'CounterActor',
      description: 'Counter actor implementation',
      version: '1.0.0',
      handlers: counterActorImpl
    });
    
    // Create context for actor
    const counterContext: ActorContext = {
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      state: undefined
    };
    
    // Test initial state
    const initialCount = await counterActorImpl.getCount({}, counterContext);
    expect(initialCount).toBe(0);
    
    // Test incrementing
    const result1 = await counterActorImpl.increment({ amount: 5 }, counterContext);
    expect(result1.newCount).toBe(5);
    
    const result2 = await counterActorImpl.increment({ amount: 3 }, counterContext);
    expect(result2.newCount).toBe(8);
    
    // Verify state was persisted
    expect(persistenceProvider.saveState).toHaveBeenCalledTimes(2);
    expect(persistedState.counter.count).toBe(8);
    
    // Simulate actor restart by creating a new context
    const newContext: ActorContext = {
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      state: undefined
    };
    
    // Test state recovery after restart
    const recoveredCount = await counterActorImpl.getCount({}, newContext);
    expect(recoveredCount).toBe(8);
    
    // Verify state was loaded
    expect(persistenceProvider.loadState).toHaveBeenCalledWith('counter');
    
    // Reset the counter
    await counterActorImpl.reset({}, newContext);
    expect(await counterActorImpl.getCount({}, newContext)).toBe(0);
    
    // Verify events
    expect(persistenceEvents).toHaveLength(4); // 2 saves + 1 load + 1 final save
    expect(persistenceEvents[0].operation).toBe('save');
    expect(persistenceEvents[1].operation).toBe('save');
    expect(persistenceEvents[2].operation).toBe('load');
    expect(persistenceEvents[3].operation).toBe('save');
  });
  
  it('should handle state snapshots and versioning', async () => {
    // Define actor with versioned state
    dsl.component('DocumentActor', {
      type: ComponentType.ACTOR,
      description: 'Actor managing a document with versions',
      version: '1.0.0',
      messageHandlers: {
        updateDocument: {
          input: {
            properties: {
              content: { type: 'string' }
            },
            required: ['content']
          },
          output: { type: 'object' }
        },
        getDocument: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        createSnapshot: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        rollbackToVersion: {
          input: {
            properties: {
              version: { type: 'number' }
            },
            required: ['version']
          },
          output: { type: 'object' }
        }
      },
      attributes: {
        stateful: true,
        persistenceId: 'document',
        snapshotFrequency: 5 // Create snapshot every 5 updates
      }
    });
    
    // Define system
    const system = dsl.system('DocumentSystem', {
      description: 'System for document versioning',
      version: '1.0.0',
      components: {
        actors: [{ ref: 'DocumentActor' }]
      }
    });
    
    // Mock snapshots
    const snapshots: Record<string, any[]> = { document: [] };
    
    // Mock enhanced persistence provider with snapshots
    const persistenceProvider = {
      saveState: vi.fn().mockImplementation((actorId: string, state: any) => {
        persistedState[actorId] = JSON.parse(JSON.stringify(state));
        persistenceEvents.push({ 
          actorId, 
          operation: 'save',
          state: JSON.parse(JSON.stringify(state))
        });
        return Promise.resolve({ success: true });
      }),
      
      loadState: vi.fn().mockImplementation((actorId: string) => {
        const state = persistedState[actorId];
        if (state) {
          persistenceEvents.push({ 
            actorId, 
            operation: 'load',
            state: JSON.parse(JSON.stringify(state))
          });
        }
        return Promise.resolve(state ? JSON.parse(JSON.stringify(state)) : null);
      }),
      
      createSnapshot: vi.fn().mockImplementation((actorId: string, state: any) => {
        if (!snapshots[actorId]) {
          snapshots[actorId] = [];
        }
        
        const snapshot = JSON.parse(JSON.stringify({
          ...state,
          _snapshotTime: Date.now()
        }));
        
        snapshots[actorId].push(snapshot);
        
        persistenceEvents.push({
          actorId,
          operation: 'snapshot',
          state: snapshot
        });
        
        return Promise.resolve({ success: true, version: snapshots[actorId].length });
      }),
      
      getSnapshot: vi.fn().mockImplementation((actorId: string, version: number) => {
        if (!snapshots[actorId] || version < 1 || version > snapshots[actorId].length) {
          return Promise.resolve(null);
        }
        
        const snapshot = snapshots[actorId][version - 1];
        
        persistenceEvents.push({
          actorId,
          operation: 'recover',
          state: JSON.parse(JSON.stringify(snapshot))
        });
        
        return Promise.resolve(JSON.parse(JSON.stringify(snapshot)));
      }),
      
      getLatestSnapshot: vi.fn().mockImplementation((actorId: string) => {
        if (!snapshots[actorId] || snapshots[actorId].length === 0) {
          return Promise.resolve(null);
        }
        
        const snapshot = snapshots[actorId][snapshots[actorId].length - 1];
        
        persistenceEvents.push({
          actorId,
          operation: 'recover',
          state: JSON.parse(JSON.stringify(snapshot))
        });
        
        return Promise.resolve(JSON.parse(JSON.stringify(snapshot)));
      })
    };
    
    // Implementation
    const documentActorImpl = {
      // State initialization with snapshot recovery
      initializeState: async (context: ActorContext) => {
        // Try to load from the latest snapshot first
        const persistenceId = 'document';
        const latestSnapshot = await persistenceProvider.getLatestSnapshot(persistenceId);
        
        if (latestSnapshot) {
          // Use snapshot
          context.state = latestSnapshot;
        } else {
          // Try regular state
          const loadedState = await persistenceProvider.loadState(persistenceId);
          
          if (loadedState) {
            context.state = loadedState;
          } else {
            // Initialize with default state
            context.state = {
              content: '',
              version: 0,
              updateCount: 0,
              history: [],
              lastUpdated: Date.now()
            };
          }
        }
        
        return { initialized: true };
      },
      
      // Message handlers
      updateDocument: async (input: any, context: ActorContext) => {
        if (!context.state) {
          await documentActorImpl.initializeState(context);
        }
        
        // Store previous state in history
        context.state.history = context.state.history || [];
        context.state.history.push({
          content: context.state.content,
          version: context.state.version,
          timestamp: context.state.lastUpdated
        });
        
        // Update the document
        context.state.content = input.content;
        context.state.version += 1;
        context.state.updateCount += 1;
        context.state.lastUpdated = Date.now();
        
        // Persist the state
        await persistenceProvider.saveState('document', context.state);
        
        // Create snapshot if needed
        if (context.state.updateCount % 5 === 0) {
          const snapshotResult = await persistenceProvider.createSnapshot('document', context.state);
          return {
            success: true,
            version: context.state.version,
            snapshotCreated: true,
            snapshotVersion: snapshotResult.version
          };
        }
        
        return {
          success: true,
          version: context.state.version,
          snapshotCreated: false
        };
      },
      
      getDocument: async (input: any, context: ActorContext) => {
        if (!context.state) {
          await documentActorImpl.initializeState(context);
        }
        
        return {
          content: context.state.content,
          version: context.state.version,
          lastUpdated: context.state.lastUpdated
        };
      },
      
      createSnapshot: async (input: any, context: ActorContext) => {
        if (!context.state) {
          await documentActorImpl.initializeState(context);
        }
        
        const snapshotResult = await persistenceProvider.createSnapshot('document', context.state);
        
        return {
          success: true,
          snapshotVersion: snapshotResult.version
        };
      },
      
      rollbackToVersion: async (input: any, context: ActorContext) => {
        const { version } = input;
        
        if (!context.state) {
          await documentActorImpl.initializeState(context);
        }
        
        // Find matching version in history
        const historyEntry = context.state.history.find((entry: any) => entry.version === version);
        
        if (historyEntry) {
          // Create a snapshot before rolling back (for safety)
          await persistenceProvider.createSnapshot('document', context.state);
          
          // Roll back to the historical version
          context.state.content = historyEntry.content;
          context.state.lastUpdated = Date.now();
          context.state.version += 1; // Still create a new version
          context.state.updateCount += 1;
          
          // Truncate history to remove entries after the rollback point
          context.state.history = context.state.history.filter(
            (entry: any) => entry.version <= version
          );
          
          // Add the pre-rollback state to history
          context.state.history.push({
            content: context.state.content,
            version: context.state.version - 1,
            timestamp: historyEntry.timestamp,
            isRollbackPoint: true
          });
          
          // Persist the rolled-back state
          await persistenceProvider.saveState('document', context.state);
          
          return {
            success: true,
            rolledBackToVersion: version,
            newVersion: context.state.version
          };
        }
        
        // Try to find in snapshots if not in history
        const snapshot = await persistenceProvider.getSnapshot('document', version);
        
        if (snapshot) {
          // Create a snapshot of current state before rolling back
          await persistenceProvider.createSnapshot('document', context.state);
          
          // Restore from snapshot
          context.state = {
            ...snapshot,
            version: context.state.version + 1, // Still create a new version
            updateCount: context.state.updateCount + 1,
            lastUpdated: Date.now()
          };
          
          // Persist the restored state
          await persistenceProvider.saveState('document', context.state);
          
          return {
            success: true,
            rolledBackToSnapshot: version,
            newVersion: context.state.version
          };
        }
        
        return {
          success: false,
          error: `Version ${version} not found in history or snapshots`
        };
      }
    };
    
    // Register implementation
    dsl.implementation('DocumentActorImpl', {
      targetComponent: 'DocumentActor',
      description: 'Document actor implementation',
      version: '1.0.0',
      handlers: documentActorImpl
    });
    
    // Create context for actor
    const docContext: ActorContext = {
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      state: undefined
    };
    
    // Test document updates
    await documentActorImpl.updateDocument({ content: 'Version 1 content' }, docContext);
    await documentActorImpl.updateDocument({ content: 'Version 2 content' }, docContext);
    await documentActorImpl.updateDocument({ content: 'Version 3 content' }, docContext);
    await documentActorImpl.updateDocument({ content: 'Version 4 content' }, docContext);
    
    // This should trigger snapshot creation (5th update)
    const result5 = await documentActorImpl.updateDocument({ content: 'Version 5 content' }, docContext);
    expect(result5.snapshotCreated).toBe(true);
    
    // Verify document state
    const docState = await documentActorImpl.getDocument({}, docContext);
    expect(docState.content).toBe('Version 5 content');
    expect(docState.version).toBe(5);
    
    // Verify snapshots
    expect(snapshots.document).toHaveLength(1);
    expect(snapshots.document[0].content).toBe('Version 5 content');
    expect(snapshots.document[0].version).toBe(5);
    
    // Test more updates
    await documentActorImpl.updateDocument({ content: 'Version 6 content' }, docContext);
    await documentActorImpl.updateDocument({ content: 'Version 7 content' }, docContext);
    
    // Test manual snapshot
    const snapshotResult = await documentActorImpl.createSnapshot({}, docContext);
    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshotVersion).toBe(2);
    
    // Test rollback to previous version
    const rollbackResult = await documentActorImpl.rollbackToVersion({ version: 3 }, docContext);
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBackToVersion).toBe(3);
    
    // Verify rollback worked
    const afterRollbackState = await documentActorImpl.getDocument({}, docContext);
    expect(afterRollbackState.content).toBe('Version 3 content');
    expect(afterRollbackState.version).toBe(8); // Version still increments
    
    // Create a new context to test snapshot recovery
    const newContext: ActorContext = {
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      state: undefined
    };
    
    // Get document with new context (should recover from snapshot)
    const recoveredState = await documentActorImpl.getDocument({}, newContext);
    expect(recoveredState.content).toBe('Version 3 content');
    expect(recoveredState.version).toBe(8);
    
    // Verify persistence events
    const snapshotEvents = persistenceEvents.filter(e => e.operation === 'snapshot');
    expect(snapshotEvents).toHaveLength(3); // 1 automatic + 1 manual + 1 before rollback
  });
  
  it('should handle concurrent state updates and conflicts', async () => {
    // Define actor with conflict resolution
    dsl.component('DataActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with concurrent update handling',
      version: '1.0.0',
      messageHandlers: {
        updateField: {
          input: {
            properties: {
              field: { type: 'string' },
              value: { type: 'string' },
              timestamp: { type: 'number' }
            },
            required: ['field', 'value']
          },
          output: { type: 'object' }
        },
        getData: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      },
      attributes: {
        stateful: true,
        persistenceId: 'data-actor'
      }
    });
    
    // Define system
    const system = dsl.system('ConcurrencySystem', {
      description: 'System for testing concurrency',
      version: '1.0.0',
      components: {
        actors: [{ ref: 'DataActor' }]
      }
    });
    
    // Base persistence provider with no conflict detection
    const simplePersistenceProvider = {
      saveState: vi.fn().mockImplementation((actorId: string, state: any) => {
        persistedState[actorId] = JSON.parse(JSON.stringify(state));
        return Promise.resolve({ success: true });
      }),
      
      loadState: vi.fn().mockImplementation((actorId: string) => {
        const state = persistedState[actorId];
        return Promise.resolve(state ? JSON.parse(JSON.stringify(state)) : null);
      })
    };
    
    // Track field update timestamps for conflict detection
    const fieldUpdateTimestamps: Record<string, number> = {};
    
    // Implementation with conflict resolution
    const dataActorImpl = {
      initializeState: async (context: ActorContext) => {
        // Load or initialize state
        const persistenceId = 'data-actor';
        const loadedState = await simplePersistenceProvider.loadState(persistenceId);
        
        if (loadedState) {
          context.state = loadedState;
        } else {
          context.state = { 
            fields: {},
            version: 0,
            lastUpdated: Date.now()
          };
        }
        
        return { initialized: true };
      },
      
      // Update with optimistic concurrency control
      updateField: async (input: any, context: ActorContext) => {
        const { field, value, timestamp = Date.now() } = input;
        
        if (!context.state) {
          await dataActorImpl.initializeState(context);
        }
        
        // Check for conflicts
        const lastUpdateTime = fieldUpdateTimestamps[field] || 0;
        
        // If the update timestamp is older than our last known update, it's a conflict
        if (timestamp < lastUpdateTime) {
          return {
            success: false,
            conflict: true,
            message: `Conflict detected: field '${field}' was updated at ${lastUpdateTime} which is after ${timestamp}`,
            currentValue: context.state.fields[field]
          };
        }
        
        // Update the field
        context.state.fields = context.state.fields || {};
        context.state.fields[field] = value;
        context.state.version += 1;
        context.state.lastUpdated = timestamp;
        
        // Record the update timestamp for future conflict detection
        fieldUpdateTimestamps[field] = timestamp;
        
        // Persist state
        await simplePersistenceProvider.saveState('data-actor', context.state);
        
        return {
          success: true,
          field,
          value,
          version: context.state.version
        };
      },
      
      getData: async (input: any, context: ActorContext) => {
        if (!context.state) {
          await dataActorImpl.initializeState(context);
        }
        
        return {
          fields: context.state.fields || {},
          version: context.state.version,
          lastUpdated: context.state.lastUpdated
        };
      }
    };
    
    // Register implementation
    dsl.implementation('DataActorImpl', {
      targetComponent: 'DataActor',
      description: 'Data actor implementation',
      version: '1.0.0',
      handlers: dataActorImpl
    });
    
    // Create context for actor
    const dataContext: ActorContext = {
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      state: undefined
    };
    
    // Make a first update to the name field
    const update1Time = Date.now();
    const update1 = await dataActorImpl.updateField({
      field: 'name',
      value: 'John',
      timestamp: update1Time
    }, dataContext);
    
    expect(update1.success).toBe(true);
    
    // Make a second update to the same field (this should succeed)
    const update2Time = update1Time + 1000; // 1 second later
    const update2 = await dataActorImpl.updateField({
      field: 'name',
      value: 'John Doe',
      timestamp: update2Time
    }, dataContext);
    
    expect(update2.success).toBe(true);
    
    // Try to apply an update with an older timestamp (this should fail with conflict)
    const oldUpdate = await dataActorImpl.updateField({
      field: 'name',
      value: 'Johnny',
      timestamp: update1Time - 500 // Older than the first update
    }, dataContext);
    
    expect(oldUpdate.success).toBe(false);
    expect(oldUpdate.conflict).toBe(true);
    expect(oldUpdate.currentValue).toBe('John Doe');
    
    // Update a different field (should succeed)
    const update3 = await dataActorImpl.updateField({
      field: 'email',
      value: 'john@example.com',
      timestamp: Date.now()
    }, dataContext);
    
    expect(update3.success).toBe(true);
    
    // Check final state
    const finalState = await dataActorImpl.getData({}, dataContext);
    expect(finalState.fields.name).toBe('John Doe');
    expect(finalState.fields.email).toBe('john@example.com');
  });
}); 