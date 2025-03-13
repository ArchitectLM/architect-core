import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntime } from './runtime';
import { ProcessDefinition, TaskDefinition, TaskContext, Event, ProcessInstance } from './types';

describe('Runtime', () => {
  let runtime: ReturnType<typeof createRuntime>;
  let orderProcess: ProcessDefinition;
  let processOrderTask: TaskDefinition;
  let shipOrderTask: TaskDefinition;
  
  beforeEach(() => {
    // Define a process
    orderProcess = {
      id: 'order-process',
      states: ['created', 'processing', 'shipped', 'completed', 'cancelled'],
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'processing', on: 'START_PROCESSING' },
        { from: 'processing', to: 'shipped', on: 'SHIP_ORDER' },
        { from: 'shipped', to: 'completed', on: 'COMPLETE' },
        { from: '*', to: 'cancelled', on: 'CANCEL' }
      ]
    };
    
    // Define tasks
    processOrderTask = {
      id: 'process-order',
      implementation: async (input: any, context: TaskContext) => {
        // Process the order
        return { processed: true, orderId: input.orderId };
      }
    };
    
    shipOrderTask = {
      id: 'ship-order',
      implementation: async (input: any, context: TaskContext) => {
        // Ship the order
        context.emitEvent('SHIP_ORDER', { orderId: input.orderId });
        return { shipped: true, orderId: input.orderId };
      }
    };
    
    // Create runtime
    runtime = createRuntime(
      { 'order-process': orderProcess },
      { 
        'process-order': processOrderTask,
        'ship-order': shipOrderTask
      }
    );
  });
  
  describe('Process Management', () => {
    it('should create a process instance', () => {
      // Act
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Assert
      expect(instance).toBeDefined();
      expect(instance.id).toBeDefined();
      expect(instance.processId).toBe('order-process');
      expect(instance.state).toBe('created');
      expect(instance.context).toEqual({ orderId: '12345' });
    });
    
    it('should retrieve a process instance by ID', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const retrievedInstance = runtime.getProcess(instance.id);
      
      // Assert
      expect(retrievedInstance).toEqual(instance);
    });
    
    it('should transition a process to a new state', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert
      expect(updatedInstance.state).toBe('processing');
    });
    
    it('should not transition if the event does not match any transition', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'INVALID_EVENT');
      
      // Assert
      expect(updatedInstance.state).toBe('created');
    });
    
    it('should support wildcard transitions', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'CANCEL');
      
      // Assert
      expect(updatedInstance.state).toBe('cancelled');
    });
    
    it('should update process context during transitions', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = runtime.transitionProcess(
        instance.id, 
        'START_PROCESSING', 
        { processingId: 'proc-1' }
      );
      
      // Assert
      expect(updatedInstance.context).toEqual({ 
        orderId: '12345',
        processingId: 'proc-1'
      });
    });
    
    it('should emit events when process state changes', () => {
      // Arrange
      const stateChangeHandler = vi.fn();
      runtime.subscribeToEvent('STATE_CHANGED', stateChangeHandler);
      
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert
      expect(stateChangeHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'STATE_CHANGED',
        payload: expect.objectContaining({
          instanceId: instance.id,
          processId: 'order-process',
          previousState: 'created',
          newState: 'processing'
        })
      }));
    });
  });
  
  describe('Task Execution', () => {
    it('should execute a task and return the result', async () => {
      // Act
      const result = await runtime.executeTask('process-order', { orderId: '12345' });
      
      // Assert
      expect(result).toEqual({ processed: true, orderId: '12345' });
    });
    
    it('should throw an error if task does not exist', async () => {
      // Act & Assert
      await expect(runtime.executeTask('non-existent-task', {}))
        .rejects.toThrow('Task not found: non-existent-task');
    });
    
    it('should emit events when task execution starts and completes', async () => {
      // Arrange
      const taskStartedHandler = vi.fn();
      const taskCompletedHandler = vi.fn();
      
      runtime.subscribeToEvent('TASK_STARTED', taskStartedHandler);
      runtime.subscribeToEvent('TASK_COMPLETED', taskCompletedHandler);
      
      // Act
      await runtime.executeTask('process-order', { orderId: '12345' });
      
      // Assert
      expect(taskStartedHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TASK_STARTED',
        payload: expect.objectContaining({
          taskId: 'process-order'
        })
      }));
      
      expect(taskCompletedHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TASK_COMPLETED',
        payload: expect.objectContaining({
          taskId: 'process-order',
          result: { processed: true, orderId: '12345' }
        })
      }));
    });
    
    it('should emit events from task implementation', async () => {
      // Arrange
      const shipOrderHandler = vi.fn();
      runtime.subscribeToEvent('SHIP_ORDER', shipOrderHandler);
      
      // Act
      await runtime.executeTask('ship-order', { orderId: '12345' });
      
      // Assert
      expect(shipOrderHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SHIP_ORDER',
        payload: { orderId: '12345' }
      }));
    });
    
    it('should provide task context with helper methods', async () => {
      // Arrange
      const taskWithContext: TaskDefinition = {
        id: 'task-with-context',
        implementation: async (input: any, context: TaskContext) => {
          // Verify context has expected methods
          expect(context.emitEvent).toBeInstanceOf(Function);
          expect(context.executeTask).toBeInstanceOf(Function);
          expect(context.getProcess).toBeInstanceOf(Function);
          
          return { contextVerified: true };
        }
      };
      
      const runtimeWithTask = createRuntime(
        { 'order-process': orderProcess },
        { 'task-with-context': taskWithContext }
      );
      
      // Act & Assert
      const result = await runtimeWithTask.executeTask('task-with-context', {});
      expect(result).toEqual({ contextVerified: true });
    });
    
    it('should allow tasks to execute other tasks', async () => {
      // Arrange
      const compositeTask: TaskDefinition = {
        id: 'composite-task',
        implementation: async (input: any, context: TaskContext) => {
          // Execute another task
          const result = await context.executeTask('process-order', { orderId: input.orderId });
          return { 
            composite: true, 
            innerResult: result 
          };
        }
      };
      
      const runtimeWithTask = createRuntime(
        { 'order-process': orderProcess },
        { 
          'process-order': processOrderTask,
          'composite-task': compositeTask
        }
      );
      
      // Act
      const result = await runtimeWithTask.executeTask('composite-task', { orderId: '12345' });
      
      // Assert
      expect(result).toEqual({
        composite: true,
        innerResult: { processed: true, orderId: '12345' }
      });
    });
  });
  
  describe('Event Management', () => {
    it('should allow subscribing to specific events', () => {
      // Arrange
      const handler = vi.fn();
      
      // Act
      runtime.subscribeToEvent('ORDER_CREATED', handler);
      runtime.emitEvent('ORDER_CREATED', { orderId: '12345' });
      runtime.emitEvent('OTHER_EVENT', { data: 'test' });
      
      // Assert
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ORDER_CREATED',
        payload: { orderId: '12345' }
      }));
    });
    
    it('should allow subscribing to all events with wildcard', () => {
      // Arrange
      const handler = vi.fn();
      
      // Act
      runtime.subscribeToEvent('*', handler);
      runtime.emitEvent('EVENT_1', { data: '1' });
      runtime.emitEvent('EVENT_2', { data: '2' });
      
      // Assert
      expect(handler).toHaveBeenCalledTimes(2);
    });
    
    it('should allow unsubscribing from events', () => {
      // Arrange
      const handler = vi.fn();
      const subscription = runtime.subscribeToEvent('TEST_EVENT', handler);
      
      // Act
      runtime.emitEvent('TEST_EVENT', { data: 'before' });
      subscription.unsubscribe();
      runtime.emitEvent('TEST_EVENT', { data: 'after' });
      
      // Assert
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        payload: { data: 'before' }
      }));
    });
    
    it('should trigger process transitions based on events', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Act
      runtime.emitEvent('SHIP_ORDER', { 
        orderId: '12345',
        instanceId: instance.id
      });
      
      // Assert
      const updatedInstance = runtime.getProcess(instance.id);
      expect(updatedInstance?.state).toBe('shipped');
    });
    
    it('should include timestamp and id in emitted events', () => {
      // Arrange
      const handler = vi.fn();
      runtime.subscribeToEvent('TEST_EVENT', handler);
      
      // Act
      runtime.emitEvent('TEST_EVENT', { data: 'test' });
      
      // Assert
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        timestamp: expect.any(Number),
        type: 'TEST_EVENT',
        payload: { data: 'test' }
      }));
    });
  });
  
  describe('System Introspection', () => {
    it('should provide access to all process instances', () => {
      // Arrange
      const instance1 = runtime.createProcess('order-process', { orderId: '1' });
      const instance2 = runtime.createProcess('order-process', { orderId: '2' });
      
      // Act
      const instances = runtime.getAllProcesses();
      
      // Assert
      expect(instances).toHaveLength(2);
      expect(instances).toContainEqual(instance1);
      expect(instances).toContainEqual(instance2);
    });
    
    it('should filter process instances by process ID', () => {
      // Arrange
      runtime.createProcess('order-process', { orderId: '1' });
      runtime.createProcess('order-process', { orderId: '2' });
      
      // Act
      const instances = runtime.getProcessesByType('order-process');
      
      // Assert
      expect(instances).toHaveLength(2);
      instances.forEach(instance => {
        expect(instance.processId).toBe('order-process');
      });
    });
    
    it('should filter process instances by state', () => {
      // Arrange
      const instance1 = runtime.createProcess('order-process', { orderId: '1' });
      const instance2 = runtime.createProcess('order-process', { orderId: '2' });
      
      runtime.transitionProcess(instance1.id, 'START_PROCESSING');
      
      // Act
      const processingInstances = runtime.getProcessesByState('processing');
      const createdInstances = runtime.getProcessesByState('created');
      
      // Assert
      expect(processingInstances).toHaveLength(1);
      expect(processingInstances[0].id).toBe(instance1.id);
      
      expect(createdInstances).toHaveLength(1);
      expect(createdInstances[0].id).toBe(instance2.id);
    });
    
    it('should provide access to available tasks', () => {
      // Act
      const tasks = runtime.getAvailableTasks();
      
      // Assert
      expect(tasks).toHaveLength(2);
      expect(tasks).toContain('process-order');
      expect(tasks).toContain('ship-order');
    });
    
    it('should provide access to available processes', () => {
      // Act
      const processes = runtime.getAvailableProcesses();
      
      // Assert
      expect(processes).toHaveLength(1);
      expect(processes).toContain('order-process');
    });
  });
  
  describe('Runtime Extensions', () => {
    it('should support custom event handlers for system-wide events', () => {
      // Arrange
      const customHandler = vi.fn();
      
      const runtimeWithExtension = createRuntime(
        { 'order-process': orderProcess },
        { 'process-order': processOrderTask },
        {
          onProcessCreated: customHandler
        }
      );
      
      // Act
      runtimeWithExtension.createProcess('order-process', { orderId: '12345' });
      
      // Assert
      expect(customHandler).toHaveBeenCalled();
    });
    
    it('should support middleware for task execution', async () => {
      // Arrange
      const beforeExecution = vi.fn();
      const afterExecution = vi.fn();
      
      const runtimeWithMiddleware = createRuntime(
        { 'order-process': orderProcess },
        { 'process-order': processOrderTask },
        {
          taskMiddleware: {
            before: beforeExecution,
            after: afterExecution
          }
        }
      );
      
      // Act
      await runtimeWithMiddleware.executeTask('process-order', { orderId: '12345' });
      
      // Assert
      expect(beforeExecution).toHaveBeenCalledWith(
        'process-order',
        { orderId: '12345' },
        expect.anything()
      );
      
      expect(afterExecution).toHaveBeenCalledWith(
        'process-order',
        { orderId: '12345' },
        { processed: true, orderId: '12345' },
        expect.anything()
      );
    });
    
    it('should support process state persistence', () => {
      // Arrange
      const saveState = vi.fn();
      const loadState = vi.fn().mockReturnValue([]);
      
      const runtimeWithPersistence = createRuntime(
        { 'order-process': orderProcess },
        { 'process-order': processOrderTask },
        {
          storage: {
            saveState,
            loadState
          }
        }
      );
      
      // Act
      const instance = runtimeWithPersistence.createProcess('order-process', { orderId: '12345' });
      runtimeWithPersistence.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert
      expect(saveState).toHaveBeenCalled();
      expect(loadState).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors in task execution', async () => {
      // Arrange
      const errorTask: TaskDefinition = {
        id: 'error-task',
        implementation: async () => {
          throw new Error('Task failed');
        }
      };
      
      const runtimeWithErrorTask = createRuntime(
        { 'order-process': orderProcess },
        { 'error-task': errorTask }
      );
      
      const errorHandler = vi.fn();
      runtimeWithErrorTask.subscribeToEvent('TASK_FAILED', errorHandler);
      
      // Act & Assert
      await expect(runtimeWithErrorTask.executeTask('error-task', {}))
        .rejects.toThrow('Task failed');
      
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TASK_FAILED',
        payload: expect.objectContaining({
          taskId: 'error-task',
          error: expect.any(Error)
        })
      }));
    });
    
    it('should handle errors in event handlers', () => {
      // Arrange
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      runtime.subscribeToEvent('TEST_EVENT', errorHandler);
      
      const systemErrorHandler = vi.fn();
      runtime.subscribeToEvent('SYSTEM_ERROR', systemErrorHandler);
      
      // Act
      // This should not throw even though the handler throws
      runtime.emitEvent('TEST_EVENT', {});
      
      // Assert
      expect(systemErrorHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SYSTEM_ERROR',
        payload: expect.objectContaining({
          error: expect.any(Error),
          source: 'event_handler'
        })
      }));
    });
    
    it('should handle non-existent process IDs gracefully', () => {
      // Act & Assert
      expect(() => runtime.getProcess('non-existent')).not.toThrow();
      expect(runtime.getProcess('non-existent')).toBeUndefined();
      
      expect(() => runtime.transitionProcess('non-existent', 'EVENT')).toThrow(
        'Process instance not found: non-existent'
      );
    });
  });
}); 