import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRuntime } from '../../src/implementations/factory';
import { createProcessDefinition } from '../helpers/process-testing-utils';
import { v4 as uuidv4 } from 'uuid';
import { ProcessManager, ProcessRegistry } from '../../src/models/process-system';
import { Result } from '../../src/models/core-types';
import { InMemoryProcessRegistry } from '../../src/implementations/process-registry';
import { InMemoryProcessManager } from '../../src/implementations/process-manager';
import { TaskExecutor } from '../../src/models/task-system';

describe('Process Checkpoint Functionality', () => {
  let processManager: ProcessManager;
  let processRegistry: ProcessRegistry;

  beforeEach(() => {
    // Create required systems manually instead of relying on the runtime
    processRegistry = new InMemoryProcessRegistry();
    
    // Create a mock task executor since we don't need its actual functionality
    const mockTaskExecutor = {
      executeTask: vi.fn().mockResolvedValue({ success: true, value: {} }),
      executeTaskWithDependencies: vi.fn(),
      cancelTask: vi.fn(),
      scheduleTask: vi.fn()
    } as unknown as TaskExecutor;
    
    // Create process manager with required dependencies
    processManager = new InMemoryProcessManager(processRegistry, mockTaskExecutor);

    // Register test process definition
    const orderProcessDefinition = createProcessDefinition({
      id: 'order-process',
      name: 'Order Process',
      description: 'Test process for orders',
      version: '1.0.0',
      states: ['created', 'approved', 'completed'] as const,
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'approved', on: 'approve' },
        { from: 'approved', to: 'completed', on: 'complete' },
      ]
    });

    // Register the process definition
    const registerResult = processRegistry.registerProcess(orderProcessDefinition);
    if (!registerResult.success) {
      throw new Error(`Failed to register process: ${registerResult.error?.message}`);
    }
  });

  it('should support checkpointing and restoration', async () => {
    // Create process with test data
    const processData = { orderId: uuidv4() };
    const createResult = await processManager.createProcess('order-process', processData);
    expect(createResult.success).toBe(true);
    
    if (!createResult.success || !createResult.value) {
      return;
    }
    
    const processId = createResult.value.id;
    
    // Transition to approved
    const approveResult = await processManager.applyEvent(processId, 'approve', {});
    expect(approveResult.success).toBe(true);
    
    if (!approveResult.success) {
      return;
    }
    
    // Save a checkpoint
    const checkpointResult = await processManager.saveCheckpoint(processId);
    expect(checkpointResult.success).toBe(true);
    
    if (!checkpointResult.success || !checkpointResult.value) {
      return;
    }
    
    const checkpointId = checkpointResult.value.id;
    
    // Transition to completed
    const completeResult = await processManager.applyEvent(processId, 'complete', {});
    expect(completeResult.success).toBe(true);
    
    // Verify we're in completed state
    let getResult = await processManager.getProcess(processId);
    expect(getResult.success).toBe(true);
    if (getResult.success && getResult.value) {
      expect(getResult.value.state).toBe('completed');
    }
    
    // Restore from checkpoint (should go back to approved)
    const restoreResult = await processManager.restoreFromCheckpoint(processId, checkpointId);
    expect(restoreResult.success).toBe(true);
    if (restoreResult.success && restoreResult.value) {
      expect(restoreResult.value.state).toBe('approved');
    }
    
    // Verify state was restored
    getResult = await processManager.getProcess(processId);
    expect(getResult.success).toBe(true);
    if (getResult.success && getResult.value) {
      expect(getResult.value.state).toBe('approved');
    }
  });

  it('should handle multiple checkpoints for the same process', async () => {
    // Create process
    const processData = { orderId: uuidv4(), items: ['item1', 'item2'] };
    const createResult = await processManager.createProcess('order-process', processData);
    expect(createResult.success).toBe(true);
    
    if (!createResult.success || !createResult.value) {
      return;
    }
    
    const processId = createResult.value.id;
    
    // Save initial checkpoint (state: created)
    const initialCheckpoint = await processManager.saveCheckpoint(processId);
    expect(initialCheckpoint.success).toBe(true);
    
    if (!initialCheckpoint.success || !initialCheckpoint.value) {
      return;
    }
    
    const initialCheckpointId = initialCheckpoint.value.id;
    
    // Transition to approved
    await processManager.applyEvent(processId, 'approve', {});
    
    // Save approved checkpoint
    const approvedCheckpoint = await processManager.saveCheckpoint(processId);
    expect(approvedCheckpoint.success).toBe(true);
    
    if (!approvedCheckpoint.success || !approvedCheckpoint.value) {
      return;
    }
    
    const approvedCheckpointId = approvedCheckpoint.value.id;
    
    // Transition to completed
    await processManager.applyEvent(processId, 'complete', {});
    
    // Verify we're in completed state
    let process = await processManager.getProcess(processId);
    expect(process.success).toBe(true);
    if (process.success && process.value) {
      expect(process.value.state).toBe('completed');
    }
    
    // Restore from initial checkpoint
    const restoreInitial = await processManager.restoreFromCheckpoint(processId, initialCheckpointId);
    expect(restoreInitial.success).toBe(true);
    
    // Verify state is back to created
    process = await processManager.getProcess(processId);
    expect(process.success).toBe(true);
    if (process.success && process.value) {
      expect(process.value.state).toBe('created');
    }
    
    // Restore from approved checkpoint
    const restoreApproved = await processManager.restoreFromCheckpoint(processId, approvedCheckpointId);
    expect(restoreApproved.success).toBe(true);
    
    // Verify state is back to approved
    process = await processManager.getProcess(processId);
    expect(process.success).toBe(true);
    if (process.success && process.value) {
      expect(process.value.state).toBe('approved');
    }
  });

  it('should fail when restoring from a non-existent checkpoint', async () => {
    // Create process
    const createResult = await processManager.createProcess('order-process', { orderId: uuidv4() });
    expect(createResult.success).toBe(true);
    
    if (!createResult.success || !createResult.value) {
      return;
    }
    
    const processId = createResult.value.id;
    
    // Try to restore from a non-existent checkpoint
    const restoreResult = await processManager.restoreFromCheckpoint(processId, 'non-existent-checkpoint-id');
    expect(restoreResult.success).toBe(false);
    
    if (!restoreResult.success && restoreResult.error) {
      expect(restoreResult.error.message).toContain('not found');
    }
  });
}); 