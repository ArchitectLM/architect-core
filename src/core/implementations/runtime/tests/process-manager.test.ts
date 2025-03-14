import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessManager } from '../process-manager';
import { ProcessDefinition, ProcessInstance, ProcessState } from '../../../models';

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  let orderProcess: ProcessDefinition;
  
  beforeEach(() => {
    // Define a process
    orderProcess = {
      id: 'order-process',
      states: [
        { name: 'created' }, 
        { name: 'processing' }, 
        { name: 'completed' }, 
        { name: 'cancelled' },
        { name: 'error' }
      ],
      initialState: 'created',
      transitions: [
        { 
          from: 'created', 
          to: 'processing', 
          on: 'START_PROCESSING' 
        },
        { 
          from: 'processing', 
          to: 'completed', 
          on: 'COMPLETE' 
        },
        { 
          from: '*', 
          to: 'cancelled', 
          on: 'CANCEL' 
        },
        {
          from: 'created',
          to: 'processing',
          on: 'CONDITIONAL_PROCESSING',
          guard: (context, event) => {
            return context.priority === 'high';
          }
        },
        {
          from: 'processing',
          to: 'completed',
          on: 'COMPLETE_WITH_ACTION',
          action: (context, event) => {
            context.completedAt = event.payload?.timestamp || new Date().toISOString();
          }
        },
        {
          from: 'processing',
          to: 'error',
          on: 'ERROR_ACTION',
          action: (context, event) => {
            throw new Error('Action error');
          }
        },
        {
          from: '*',
          to: 'error',
          on: 'ERROR_EVENT'
        }
      ]
    };
    
    // Create process manager
    processManager = new ProcessManager({
      'order-process': orderProcess
    });
  });
  
  describe('Process Creation', () => {
    it('should create a process instance with the correct initial state', () => {
      // Act
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      
      // Assert
      expect(instance).toBeDefined();
      expect(instance.id).toBeDefined();
      expect(instance.processId).toBe('order-process');
      expect(instance.state).toBe('created'); // Initial state from process definition
      expect(instance.context).toEqual(expect.objectContaining({ orderId: '12345' }));
    });
    
    it('should throw an error if process definition does not exist', () => {
      // Act & Assert
      expect(() => processManager.createProcess('non-existent', {}))
        .toThrow(/Process definition not found/);
    });
  });
  
  describe('Process Retrieval', () => {
    it('should retrieve a process instance by ID', () => {
      // Arrange
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const retrievedInstance = processManager.getProcess(instance.id);
      
      // Assert
      expect(retrievedInstance).toBeDefined();
      expect(retrievedInstance?.id).toBe(instance.id);
      expect(retrievedInstance?.processId).toBe('order-process');
      expect(retrievedInstance?.state).toBe('created');
    });
    
    it('should return null for non-existent process ID', () => {
      // Arrange
      const processManager = new ProcessManager({ 'order-process': orderProcess });
      
      // Act
      const instance = processManager.getProcess('non-existent');
      
      // Assert
      expect(instance).toBeUndefined();
    });
    
    it('should retrieve all process instances', () => {
      // Arrange
      processManager.createProcess('order-process', { orderId: '1' });
      processManager.createProcess('order-process', { orderId: '2' });
      
      // Act
      const instances = processManager.getAllProcesses();
      
      // Assert
      expect(instances.length).toBe(2);
    });
  });
  
  describe('Process Transitions', () => {
    it('should transition a process to a new state when a valid event occurs', () => {
      // Arrange
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = processManager.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert
      expect(updatedInstance.state).toBe('processing');
    });
    
    it('should not transition if the event does not match any transition', () => {
      // Arrange
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = processManager.transitionProcess(instance.id, 'INVALID_EVENT');
      
      // Assert
      expect(updatedInstance.state).toBe('created');
    });
    
    it('should support wildcard transitions from any state', () => {
      // Arrange
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = processManager.transitionProcess(instance.id, 'CANCEL');
      
      // Assert
      expect(updatedInstance.state).toBe('cancelled');
    });
    
    it('should update process context during transitions', () => {
      // Arrange
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = processManager.transitionProcess(
        instance.id, 
        'START_PROCESSING', 
        { processingId: 'proc-1' }
      );
      
      // Assert - Check that the context contains the original data and the new data
      expect(updatedInstance.context).toHaveProperty('orderId', '12345');
      expect(updatedInstance.context).toHaveProperty('processingId', 'proc-1');
    });
    
    it('should throw an error for non-existent process ID', () => {
      // Act & Assert
      expect(() => processManager.transitionProcess('non-existent', 'EVENT'))
        .toThrow(/Process instance not found/);
    });
    
    it('should respect guard conditions for transitions', () => {
      // Arrange - Create two instances with different priorities
      const highPriorityInstance = processManager.createProcess('order-process', { 
        orderId: 'high-1', 
        priority: 'high' 
      });
      
      const lowPriorityInstance = processManager.createProcess('order-process', { 
        orderId: 'low-1', 
        priority: 'low' 
      });
      
      // Act - Try to transition both instances with the conditional event
      const highPriorityUpdated = processManager.transitionProcess(
        highPriorityInstance.id, 
        'CONDITIONAL_PROCESSING'
      );
      
      const lowPriorityUpdated = processManager.transitionProcess(
        lowPriorityInstance.id, 
        'CONDITIONAL_PROCESSING'
      );
      
      // Assert - High priority should transition, low priority should not
      expect(highPriorityUpdated.state).toBe('processing');
      expect(lowPriorityUpdated.state).toBe('created');
    });
    
    it('should execute transition actions', () => {
      // Arrange - Create and transition to processing state
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      const processingInstance = processManager.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Act - Complete with action that updates the context
      const timestamp = '2023-01-01T12:00:00Z';
      const completedInstance = processManager.transitionProcess(
        processingInstance.id, 
        'COMPLETE_WITH_ACTION',
        { timestamp }
      );
      
      // Assert - Check that the action updated the context
      expect(completedInstance.state).toBe('completed');
      expect(completedInstance.context).toHaveProperty('completedAt', timestamp);
    });
    
    it('should handle errors in transition actions gracefully', () => {
      // Arrange
      const processManager = new ProcessManager({ 'order-process': orderProcess });
      const instance = processManager.createProcess('order-process', { orderId: '12345' });
      
      // Act
      processManager.transitionProcess(instance.id, 'ERROR_EVENT');
      
      // The process should transition to the error state
      const currentInstance = processManager.getProcess(instance.id);
      expect(currentInstance?.state).toBe('error');
    });
  });
}); 