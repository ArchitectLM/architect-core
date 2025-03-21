import { describe, it, expect, beforeEach } from 'vitest';
import { createMockPersistenceProvider } from './actor-system-test-utils.js';

/**
 * Demonstrates how to use the mock persistence provider
 */
describe('Mock Persistence Provider', () => {
  let persistenceProvider: ReturnType<typeof createMockPersistenceProvider>;
  
  beforeEach(() => {
    persistenceProvider = createMockPersistenceProvider();
  });

  it('should save and load actor state', async () => {
    const actorId = 'test-actor-1';
    const state = {
      counter: 42,
      items: ['item1', 'item2'],
      metadata: {
        lastUpdated: Date.now()
      }
    };
    
    // Save state
    const saveResult = await persistenceProvider.saveState(actorId, state);
    expect(saveResult.success).toBe(true);
    
    // Load state
    const loadedState = await persistenceProvider.loadState(actorId);
    expect(loadedState).toBeDefined();
    expect(loadedState?.counter).toBe(42);
    expect(loadedState?.items).toEqual(['item1', 'item2']);
    expect(loadedState?.lastSaved).toBeDefined();
    
    // Verify calls
    expect(persistenceProvider.saveState).toHaveBeenCalledWith(actorId, state);
    expect(persistenceProvider.loadState).toHaveBeenCalledWith(actorId);
  });

  it('should handle snapshots correctly', async () => {
    const actorId = 'stateful-actor';
    
    // Create initial state
    const initialState = { counter: 0, version: 1 };
    await persistenceProvider.saveState(actorId, initialState);
    
    // Create a snapshot
    const snapshotResult = await persistenceProvider.createSnapshot(actorId, initialState);
    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshotId).toBeDefined();
    
    // Update state
    const updatedState = { counter: 5, version: 2 };
    await persistenceProvider.saveState(actorId, updatedState);
    
    // Get current state (should be updated)
    const currentState = await persistenceProvider.loadState(actorId);
    expect(currentState?.counter).toBe(5);
    expect(currentState?.version).toBe(2);
    
    // Restore the snapshot
    const restoreResult = await persistenceProvider.restoreSnapshot(
      actorId, 
      snapshotResult.snapshotId
    );
    expect(restoreResult.success).toBe(true);
    
    // Verify state was restored
    const restoredState = await persistenceProvider.loadState(actorId);
    expect(restoredState?.counter).toBe(0);
    expect(restoredState?.version).toBe(1);
    expect(restoredState?.restoredAt).toBeDefined();
  });

  it('should handle multiple snapshots for the same actor', async () => {
    const actorId = 'versioned-actor';
    
    // Create snapshots for different versions
    const v1State = { data: 'v1', version: 1 };
    const v2State = { data: 'v2', version: 2 };
    const v3State = { data: 'v3', version: 3 };
    
    // Create snapshots
    const v1Result = await persistenceProvider.createSnapshot(actorId, v1State);
    const v2Result = await persistenceProvider.createSnapshot(actorId, v2State);
    const v3Result = await persistenceProvider.createSnapshot(actorId, v3State);
    
    // Set current state to v3
    await persistenceProvider.saveState(actorId, v3State);
    
    // Get all snapshots
    const snapshots = await persistenceProvider.getSnapshots(actorId);
    expect(snapshots.length).toBe(3);
    
    // Restore v1
    await persistenceProvider.restoreSnapshot(actorId, v1Result.snapshotId);
    const restoredV1 = await persistenceProvider.loadState(actorId);
    expect(restoredV1?.data).toBe('v1');
    
    // Restore v2
    await persistenceProvider.restoreSnapshot(actorId, v2Result.snapshotId);
    const restoredV2 = await persistenceProvider.loadState(actorId);
    expect(restoredV2?.data).toBe('v2');
    
    // Restore v3
    await persistenceProvider.restoreSnapshot(actorId, v3Result.snapshotId);
    const restoredV3 = await persistenceProvider.loadState(actorId);
    expect(restoredV3?.data).toBe('v3');
  });

  it('should handle error cases gracefully', async () => {
    // Try to load non-existent actor
    const nonExistentState = await persistenceProvider.loadState('non-existent');
    expect(nonExistentState).toBeNull();
    
    // Try to restore non-existent snapshot
    const badRestoreResult = await persistenceProvider.restoreSnapshot(
      'non-existent',
      'bad-snapshot-id'
    );
    expect(badRestoreResult.success).toBe(false);
    expect(badRestoreResult.error).toBe('No snapshots found');
    
    // Create an actor but try to restore a non-existent snapshot
    await persistenceProvider.saveState('exists', { test: true });
    const badSnapshotResult = await persistenceProvider.restoreSnapshot(
      'exists',
      'bad-snapshot-id'
    );
    expect(badSnapshotResult.success).toBe(false);
    expect(badSnapshotResult.error).toBe('Snapshot not found');
  });

  it('should provide helper methods for test inspection', async () => {
    // Create some test data
    await persistenceProvider.saveState('actor1', { name: 'Actor 1' });
    await persistenceProvider.saveState('actor2', { name: 'Actor 2' });
    
    await persistenceProvider.createSnapshot('actor1', { name: 'Actor 1', version: 1 });
    await persistenceProvider.createSnapshot('actor1', { name: 'Actor 1', version: 2 });
    
    // Use helper methods to inspect state
    const allStates = persistenceProvider.getAllStates();
    expect(Object.keys(allStates).length).toBe(2);
    expect(allStates.actor1.name).toBe('Actor 1');
    expect(allStates.actor2.name).toBe('Actor 2');
    
    // Use helper methods to inspect snapshots
    const allSnapshots = persistenceProvider.getAllSnapshots();
    expect(Object.keys(allSnapshots).length).toBe(1);
    expect(allSnapshots.actor1.length).toBe(2);
    expect(allSnapshots.actor1[0].state.version).toBe(1);
    expect(allSnapshots.actor1[1].state.version).toBe(2);
  });
}); 