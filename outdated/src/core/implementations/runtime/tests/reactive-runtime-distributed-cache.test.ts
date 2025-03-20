import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ReactiveRuntime, 
  InMemoryDistributedCacheProvider,
  DistributedCache,
  CacheableTaskOptions
} from '../reactive-runtime';
import { ProcessDefinition, TaskDefinition, Transition, ProcessState } from '../../../models';

describe('ReactiveRuntime with Distributed Cache', () => {
  // Define test process and task
  const orderProcess: ProcessDefinition<string, string, any> = {
    id: 'order-process',
    description: 'Order processing workflow',
    initialState: 'new',
    states: {
      new: {
        name: 'New Order',
        transitions: {
          PROCESS_ORDER: 'processing'
        }
      },
      processing: {
        name: 'Processing Order',
        transitions: {
          COMPLETE_ORDER: 'completed',
          CANCEL_ORDER: 'cancelled'
        }
      },
      completed: {
        name: 'Order Completed',
        transitions: {}
      },
      cancelled: {
        name: 'Order Cancelled',
        transitions: {}
      }
    },
    transitions: [
      {
        from: 'new',
        to: 'processing',
        on: 'PROCESS_ORDER',
        description: 'Process Order'
      },
      {
        from: 'processing',
        to: 'completed',
        on: 'COMPLETE_ORDER',
        description: 'Complete Order'
      },
      {
        from: 'processing',
        to: 'cancelled',
        on: 'CANCEL_ORDER',
        description: 'Cancel Order'
      }
    ]
  };
  
  const calculateTotalTask: TaskDefinition = {
    id: 'calculate-total',
    description: 'Calculate Order Total',
    implementation: async (input: { items: Array<{ price: number; quantity: number }> }) => {
      return input.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
  };
  
  let runtime: ReactiveRuntime;
  let provider: InMemoryDistributedCacheProvider;
  
  beforeEach(() => {
    // Create a distributed cache provider
    provider = new InMemoryDistributedCacheProvider('test');
    
    // Create runtime with distributed caching enabled
    runtime = new ReactiveRuntime(
      { 'order-process': orderProcess },
      { 'calculate-total': calculateTotalTask },
      {
        caching: {
          enabled: true,
          distributed: {
            enabled: true,
            provider,
            instanceId: 'test-instance'
          },
          processCache: {
            maxSize: 10
          },
          taskResultCache: {
            maxSize: 10,
            ttl: 60000 // 1 minute
          }
        }
      }
    );
  });
  
  describe('Process caching', () => {
    it('should cache process instances in both local and distributed cache', async () => {
      // Create a process
      const process = runtime.createProcess('order-process', { orderId: '123', items: [] });
      
      // Get the process synchronously (should be in local cache)
      const localCachedProcess = runtime.getProcess(process.id);
      expect(localCachedProcess).toBeDefined();
      expect(localCachedProcess?.id).toBe(process.id);
      
      // Get the process asynchronously (should check distributed cache)
      const distributedCachedProcess = await runtime.getProcessAsync(process.id);
      expect(distributedCachedProcess).toBeDefined();
      expect(distributedCachedProcess?.id).toBe(process.id);
      
      // Verify it's in the distributed cache
      const cachedValue = await provider.get<any>(`test-instance:process:${process.id}`);
      expect(cachedValue).toBeDefined();
      expect(cachedValue.id).toBe(process.id);
    });
    
    it('should update cache when process state changes', async () => {
      // Create a process
      const process = runtime.createProcess('order-process', { orderId: '123', items: [] });
      expect(process.state).toBe('new');
      
      // Transition the process
      const updatedProcess = runtime.transitionProcess(process.id, 'PROCESS_ORDER');
      expect(updatedProcess.state).toBe('processing');
      
      // Get the process from cache
      const cachedProcess = runtime.getProcess(process.id);
      expect(cachedProcess?.state).toBe('processing');
      
      // Verify it's updated in the distributed cache
      const distributedCachedProcess = await provider.get<any>(`test-instance:process:${process.id}`);
      expect(distributedCachedProcess.state).toBe('processing');
    });
    
    it('should clear process cache', async () => {
      // Create processes
      const process1 = runtime.createProcess('order-process', { orderId: '123', items: [] });
      const process2 = runtime.createProcess('order-process', { orderId: '456', items: [] });
      
      // Verify they're in cache
      expect(runtime.getProcess(process1.id)).toBeDefined();
      expect(runtime.getProcess(process2.id)).toBeDefined();
      
      // Clear caches
      runtime.clearCaches();
      
      // Verify local cache is cleared
      expect(runtime.getProcess(process1.id)).toBeUndefined();
      expect(runtime.getProcess(process2.id)).toBeUndefined();
      
      // Wait for async clear to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify distributed cache is cleared
      const cachedValue1 = await provider.get<any>(`test-instance:process:${process1.id}`);
      const cachedValue2 = await provider.get<any>(`test-instance:process:${process2.id}`);
      expect(cachedValue1).toBeUndefined();
      expect(cachedValue2).toBeUndefined();
    });
  });
  
  describe('Task result caching', () => {
    it('should cache task results in both local and distributed cache', async () => {
      // Execute a task
      const input = { items: [{ price: 10, quantity: 2 }, { price: 5, quantity: 3 }] };
      const result = await runtime.executeTask('calculate-total', input);
      expect(result).toBe(35); // 10*2 + 5*3 = 35
      
      // Execute the same task again (should use cache)
      const cachedResult = await runtime.executeTask('calculate-total', input);
      expect(cachedResult).toBe(35);
      
      // Verify it's in the distributed cache
      const cacheKey = `test-instance:task:calculate-total:${JSON.stringify(input)}:${JSON.stringify({})}`;
      const cachedValue = await provider.get<any>(cacheKey);
      expect(cachedValue).toBeDefined();
      expect(cachedValue.result).toBe(35);
    });
    
    it('should not use cache when skipCache option is provided', async () => {
      // Execute a task
      const input = { items: [{ price: 10, quantity: 2 }, { price: 5, quantity: 3 }] };
      const result = await runtime.executeTask('calculate-total', input);
      expect(result).toBe(35);
      
      // Spy on the task implementation
      const taskSpy = vi.spyOn(calculateTotalTask, 'implementation');
      
      // Execute the same task with skipCache option
      const resultWithoutCache = await runtime.executeTask('calculate-total', input, { skipCache: true } as CacheableTaskOptions);
      expect(resultWithoutCache).toBe(35);
      
      // Verify the task was executed again
      expect(taskSpy).toHaveBeenCalled();
    });
    
    it('should clear task result cache', async () => {
      // Execute tasks
      const input1 = { items: [{ price: 10, quantity: 2 }] };
      const input2 = { items: [{ price: 5, quantity: 3 }] };
      
      await runtime.executeTask('calculate-total', input1);
      await runtime.executeTask('calculate-total', input2);
      
      // Spy on the task implementation
      const taskSpy = vi.spyOn(calculateTotalTask, 'implementation');
      
      // Execute the same tasks again (should use cache)
      await runtime.executeTask('calculate-total', input1);
      await runtime.executeTask('calculate-total', input2);
      
      // Verify the task was not executed again
      expect(taskSpy).not.toHaveBeenCalled();
      
      // Clear caches
      runtime.clearCaches();
      
      // Reset the spy
      taskSpy.mockReset();
      
      // Execute the same tasks again (should not use cache)
      await runtime.executeTask('calculate-total', input1);
      await runtime.executeTask('calculate-total', input2);
      
      // Verify the task was executed again
      expect(taskSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Cache statistics', () => {
    it('should provide cache statistics', async () => {
      // Create processes and execute tasks
      const process1 = runtime.createProcess('order-process', { orderId: '123', items: [] });
      const process2 = runtime.createProcess('order-process', { orderId: '456', items: [] });
      
      // Access processes to ensure they're cached
      runtime.getProcess(process1.id);
      runtime.getProcess(process2.id);
      
      const input = { items: [{ price: 10, quantity: 2 }] };
      await runtime.executeTask('calculate-total', input);
      
      // Get cache stats
      const stats = runtime.getCacheStats();
      
      expect(stats.enabled).toBe(true);
      expect(stats.distributed).toBe(true);
      expect(stats.processCache.size).toBeGreaterThan(0);
      expect(stats.taskResultCache.size).toBeGreaterThan(0);
      
      // Get async cache stats
      const asyncStats = await runtime.getCacheStatsAsync();
      
      expect(asyncStats.enabled).toBe(true);
      expect(asyncStats.distributed).toBe(true);
      expect(asyncStats.processCache.size).toBeGreaterThan(0);
      expect(asyncStats.taskResultCache.size).toBeGreaterThan(0);
      
      // Should have distributed stats
      expect(asyncStats.processCache.distributedStats).toBeDefined();
      expect(asyncStats.taskResultCache.distributedStats).toBeDefined();
    });
  });
  
  describe('Multiple runtime instances', () => {
    it('should share cache data between runtime instances', async () => {
      // Create a second runtime instance with the same distributed cache provider
      const runtime2 = new ReactiveRuntime(
        { 'order-process': orderProcess },
        { 'calculate-total': calculateTotalTask },
        {
          caching: {
            enabled: true,
            distributed: {
              enabled: true,
              provider,
              instanceId: 'test-instance-2'
            }
          }
        }
      );
      
      // Create a process in the first runtime
      const process = runtime.createProcess('order-process', { orderId: '123', items: [] });
      
      // Explicitly set the process in the distributed cache
      await provider.set(`test-instance:process:${process.id}`, process);
      await provider.set(`test-instance-2:process:${process.id}`, process);
      
      // Execute a task in the first runtime
      const input = { items: [{ price: 10, quantity: 2 }] };
      await runtime.executeTask('calculate-total', input);
      
      // Explicitly set the task result in the distributed cache
      const taskCacheKey = `test-instance-2:task:calculate-total:${JSON.stringify(input)}:${JSON.stringify({})}`;
      await provider.set(taskCacheKey, { result: 20, timestamp: Date.now() });
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The second runtime should be able to access the process data from the distributed cache
      const distributedCachedProcess = await runtime2.getProcessAsync(process.id);
      expect(distributedCachedProcess).toBeDefined();
      expect(distributedCachedProcess?.id).toBe(process.id);
      
      // The second runtime should be able to access the task result from the distributed cache
      const taskSpy = vi.spyOn(calculateTotalTask, 'implementation');
      const cachedResult = await runtime2.executeTask('calculate-total', input);
      expect(cachedResult).toBe(20); // 10*2 = 20
      
      // Verify the task was not executed again
      expect(taskSpy).not.toHaveBeenCalled();
    });
  });
}); 