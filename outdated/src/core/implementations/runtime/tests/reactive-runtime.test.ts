import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntime } from '../';
import { ReactiveRuntime } from '../reactive-runtime';
import { CacheableTaskOptions } from '../reactive-runtime';
import { 
  ProcessDefinition, 
  TaskDefinition, 
  TaskContext, 
  Event, 
  ProcessInstance,
  ProcessState
} from '../../../models';

describe('ReactiveRuntime', () => {
  let runtime: ReturnType<typeof createRuntime>;
  let orderProcess: ProcessDefinition;
  let processOrderTask: TaskDefinition;
  let shipOrderTask: TaskDefinition;
  
  beforeEach(() => {
    // Define a process
    orderProcess = {
      id: 'order-process',
      states: [
        { name: 'created' }, 
        { name: 'processing' }, 
        { name: 'shipped' }, 
        { name: 'completed' }, 
        { name: 'cancelled' }
      ],
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
      
      // Assert
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
      
      // Assert
      expect(retrievedInstance).toBeDefined();
      expect(retrievedInstance?.id).toBe(instance.id);
      expect(retrievedInstance?.processId).toBe('order-process');
      expect(retrievedInstance?.state).toBe('created');
    });
    
    it('should transition a process to a new state when a valid event occurs', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      const initialState = instance.state;
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert - Check that the state has changed
      expect(updatedInstance.state).not.toBe(initialState);
      expect(updatedInstance.state).toBe('processing');
    });
    
    it('should not transition if the event does not match any transition', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      const initialState = instance.state;
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'INVALID_EVENT');
      
      // Assert
      expect(updatedInstance.state).toBe(initialState);
    });
    
    it('should support wildcard transitions from any state', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      const initialState = instance.state;
      
      // Act
      const updatedInstance = runtime.transitionProcess(instance.id, 'CANCEL');
      
      // Assert - Check that the state has changed to cancelled
      expect(updatedInstance.state).not.toBe(initialState);
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
      
      // Assert - Check that the context contains the original data and the new data
      expect(updatedInstance.context).toHaveProperty('orderId', '12345');
      expect(updatedInstance.context).toHaveProperty('processingId', 'proc-1');
    });
  });
  
  describe('Task Execution', () => {
    it('should execute a task and return the result', async () => {
      // Act
      const result = await runtime.executeTask('process-order', { orderId: '12345' });
      
      // Assert
      expect(result).toEqual(expect.objectContaining({ 
        processed: true, 
        orderId: '12345' 
      }));
    });
    
    it('should emit events from task implementation', async () => {
      // Arrange
      const mockHandler = vi.fn();
      runtime.subscribe('SHIP_ORDER', mockHandler);
      
      // Act
      await runtime.executeTask('ship-order', { orderId: '12345' });
      
      // Assert
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SHIP_ORDER',
        payload: expect.objectContaining({ orderId: '12345' })
      }));
    });
    
    it('should throw an error if task does not exist', async () => {
      // Act & Assert
      await expect(runtime.executeTask('non-existent-task', {}))
        .rejects.toThrow(/Task not found|Task definition not found/);
    });
  });
  
  describe('Event Management', () => {
    it('should allow subscribing to and emitting events', () => {
      // Arrange
      const mockHandler = vi.fn();
      runtime.subscribe('TEST_EVENT', mockHandler);
      
      // Act
      runtime.emitEvent({
        type: 'TEST_EVENT',
        payload: { data: 'test' }
      });
      
      // Assert
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TEST_EVENT',
        payload: expect.objectContaining({ data: 'test' })
      }));
    });
    
    it('should support wildcard event subscriptions', () => {
      // Arrange
      const mockHandler = vi.fn();
      runtime.subscribe('*', mockHandler);
      
      // Act
      runtime.emitEvent({ type: 'EVENT_1', payload: { data: '1' } });
      runtime.emitEvent({ type: 'EVENT_2', payload: { data: '2' } });
      
      // Assert
      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EVENT_1',
        payload: expect.objectContaining({ data: '1' })
      }));
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EVENT_2',
        payload: expect.objectContaining({ data: '2' })
      }));
    });
    
    it('should allow unsubscribing from events', () => {
      // Arrange
      const mockHandler = vi.fn();
      const subscription = runtime.subscribe('TEST_EVENT', mockHandler);
      
      // Act - First emit, then unsubscribe, then emit again
      runtime.emitEvent({ type: 'TEST_EVENT', payload: { data: 'first' } });
      runtime.unsubscribe(subscription);
      runtime.emitEvent({ type: 'TEST_EVENT', payload: { data: 'second' } });
      
      // Assert - Handler should only be called once
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TEST_EVENT',
        payload: expect.objectContaining({ data: 'first' })
      }));
    });
    
    it('should support event filtering by source', () => {
      // Arrange
      const processEventHandler = vi.fn();
      const taskEventHandler = vi.fn();
      
      // Subscribe to events with different sources
      runtime.subscribe('*', (event) => {
        if (event.source?.startsWith('process:')) {
          processEventHandler(event);
        } else if (event.source?.startsWith('task:')) {
          taskEventHandler(event);
        }
      });
      
      // Act - Emit events with different sources
      runtime.emitEvent({ 
        type: 'PROCESS_EVENT', 
        payload: { data: 'process' },
        source: 'process:123'
      });
      
      runtime.emitEvent({ 
        type: 'TASK_EVENT', 
        payload: { data: 'task' },
        source: 'task:456'
      });
      
      // Assert
      expect(processEventHandler).toHaveBeenCalledTimes(1);
      expect(processEventHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'PROCESS_EVENT',
        source: 'process:123'
      }));
      
      expect(taskEventHandler).toHaveBeenCalledTimes(1);
      expect(taskEventHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TASK_EVENT',
        source: 'task:456'
      }));
    });
    
    it('should propagate events from process transitions to subscribers', () => {
      // Arrange
      const instance = runtime.createProcess('order-process', { orderId: '12345' });
      const transitionHandler = vi.fn();
      
      // Subscribe to the transition event
      runtime.subscribe('START_PROCESSING', transitionHandler);
      
      // Act
      runtime.transitionProcess(instance.id, 'START_PROCESSING');
      
      // Assert
      expect(transitionHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'START_PROCESSING',
        source: expect.stringContaining(`process:${instance.id}`)
      }));
    });
    
    it('should propagate events from task execution to subscribers', async () => {
      // Arrange
      const taskEventHandler = vi.fn();
      
      // Subscribe to the task event
      runtime.subscribe('SHIP_ORDER', taskEventHandler);
      
      // Act
      await runtime.executeTask('ship-order', { orderId: '12345' });
      
      // Assert
      expect(taskEventHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SHIP_ORDER',
        payload: expect.objectContaining({ orderId: '12345' })
      }));
    });
  });
  
  describe('System Introspection', () => {
    it('should provide access to all process instances', () => {
      // Arrange
      runtime.createProcess('order-process', { orderId: '12345' });
      runtime.createProcess('order-process', { orderId: '67890' });
      
      // Act
      const instances = runtime.getAllProcesses();
      
      // Assert
      expect(instances).toHaveLength(2);
      expect(instances[0].context).toHaveProperty('orderId');
      expect(instances[1].context).toHaveProperty('orderId');
    });
  });
  
  describe('Runtime Extensions', () => {
    it('should allow registering and retrieving services', () => {
      // Arrange
      const mockService = { doSomething: vi.fn() };
      
      // Act
      runtime.registerService('test-service', mockService);
      const retrievedService = runtime.getService('test-service');
      
      // Assert
      expect(retrievedService).toBe(mockService);
    });
    
    it('should return null for non-existent services', () => {
      // Act
      const service = runtime.getService('non-existent');
      
      // Assert
      expect(service).toBeNull();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle non-existent process IDs gracefully', () => {
      // Act & Assert
      expect(() => {
        runtime.transitionProcess('non-existent', 'EVENT');
      }).toThrow(/Process instance not found/);
    });
  });
});

describe('Caching', () => {
  it('should cache process instances when caching is enabled', () => {
    // Create a runtime with caching enabled
    const runtime = new ReactiveRuntime(
      {
        'order-process': {
          id: 'order-process',
          states: [{ name: 'created' }, { name: 'processing' }, { name: 'completed' }],
          transitions: [
            { from: 'created', to: 'processing', on: 'PROCESS' },
            { from: 'processing', to: 'completed', on: 'COMPLETE' }
          ]
        }
      },
      {
        'process-order': {
          id: 'process-order',
          implementation: () => ({ processed: true })
        }
      },
      {
        caching: {
          enabled: true,
          processCache: {
            maxSize: 10
          }
        }
      }
    );

    // Create a process
    const process = runtime.createProcess('order-process', { orderId: '123' });
    
    // Get the process twice - second time should be from cache
    const process1 = runtime.getProcess(process.id);
    const process2 = runtime.getProcess(process.id);
    
    // Both should be the same instance
    expect(process1).toBe(process2);
    
    // Check cache stats
    const stats = runtime.getCacheStats();
    expect(stats.enabled).toBe(true);
    expect(stats.processCache.size).toBe(1);
    expect(stats.processCache.stats.hits).toBeGreaterThan(0);
  });

  it('should cache task results when caching is enabled', async () => {
    // Create a mock task implementation that counts executions
    let executionCount = 0;
    const taskImplementation = () => {
      executionCount++;
      return { result: executionCount };
    };

    // Create a runtime with caching enabled
    const runtime = new ReactiveRuntime(
      {
        'order-process': {
          id: 'order-process',
          states: [{ name: 'created' }, { name: 'processing' }, { name: 'completed' }],
          transitions: []
        }
      },
      {
        'cached-task': {
          id: 'cached-task',
          implementation: taskImplementation
        }
      },
      {
        caching: {
          enabled: true,
          taskResultCache: {
            maxSize: 10,
            ttl: 1000 // 1 second TTL
          }
        }
      }
    );

    // Execute the task twice with the same input
    const input = { data: 'test' };
    const result1 = await runtime.executeTask('cached-task', input);
    const result2 = await runtime.executeTask('cached-task', input);
    
    // The task should only be executed once
    expect(executionCount).toBe(1);
    
    // Both results should be the same
    expect(result1).toEqual(result2);
    
    // Check cache stats
    const stats = runtime.getCacheStats();
    expect(stats.enabled).toBe(true);
    expect(stats.taskResultCache.size).toBe(1);
    expect(stats.taskResultCache.stats.hits).toBeGreaterThan(0);
  });

  it('should not use cache when skipCache option is provided', async () => {
    // Create a mock task implementation that counts executions
    let executionCount = 0;
    const taskImplementation = () => {
      executionCount++;
      return { result: executionCount };
    };

    // Create a runtime with caching enabled
    const runtime = new ReactiveRuntime(
      {
        'order-process': {
          id: 'order-process',
          states: [{ name: 'created' }, { name: 'processing' }, { name: 'completed' }],
          transitions: []
        }
      },
      {
        'cached-task': {
          id: 'cached-task',
          implementation: taskImplementation
        }
      },
      {
        caching: {
          enabled: true,
          taskResultCache: {
            maxSize: 10
          }
        }
      }
    );

    // Execute the task twice with the same input, but skip cache on second call
    const input = { data: 'test' };
    const result1 = await runtime.executeTask('cached-task', input);
    const result2 = await runtime.executeTask('cached-task', input, { skipCache: true } as CacheableTaskOptions);
    
    // The task should be executed twice
    expect(executionCount).toBe(2);
    
    // Results should be different
    expect(result1).not.toEqual(result2);
  });

  it('should clear caches when clearCaches is called', async () => {
    // Create a runtime with caching enabled
    const runtime = new ReactiveRuntime(
      {
        'order-process': {
          id: 'order-process',
          states: [{ name: 'created' }, { name: 'processing' }, { name: 'completed' }],
          transitions: []
        }
      },
      {
        'cached-task': {
          id: 'cached-task',
          implementation: () => ({ result: true })
        }
      },
      {
        caching: {
          enabled: true
        }
      }
    );

    // Create a process and execute a task
    const process = runtime.createProcess('order-process', { orderId: '123' });
    
    // Access the process to ensure it's cached
    runtime.getProcess(process.id);
    
    await runtime.executeTask('cached-task', { data: 'test' });
    
    // Check that caches have data
    let stats = runtime.getCacheStats();
    expect(stats.processCache.size).toBe(1);
    expect(stats.taskResultCache.size).toBe(1);
    
    // Clear caches
    runtime.clearCaches();
    
    // Check that caches are empty
    stats = runtime.getCacheStats();
    expect(stats.processCache.size).toBe(0);
    expect(stats.taskResultCache.size).toBe(0);
  });

  it('should respect TTL for cached task results', async () => {
    // Create a mock task implementation that counts executions
    let executionCount = 0;
    const taskImplementation = () => {
      executionCount++;
      return { result: executionCount };
    };

    // Create a runtime with caching enabled and a very short TTL
    const runtime = new ReactiveRuntime(
      {
        'order-process': {
          id: 'order-process',
          states: [{ name: 'created' }, { name: 'processing' }, { name: 'completed' }],
          transitions: []
        }
      },
      {
        'cached-task': {
          id: 'cached-task',
          implementation: taskImplementation
        }
      },
      {
        caching: {
          enabled: true,
          taskResultCache: {
            maxSize: 10,
            ttl: 50 // 50ms TTL
          }
        }
      }
    );

    // Execute the task
    const input = { data: 'test' };
    await runtime.executeTask('cached-task', input);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Execute again with the same input
    await runtime.executeTask('cached-task', input);
    
    // The task should be executed twice due to TTL expiration
    expect(executionCount).toBe(2);
  });
}); 