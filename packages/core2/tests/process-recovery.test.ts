import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from '../src/implementations/factory';
import { ProcessDefinition } from '../src/models/process-system';
import { TaskDefinition } from '../src/models/task-system';
import { InMemoryProcessRegistry } from '../src/implementations/process-registry';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { InMemoryProcessManager } from '../src/implementations/process-manager';
import { createExtensionSystem } from '../src/implementations/extension-system';
import { createInMemoryEventBus } from '../src/implementations/event-bus';
import { v4 as uuidv4 } from 'uuid';

describe('Process Versioning and Recovery', () => {
  // Define process versions for testing
  const processV1: ProcessDefinition = {
    type: 'order-process-v1',
    name: 'Order Process V1',
    description: 'Order processing workflow v1',
    version: '1.0.0',
    initialState: 'created',
    states: ['created', 'approved', 'fulfilled', 'cancelled'],
    finalStates: ['fulfilled', 'cancelled'],
    transitions: [
      { from: 'created', to: 'approved', event: 'approve' },
      { from: 'approved', to: 'fulfilled', event: 'fulfill' },
      { from: 'created', to: 'cancelled', event: 'cancel' },
      { from: 'approved', to: 'cancelled', event: 'cancel' }
    ]
  };

  const processV2: ProcessDefinition = {
    type: 'order-process-v2',
    name: 'Order Process V2',
    description: 'Order processing workflow v2 with payment step',
    version: '2.0.0',
    initialState: 'created',
    states: ['created', 'payment-pending', 'approved', 'fulfilled', 'cancelled'],
    finalStates: ['fulfilled', 'cancelled'],
    transitions: [
      { from: 'created', to: 'payment-pending', event: 'request-payment' },
      { from: 'payment-pending', to: 'approved', event: 'approve' },
      { from: 'approved', to: 'fulfilled', event: 'fulfill' },
      { from: 'created', to: 'cancelled', event: 'cancel' },
      { from: 'payment-pending', to: 'cancelled', event: 'cancel' },
      { from: 'approved', to: 'cancelled', event: 'cancel' }
    ]
  };

  // Mock checkpoint tasks
  const saveCheckpointTask: TaskDefinition<{ processId: string }, string> = {
    type: 'save-checkpoint',
    handler: async (input) => {
      return input.processId;
    }
  };

  const restoreCheckpointTask: TaskDefinition<{ processId: string; checkpointId: string }, boolean> = {
    type: 'restore-checkpoint',
    handler: async (input) => {
      return true;
    }
  };

  let runtime: any;
  let processRegistry: InMemoryProcessRegistry;
  let taskRegistry: InMemoryTaskRegistry;
  let taskExecutor: InMemoryTaskExecutor;
  let processManager: InMemoryProcessManager;
  let eventBus: any;

  beforeEach(async () => {
    // Create extension system
    const extensionSystem = createExtensionSystem();
    
    // Create event bus
    eventBus = createInMemoryEventBus(extensionSystem);
    
    // Create registries
    taskRegistry = new InMemoryTaskRegistry();
    processRegistry = new InMemoryProcessRegistry();
    
    // Create task executor
    taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
    
    // Create process manager
    processManager = new InMemoryProcessManager(processRegistry, taskExecutor);
    
    // Create runtime with explicitly provided components
    runtime = createRuntime({
      runtimeOptions: {
        version: '1.0.0',
        namespace: `test-runtime-${uuidv4()}`,
        metadata: {
          name: 'Process Recovery Test Runtime',
          testing: true
        }
      },
      components: {
        extensionSystem,
        eventBus,
        taskRegistry,
        taskExecutor,
        processRegistry,
        processManager
      }
    });

    // Register process definitions
    try {
      const processResult1 = processRegistry.registerProcess(processV1);
      const processResult2 = processRegistry.registerProcess(processV2);
      console.log('Process registration results:', processResult1.success);
    } catch (error) {
      console.error('Error registering processes:', error);
    }
    
    // Register task definitions
    try {
      taskRegistry.registerTask(saveCheckpointTask);
      taskRegistry.registerTask(restoreCheckpointTask);
      console.log('Tasks registered successfully');
    } catch (error) {
      console.error('Error registering tasks:', error);
    }
  });

  describe('Process Versioning', () => {
    it('should create processes with specific versions', async () => {
      // Create v1 process
      try {
        const processV1Result = await processManager.createProcess(
          'order-process-v1', 
          { orderId: '123' }, 
          { version: '1.0.0' }
        );
        
        console.log('Process V1 result:', processV1Result);
        
        if (processV1Result.success && processV1Result.value) {
          expect(processV1Result.success).toBe(true);
          expect(processV1Result.value.version).toBe('1.0.0');
          expect(processV1Result.value.state).toBe('created');
        } else {
          console.error('Process V1 creation failed:', processV1Result.error);
          expect(processV1Result.success).toBe(true);
        }

        // Create v2 process
        const processV2Result = await processManager.createProcess(
          'order-process-v2', 
          { orderId: '456' }, 
          { version: '2.0.0' }
        );
        
        console.log('Process V2 result:', processV2Result);
        
        if (processV2Result.success && processV2Result.value) {
          expect(processV2Result.success).toBe(true);
          expect(processV2Result.value.version).toBe('2.0.0');
          expect(processV2Result.value.state).toBe('created');
        } else {
          console.error('Process V2 creation failed:', processV2Result.error);
          expect(processV2Result.success).toBe(true);
        }
      } catch (error) {
        console.error('Test error:', error);
        throw error;
      }
    });

    it('should follow different transition paths based on version', async () => {
      // Create v1 process
      const processV1Result = await processManager.createProcess(
        'order-process-v1', 
        { orderId: '123' }, 
        { version: '1.0.0' }
      );
      
      // Approve v1 directly
      const approveV1Result = await processManager.applyEvent(
        processV1Result.value.id,
        'approve',
        { approvedBy: 'test' }
      );
      
      expect(approveV1Result.success).toBe(true);
      expect(approveV1Result.value.state).toBe('approved');

      // Create v2 process
      const processV2Result = await processManager.createProcess(
        'order-process-v2', 
        { orderId: '456' }, 
        { version: '2.0.0' }
      );
      
      // Request payment in v2 (new state in v2)
      const paymentResult = await processManager.applyEvent(
        processV2Result.value.id,
        'request-payment',
        { amount: 100 }
      );
      
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.value.state).toBe('payment-pending');
    });
  });

  describe('Process Recovery', () => {
    it('should save process checkpoints', async () => {
      // Create a process
      const processResult = await processManager.createProcess(
        'order-process-v1', 
        { orderId: '123', items: ['item1'] }
      );
      
      expect(processResult.success).toBe(true);
      const processId = processResult.value.id;
      
      // Advance the process
      const approveResult = await processManager.applyEvent(
        processId,
        'approve',
        { approvedBy: 'test' }
      );
      
      expect(approveResult.success).toBe(true);
      expect(approveResult.value.state).toBe('approved');
      
      // Save a checkpoint
      const checkpointResult = await processManager.saveCheckpoint(processId);
      
      expect(checkpointResult.success).toBe(true);
      expect(checkpointResult.value.processId).toBe(processId);
      expect(checkpointResult.value.state).toBe('approved');
      expect(checkpointResult.value.data.orderId).toBe('123');
      expect(checkpointResult.value.data.items).toEqual(['item1']);
    });

    it('should restore processes from checkpoints', async () => {
      // Create and advance a process with some data
      const processResult = await processManager.createProcess(
        'order-process-v1', 
        { orderId: '123', items: ['item1'] }
      );
      
      const processId = processResult.value.id;
      
      // Advance to approved
      await processManager.applyEvent(
        processId,
        'approve',
        { approvedBy: 'test' }
      );
      
      // Save checkpoint in approved state
      const checkpointResult = await processManager.saveCheckpoint(processId);
      const checkpointId = checkpointResult.value.id;
      
      console.log('Checkpoint created:', checkpointId, checkpointResult.success);
      
      // Make more changes (fulfill the order)
      await processManager.applyEvent(
        processId,
        'fulfill',
        { shippedBy: 'shipping-dept' }
      );
      
      // Verify process is in fulfilled state
      const currentProcess = await processManager.getProcess(processId);
      expect(currentProcess.value.state).toBe('fulfilled');
      
      // Restore from checkpoint (should go back to approved state)
      const restoreResult = await processManager.restoreFromCheckpoint(processId, checkpointId);
      
      console.log('Restore result:', restoreResult);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.value.id).toBe(processId);
      expect(restoreResult.value.state).toBe('approved');
      expect(restoreResult.value.data.orderId).toBe('123');
      expect(restoreResult.value.data.items).toEqual(['item1']);
    });

    it('should fail when restoring a non-existent checkpoint', async () => {
      // Create a process
      const processResult = await processManager.createProcess(
        'order-process-v1', 
        { orderId: '123' }
      );
      
      // Try to restore from non-existent checkpoint
      const restoreResult = await processManager.restoreFromCheckpoint(processResult.value.id, 'non-existent-id');
      
      expect(restoreResult.success).toBe(false);
      expect(restoreResult.error).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should recover a process to the last valid state after error', async () => {
      // Create a process
      const processResult = await processManager.createProcess(
        'order-process-v1', 
        { orderId: '123' }, 
        { version: '1.0.0' }
      );
      
      const processId = processResult.value.id;
      
      // Save a checkpoint in initial state
      const initialCheckpointResult = await processManager.saveCheckpoint(processId);
      const initialCheckpointId = initialCheckpointResult.value.id;
      
      // Advance to approved state
      await processManager.applyEvent(
        processId,
        'approve',
        { approvedBy: 'test' }
      );
      
      // Save a checkpoint in approved state
      const approvedCheckpointResult = await processManager.saveCheckpoint(processId);
      const approvedCheckpointId = approvedCheckpointResult.value.id;
      
      // Try to apply an invalid event - should fail
      const invalidResult = await processManager.applyEvent(
        processId,
        'invalid-event',
        { data: 'bad data' }
      );
      
      expect(invalidResult.success).toBe(false);
      
      // Process should still be in approved state
      const currentProcess = await processManager.getProcess(processId);
      expect(currentProcess.value.state).toBe('approved');
      
      // Restore from initial checkpoint
      const restoreResult = await processManager.restoreFromCheckpoint(processId, initialCheckpointId);
      
      console.log('Restore result:', restoreResult);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.value.state).toBe('created');
    });
  });
}); 