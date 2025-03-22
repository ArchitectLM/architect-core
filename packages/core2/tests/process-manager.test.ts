import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleProcessManager } from '../src/implementations/process-manager';
import { SimpleProcessRegistry } from '../src/implementations/process-registry';
import { ProcessDefinition, ProcessRegistry } from '../src/models/process-system';
import { TaskExecutor } from '../src/models/task-system';

describe('SimpleProcessManager', () => {
  let processManager: SimpleProcessManager;
  let processRegistry: ProcessRegistry;
  let mockTaskExecutor: TaskExecutor;
  
  const testProcessDefinition: ProcessDefinition<'created' | 'running' | 'completed'> = {
    id: 'test-process',
    name: 'Test Process',
    description: 'A test process definition',
    initialState: 'created',
    transitions: [
      { from: 'created', to: 'running', on: 'start' },
      { from: 'running', to: 'completed', on: 'complete' }
    ],
    version: '1.0.0'
  };
  
  beforeEach(() => {
    // Setup process registry
    processRegistry = new SimpleProcessRegistry();
    processRegistry.registerProcess(testProcessDefinition);
    
    // Mock task executor
    mockTaskExecutor = {
      executeTask: vi.fn().mockResolvedValue({ 
        success: true, 
        value: { id: 'task-1', status: 'completed' } 
      })
    } as unknown as TaskExecutor;
    
    // Create process manager
    processManager = new SimpleProcessManager(processRegistry, mockTaskExecutor);
  });
  
  describe('Process Creation', () => {
    it('should create a process instance', async () => {
      const processData = { key: 'value' };
      const result = await processManager.createProcess(testProcessDefinition.name, processData);
      
      expect(result.success).toBe(true);
      
      if (result.success) {
        const process = result.value;
        expect(process.id).toBeDefined();
        expect(process.type).toBe(testProcessDefinition.name);
        expect(process.state).toBe('created');
        expect(process.data).toEqual(processData);
        expect(process.createdAt).toBeDefined();
        expect(process.updatedAt).toBeDefined();
        expect(process.version).toBe('1.0.0');
      }
    });
    
    it('should create a process with a specific version', async () => {
      const processData = { key: 'value' };
      const result = await processManager.createProcess(
        testProcessDefinition.name, 
        processData, 
        { version: '1.0.0' }
      );
      
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.value.version).toBe('1.0.0');
      }
    });
    
    it('should fail to create a process with unknown type', async () => {
      const result = await processManager.createProcess('unknown-process', {});
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
    
    it('should fail to create a process with unknown version', async () => {
      const result = await processManager.createProcess(
        testProcessDefinition.name, 
        {}, 
        { version: '99.0.0' }
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });
  
  describe('Process Retrieval', () => {
    it('should retrieve a process by ID', async () => {
      // Create a process first
      const createResult = await processManager.createProcess(testProcessDefinition.name, { key: 'value' });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const processId = createResult.value.id;
      
      // Then retrieve it
      const getResult = await processManager.getProcess(processId);
      
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.value.id).toBe(processId);
        expect(getResult.value.type).toBe(testProcessDefinition.name);
      }
    });
    
    it('should fail to retrieve an unknown process', async () => {
      const result = await processManager.getProcess('unknown-id');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });
  
  describe('Process State Transitions', () => {
    it('should apply a valid transition', async () => {
      // Create a process first
      const createResult = await processManager.createProcess(testProcessDefinition.name, { key: 'value' });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const processId = createResult.value.id;
      
      // Apply a transition
      const transitionResult = await processManager.applyEvent(
        processId, 
        'start', 
        { data: 'start-data' }
      );
      
      expect(transitionResult.success).toBe(true);
      if (transitionResult.success) {
        expect(transitionResult.value.state).toBe('running');
        expect(transitionResult.value.metadata?.lastTransition).toBeDefined();
        if (transitionResult.value.metadata?.lastTransition) {
          const transition = transitionResult.value.metadata.lastTransition as any;
          expect(transition.from).toBe('created');
          expect(transition.to).toBe('running');
          expect(transition.event).toBe('start');
        }
      }
    });
    
    it('should fail to apply an invalid transition', async () => {
      // Create a process first
      const createResult = await processManager.createProcess(testProcessDefinition.name, { key: 'value' });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const processId = createResult.value.id;
      
      // Try to apply an invalid transition
      const transitionResult = await processManager.applyEvent(
        processId, 
        'complete', // From 'created' straight to 'completed' is invalid
        {}
      );
      
      expect(transitionResult.success).toBe(false);
      if (!transitionResult.success) {
        expect(transitionResult.error.message).toContain('No transition found');
      }
    });
    
    it('should apply multiple transitions in sequence', async () => {
      // Create a process first
      const createResult = await processManager.createProcess(testProcessDefinition.name, { key: 'value' });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const processId = createResult.value.id;
      
      // Apply first transition (created -> running)
      const firstTransition = await processManager.applyEvent(processId, 'start', {});
      expect(firstTransition.success).toBe(true);
      if (!firstTransition.success) return;
      
      // Apply second transition (running -> completed)
      const secondTransition = await processManager.applyEvent(processId, 'complete', {});
      
      expect(secondTransition.success).toBe(true);
      if (secondTransition.success) {
        expect(secondTransition.value.state).toBe('completed');
      }
    });
  });
  
  describe('Process Checkpoints', () => {
    it('should save a process checkpoint', async () => {
      // Create a process first
      const createResult = await processManager.createProcess(testProcessDefinition.name, { key: 'value' });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const processId = createResult.value.id;
      
      // Save a checkpoint
      const checkpointResult = await processManager.saveCheckpoint(processId);
      
      expect(checkpointResult.success).toBe(true);
      if (checkpointResult.success) {
        expect(checkpointResult.value.id).toBeDefined();
        expect(checkpointResult.value.processId).toBe(processId);
        expect(checkpointResult.value.state).toBe('created');
        expect(checkpointResult.value.data).toEqual({ key: 'value' });
      }
    });
    
    it('should restore a process from a checkpoint', async () => {
      // Create a process first
      const createResult = await processManager.createProcess(testProcessDefinition.name, { key: 'value' });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const processId = createResult.value.id;
      
      // Transition to running
      await processManager.applyEvent(processId, 'start', {});
      
      // Save a checkpoint
      const checkpointResult = await processManager.saveCheckpoint(processId);
      expect(checkpointResult.success).toBe(true);
      if (!checkpointResult.success) return;
      
      const checkpointId = checkpointResult.value.id;
      
      // Transition to completed
      await processManager.applyEvent(processId, 'complete', {});
      
      // Verify process is in completed state
      const process = await processManager.getProcess(processId);
      expect(process.success).toBe(true);
      if (!process.success) return;
      expect(process.value.state).toBe('completed');
      
      // Restore from checkpoint (should go back to running)
      const restoreResult = await processManager.restoreFromCheckpoint(processId, checkpointId);
      
      expect(restoreResult.success).toBe(true);
      if (restoreResult.success) {
        expect(restoreResult.value.id).toBe(processId);
        expect(restoreResult.value.state).toBe('running');
        expect(restoreResult.value.metadata?.restoredFrom).toBe(checkpointId);
      }
    });
    
    it('should fail to restore from a non-existent checkpoint', async () => {
      // Create a process first
      const createResult = await processManager.createProcess(testProcessDefinition.name, { key: 'value' });
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;
      
      const processId = createResult.value.id;
      
      // Try to restore from a non-existent checkpoint
      const restoreResult = await processManager.restoreFromCheckpoint(processId, 'non-existent-checkpoint');
      
      expect(restoreResult.success).toBe(false);
      if (!restoreResult.success) {
        expect(restoreResult.error.message).toContain('not found');
      }
    });
  });
}); 