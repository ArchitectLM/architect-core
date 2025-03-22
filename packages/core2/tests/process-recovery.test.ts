import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime, ProcessDefinition, TaskDefinition, ProcessInstance, Event, ReactiveRuntime, ExtensionSystemImpl, EventBusImpl, InMemoryEventStorage } from '../src/index';

describe('Process Versioning and Recovery', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;
  
  // Define process versions
  const processV1: ProcessDefinition = {
    id: 'order-process',
    name: 'Order Process V1',
    description: 'Order processing workflow v1',
    initialState: 'created',
    version: '1.0',
    transitions: [
      { from: 'created', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' },
      { from: '*', to: 'cancelled', on: 'CANCEL' }
    ]
  };
  
  const processV2: ProcessDefinition = {
    id: 'order-process',
    name: 'Order Process V2',
    description: 'Order processing workflow v2 with payment step',
    initialState: 'created',
    version: '2.0',
    transitions: [
      { from: 'created', to: 'payment', on: 'START' },
      { from: 'payment', to: 'processing', on: 'PAYMENT_COMPLETED' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' },
      { from: '*', to: 'cancelled', on: 'CANCEL' },
      { from: 'payment', to: 'payment_failed', on: 'PAYMENT_FAILED' }
    ]
  };

  // Add a mock checkpoint task
  const saveCheckpointTask: TaskDefinition = {
    id: 'save-checkpoint',
    name: 'Save Process Checkpoint',
    description: 'Saves a checkpoint of the current process state',
    handler: async (context) => {
      return runtime.saveProcessCheckpoint(context.processId, context.checkpointId);
    }
  };
  
  const restoreCheckpointTask: TaskDefinition = {
    id: 'restore-checkpoint',
    name: 'Restore Process Checkpoint',
    description: 'Restores a process from a checkpoint',
    handler: async (context) => {
      return runtime.restoreProcessFromCheckpoint(context.processId, context.checkpointId);
    }
  };

  beforeEach(() => {
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();
    
    runtime = new ReactiveRuntime({
      [processV1.id]: processV1,
      [processV2.id]: processV2
    }, {
      [saveCheckpointTask.id]: saveCheckpointTask,
      [restoreCheckpointTask.id]: restoreCheckpointTask
    }, {
      extensionSystem,
      eventBus,
      eventStorage
    });
  });

  describe('Process Versioning', () => {
    it('should create processes with specific versions', async () => {
      // Create v1 process
      const processV1Instance = await runtime.createProcess('order-process', { orderId: '123' }, { version: '1.0' });
      
      // Create v2 process
      const processV2Instance = await runtime.createProcess('order-process', { orderId: '456' }, { version: '2.0' });
      
      // Verify versions
      expect(processV1Instance.version).toBe('1.0');
      expect(processV2Instance.version).toBe('2.0');
    });

    it('should use the definition version if not specified', async () => {
      // Create process without specifying version
      const process = await runtime.createProcess('order-process', { orderId: '123' });
      
      // Should default to the definition version
      expect(process.version).toBe(processV1.version);
    });

    it('should follow different transition paths based on version', async () => {
      // Create v1 process
      const processV1Instance = await runtime.createProcess('order-process', { orderId: '123' }, { version: '1.0' });
      
      // Create v2 process
      const processV2Instance = await runtime.createProcess('order-process', { orderId: '456' }, { version: '2.0' });
      
      // Transition v1 process
      const v1After = await runtime.transitionProcess(processV1Instance.id, 'START');
      expect(v1After.state).toBe('processing');
      
      // Transition v2 process
      const v2After = await runtime.transitionProcess(processV2Instance.id, 'START');
      expect(v2After.state).toBe('payment');
    });
  });

  describe('Process Recovery', () => {
    it('should save process checkpoints', async () => {
      // Create a process
      const process = await runtime.createProcess('order-process', { orderId: '123', items: ['item1'] });
      
      // Transition to a different state
      await runtime.transitionProcess(process.id, 'START');
      
      // Save checkpoint
      const checkpointId = 'checkpoint-1';
      const checkpointed = await runtime.saveProcessCheckpoint(process.id, checkpointId);
      
      // Verify checkpoint was saved
      expect(checkpointed.recovery).toBeDefined();
      expect(checkpointed.recovery!.checkpointId).toBe(checkpointId);
    });

    it('should restore processes from checkpoints', async () => {
      // Create and advance a process with some data
      const process = await runtime.createProcess('order-process', { orderId: '123', items: ['item1'] });
      const advanced = await runtime.transitionProcess(process.id, 'START');
      
      // Save checkpoint
      const checkpointId = 'checkpoint-1';
      await runtime.saveProcessCheckpoint(advanced.id, checkpointId);
      
      // Modify the process data after checkpoint
      advanced.data.items.push('item2');
      
      // Restore from checkpoint
      const restored = await runtime.restoreProcessFromCheckpoint(process.id, checkpointId);
      
      // Verify process state was restored
      expect(restored.state).toBe(advanced.state);
      expect(restored.recovery!.checkpointId).toBe(checkpointId);
    });

    it('should throw an error when restoring a non-existent checkpoint', async () => {
      // Create a process
      const process = await runtime.createProcess('order-process', { orderId: '123' });
      
      // Try to restore from a non-existent checkpoint
      await expect(runtime.restoreProcessFromCheckpoint(process.id, 'non-existent'))
        .rejects.toThrow('Checkpoint non-existent not found');
    });
    
    it('should emit events for checkpoint operations', async () => {
      // Setup event listeners
      const checkpointEvents: Event[] = [];
      runtime.subscribe('process:checkpointed', (event: Event) => checkpointEvents.push(event));
      
      const restoreEvents: Event[] = [];
      runtime.subscribe('process:restored', (event: Event) => restoreEvents.push(event));
      
      // Create and checkpoint a process
      const process = await runtime.createProcess('order-process', { orderId: '123' });
      const checkpointId = 'checkpoint-1';
      await runtime.saveProcessCheckpoint(process.id, checkpointId);
      await runtime.restoreProcessFromCheckpoint(process.id, checkpointId);
      
      // Verify events
      expect(checkpointEvents.length).toBe(1);
      expect(checkpointEvents[0].payload.processId).toBe(process.id);
      expect(checkpointEvents[0].payload.checkpointId).toBe(checkpointId);
      
      expect(restoreEvents.length).toBe(1);
      expect(restoreEvents[0].payload.processId).toBe(process.id);
      expect(restoreEvents[0].payload.checkpointId).toBe(checkpointId);
    });
  });

  describe('Error Recovery', () => {
    it('should recover a process to the last valid state after error', async () => {
      // Create a process
      const process = await runtime.createProcess('order-process', { orderId: '123' }, { version: '2.0' });
      
      // Transition to payment state
      const paymentState = await runtime.transitionProcess(process.id, 'START');
      expect(paymentState.state).toBe('payment');
      
      // Save checkpoint
      const checkpointId = 'before-payment';
      await runtime.saveProcessCheckpoint(paymentState.id, checkpointId);
      
      // Simulate payment failure
      const paymentFailed = await runtime.transitionProcess(paymentState.id, 'PAYMENT_FAILED');
      expect(paymentFailed.state).toBe('payment_failed');
      
      // Recover to before payment
      const recovered = await runtime.restoreProcessFromCheckpoint(process.id, checkpointId);
      expect(recovered.state).toBe('payment');
      
      // Can now retry payment
      const paymentSucceeded = await runtime.transitionProcess(recovered.id, 'PAYMENT_COMPLETED');
      expect(paymentSucceeded.state).toBe('processing');
    });
  });
}); 