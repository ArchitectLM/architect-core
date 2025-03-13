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
    it('should create a process instance with the correct initial state', () => {
      // Act
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Assert - focus on behavior, not implementation details
      expect(instance).toBeDefined();
      expect(instance.id).toBeDefined();
      expect(instance.processId).toBe('order-process');
      expect(instance.state).toBe('created'); // Initial state from process definition
      expect(instance.context).toEqual(expect.objectContaining({ orderId: '12345' }));
    });
    
    it('should retrieve a process instance by ID', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const retrievedInstance = runtime.getProcess(instance.id);
      
      // Assert - verify the behavior of retrieving a process
      expect(retrievedInstance).toBeDefined();
      expect(retrievedInstance?.id).toBe(instance.id);
      expect(retrievedInstance?.processId).toBe('order-process');
      expect(retrievedInstance?.state).toBe('created');
    });
    
    it('should transition a process to a new state when a valid event occurs', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert - verify the behavior of state transition
      expect(updatedInstance.state).toBe('processing');
    });
    
    it('should not transition if the event does not match any transition', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      const initialState = instance.state;
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'INVALID_EVENT');
      
      // Assert - verify the behavior of invalid transition
      expect(updatedInstance.state).toBe(initialState);
    });
    
    it('should support wildcard transitions from any state', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'CANCEL');
      
      // Assert - verify the behavior of wildcard transition
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
      
      // Assert - verify the behavior of context updates
      expect(updatedInstance.context).toEqual(expect.objectContaining({ 
        orderId: '12345',
        processingId: 'proc-1'
      }));
    });
    
    it('should emit events when process state changes', () => {
      // Arrange
      const stateChangeHandler = vi.fn();
      runtime.subscribeToEvent('STATE_CHANGED', stateChangeHandler);
      
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      
      // Act
      runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert - verify the behavior of event emission
      expect(stateChangeHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'STATE_CHANGED',
        payload: expect.objectContaining({
          instanceId: instance.id,
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
      
      // Assert - verify the behavior of task execution
      expect(result).toEqual(expect.objectContaining({ 
        processed: true, 
        orderId: '12345' 
      }));
    });
    
    it('should throw an error if task does not exist', async () => {
      // Act & Assert - verify the behavior of error handling
      await expect(runtime.executeTask('non-existent-task', {}))
        .rejects.toThrow(/Task not found|Task definition not found/);
    });
    
    it('should emit events when task execution starts and completes', async () => {
      // Arrange
      const taskStartedHandler = vi.fn();
      const taskCompletedHandler = vi.fn();
      
      runtime.subscribeToEvent('TASK_STARTED', taskStartedHandler);
      runtime.subscribeToEvent('TASK_COMPLETED', taskCompletedHandler);
      
      // Act
      await runtime.executeTask('process-order', { orderId: '12345' });
      
      // Assert - verify the behavior of event emission
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
          result: expect.objectContaining({ 
            processed: true, 
            orderId: '12345' 
          })
        })
      }));
    });
    
    it('should emit events from task implementation', async () => {
      // Arrange
      const shipOrderHandler = vi.fn();
      runtime.subscribeToEvent('SHIP_ORDER', shipOrderHandler);
      
      // Act
      await runtime.executeTask('ship-order', { orderId: '12345' });
      
      // Assert - verify the behavior of event emission from tasks
      expect(shipOrderHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SHIP_ORDER',
        payload: expect.objectContaining({ orderId: '12345' })
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
      
      // Act & Assert - verify the behavior of task context
      const result = await runtimeWithTask.executeTask('task-with-context', {});
      expect(result).toEqual(expect.objectContaining({ contextVerified: true }));
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
      
      // Assert - verify the behavior of nested task execution
      expect(result).toEqual(expect.objectContaining({
        composite: true,
        innerResult: expect.objectContaining({ 
          processed: true, 
          orderId: '12345' 
        })
      }));
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
      
      // Assert - verify the behavior of event subscription
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ORDER_CREATED',
        payload: expect.objectContaining({ orderId: '12345' })
      }));
    });
    
    it('should allow subscribing to all events with wildcard', () => {
      // Arrange
      const handler = vi.fn();
      
      // Act
      runtime.subscribeToEvent('*', handler);
      runtime.emitEvent('EVENT_1', { data: '1' });
      runtime.emitEvent('EVENT_2', { data: '2' });
      
      // Assert - verify the behavior of wildcard subscription
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
      
      // Assert - verify the behavior of unsubscription
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({ data: 'before' })
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
      
      // Assert - verify the behavior of event-triggered transitions
      const updatedInstance = runtime.getProcess(instance.id);
      expect(updatedInstance).toBeDefined();
      expect(updatedInstance?.state).toBe('shipped');
    });
    
    it('should include timestamp and id in emitted events', () => {
      // Arrange
      const handler = vi.fn();
      runtime.subscribeToEvent('TEST_EVENT', handler);
      
      // Act
      runtime.emitEvent('TEST_EVENT', { data: 'test' });
      
      // Assert - verify the behavior of event structure
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        timestamp: expect.any(Date),
        type: 'TEST_EVENT',
        payload: expect.objectContaining({ data: 'test' })
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
      
      // Assert - verify the behavior of process listing
      expect(instances.length).toBeGreaterThanOrEqual(2);
      expect(instances.some(i => i.id === instance1.id)).toBe(true);
      expect(instances.some(i => i.id === instance2.id)).toBe(true);
    });
    
    it('should filter process instances by process ID', () => {
      // Arrange
      runtime.createProcess('order-process', { orderId: '1' });
      runtime.createProcess('order-process', { orderId: '2' });
      
      // Act
      const instances = runtime.getProcessesByType('order-process');
      
      // Assert - verify the behavior of process filtering
      expect(instances.length).toBeGreaterThanOrEqual(2);
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
      
      // Assert - verify the behavior of state filtering
      expect(processingInstances.some(i => i.id === instance1.id)).toBe(true);
      expect(createdInstances.some(i => i.id === instance2.id)).toBe(true);
    });
    
    it('should provide access to available tasks', () => {
      // Act
      const tasks = runtime.getAvailableTasks();
      
      // Assert - verify the behavior of task listing
      expect(tasks).toContain('process-order');
      expect(tasks).toContain('ship-order');
    });
    
    it('should provide access to available processes', () => {
      // Act
      const processes = runtime.getAvailableProcesses();
      
      // Assert - verify the behavior of process definition listing
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
      
      // Assert - verify the behavior of custom handlers
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
      
      // Assert - verify the behavior of middleware
      expect(beforeExecution).toHaveBeenCalledWith(
        'process-order',
        expect.objectContaining({ orderId: '12345' }),
        expect.anything()
      );
      
      expect(afterExecution).toHaveBeenCalledWith(
        'process-order',
        expect.objectContaining({ orderId: '12345' }),
        expect.objectContaining({ processed: true, orderId: '12345' }),
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
      
      // Assert - verify the behavior of state persistence
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
      
      // Act & Assert - verify the behavior of error handling
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
      
      // Assert - verify the behavior of error handling in event handlers
      expect(systemErrorHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SYSTEM_ERROR',
        payload: expect.objectContaining({
          error: expect.any(Error),
          source: 'event_handler'
        })
      }));
    });
    
    it('should handle non-existent process IDs gracefully', () => {
      // Act & Assert - verify the behavior of error handling for invalid processes
      expect(() => runtime.getProcess('non-existent')).not.toThrow();
      expect(runtime.getProcess('non-existent')).toBeUndefined();
      
      expect(() => runtime.transitionProcess('non-existent', 'EVENT')).toThrow(
        /Process instance not found/
      );
    });
  });
}); 