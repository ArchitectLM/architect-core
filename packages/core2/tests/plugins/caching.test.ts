import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { createRuntime } from '../../src/factories';
import { createExtensionSystemInstance } from '../../src/factories';
import { createEventBusInstance } from '../../src/factories';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index';
import { createCachingPlugin, CachingPlugin } from '../../src/plugins/caching';

describe('Caching Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystemInstance();
  let eventBus = createEventBusInstance();
  let cachingPlugin: CachingPlugin;
  
  // Sample process and task definitions
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing caching',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  // A task with a spy to track execution count
  const expensiveTaskHandler = vi.fn().mockImplementation(async (context) => {
    return { result: `Expensive computation result: ${context.input.value}` };
  });
  
  const expensiveTaskDefinition: TaskDefinition = {
    id: 'expensive-task',
    name: 'Expensive Task',
    description: 'A computationally expensive task that should be cached',
    handler: expensiveTaskHandler
  };
  
  // A task that should not be cached (dynamic result)
  const dynamicTaskHandler = vi.fn().mockImplementation(async (context) => {
    return { result: `Dynamic result: ${Date.now()}` };
  });
  
  const dynamicTaskDefinition: TaskDefinition = {
    id: 'dynamic-task',
    name: 'Dynamic Task',
    description: 'A task with dynamic results that should not be cached',
    handler: dynamicTaskHandler
  };
  
  beforeEach(() => {
    // Reset mocks and create fresh instances for each test
    vi.resetAllMocks();
    
    // Create the extension system and event bus
    extensionSystem = createExtensionSystemInstance();
    eventBus = createEventBusInstance();
    
    // Create the plugin
    cachingPlugin = createCachingPlugin({
      defaultTTL: 60000, // 1 minute cache TTL
      maxSize: 100       // Maximum 100 items in cache
    }) as CachingPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(cachingPlugin);
    
    // Create runtime with the extension system and task definitions
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [expensiveTaskDefinition.id]: expensiveTaskDefinition,
      [dynamicTaskDefinition.id]: dynamicTaskDefinition
    };
    
    runtime = createRuntime(
      processDefinitions, 
      taskDefinitions, 
      { extensionSystem, eventBus }
    );
  });
  
  describe('Task Result Caching', () => {
    it('should cache task results based on task type and input', async () => {
      // First execution - no cache hit
      const result1 = await runtime.executeTask('expensive-task', { value: 42 });
      
      // Second execution with same input - should use cache
      const result2 = await runtime.executeTask('expensive-task', { value: 42 });
      
      // Verify the task handler was called only once
      expect(expensiveTaskHandler).toHaveBeenCalledTimes(1);
      
      // Verify the results are identical
      expect(result1).toEqual(result2);
    });
    
    it('should use different cache entries for different inputs', async () => {
      // Execute with first input
      await runtime.executeTask('expensive-task', { value: 1 });
      
      // Execute with second input
      await runtime.executeTask('expensive-task', { value: 2 });
      
      // Both should execute the task handler
      expect(expensiveTaskHandler).toHaveBeenCalledTimes(2);
    });
    
    it('should respect TTL and expire cache entries', async () => {
      // Mock the date
      const originalNow = Date.now;
      global.Date.now = vi.fn(() => 1000);
      
      // Create a plugin with short TTL for testing
      const shortTTLPlugin = createCachingPlugin({
        defaultTTL: 100, // 100ms TTL
        maxSize: 10
      }) as CachingPlugin;
      
      // Register with a new extension system
      const newExtensionSystem = createExtensionSystemInstance();
      newExtensionSystem.registerExtension(shortTTLPlugin);
      
      // Create a new runtime
      const newRuntime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition }, 
        { [expensiveTaskDefinition.id]: expensiveTaskDefinition }, 
        { extensionSystem: newExtensionSystem, eventBus }
      );
      
      // First execution at t=1000
      await newRuntime.executeTask('expensive-task', { value: 42 });
      
      // Move time forward but still within TTL
      (global.Date.now as vi.Mock).mockReturnValue(1050);
      
      // Second execution should use cache
      await newRuntime.executeTask('expensive-task', { value: 42 });
      
      // Move time forward beyond TTL
      (global.Date.now as vi.Mock).mockReturnValue(1150);
      
      // Third execution should execute handler again
      await newRuntime.executeTask('expensive-task', { value: 42 });
      
      // Restore Date.now
      global.Date.now = originalNow;
      
      // Handler should be called twice (first and third executions)
      expect(expensiveTaskHandler).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Cache Configuration', () => {
    it('should respect task-specific caching options', async () => {
      // Mark the dynamic task as non-cacheable using metadata
      cachingPlugin.setTaskCacheOptions('dynamic-task', {
        cacheable: false
      });
      
      // Execute the dynamic task twice
      await runtime.executeTask('dynamic-task', { value: 42 });
      await runtime.executeTask('dynamic-task', { value: 42 });
      
      // Handler should be called twice
      expect(dynamicTaskHandler).toHaveBeenCalledTimes(2);
    });
    
    it('should set different TTLs for different tasks', async () => {
      // Mock the date
      const originalNow = Date.now;
      global.Date.now = vi.fn(() => 1000);
      
      // Set custom TTL for expensive task
      cachingPlugin.setTaskCacheOptions('expensive-task', {
        ttl: 500 // 500ms TTL
      });
      
      // First execution
      await runtime.executeTask('expensive-task', { value: 123 });
      
      // Move time forward but within TTL
      (global.Date.now as vi.Mock).mockReturnValue(1400);
      
      // Should use cache
      await runtime.executeTask('expensive-task', { value: 123 });
      
      // Move beyond TTL
      (global.Date.now as vi.Mock).mockReturnValue(1600);
      
      // Should execute again
      await runtime.executeTask('expensive-task', { value: 123 });
      
      // Restore Date.now
      global.Date.now = originalNow;
      
      // Handler should be called twice
      expect(expensiveTaskHandler).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Cache Management', () => {
    it('should allow manual cache invalidation', async () => {
      // First execution
      await runtime.executeTask('expensive-task', { value: 42 });
      
      // Invalidate the cache for this task and input
      cachingPlugin.invalidate('expensive-task', { value: 42 });
      
      // Second execution
      await runtime.executeTask('expensive-task', { value: 42 });
      
      // Handler should be called twice
      expect(expensiveTaskHandler).toHaveBeenCalledTimes(2);
    });
    
    it('should allow clearing the entire cache', async () => {
      // Execute multiple tasks
      await runtime.executeTask('expensive-task', { value: 1 });
      await runtime.executeTask('expensive-task', { value: 2 });
      
      // Clear the cache
      cachingPlugin.clear();
      
      // Execute the same tasks again
      await runtime.executeTask('expensive-task', { value: 1 });
      await runtime.executeTask('expensive-task', { value: 2 });
      
      // Handler should be called 4 times total
      expect(expensiveTaskHandler).toHaveBeenCalledTimes(4);
    });
    
    it('should enforce the maximum cache size', async () => {
      // Create a plugin with small max size
      const smallCachePlugin = createCachingPlugin({
        defaultTTL: 60000,
        maxSize: 2
      }) as CachingPlugin;
      
      // Register with a new extension system
      const newExtensionSystem = createExtensionSystemInstance();
      newExtensionSystem.registerExtension(smallCachePlugin);
      
      // Create a new runtime
      const newRuntime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition }, 
        { [expensiveTaskDefinition.id]: expensiveTaskDefinition }, 
        { extensionSystem: newExtensionSystem, eventBus }
      );
      
      // Execute 3 different tasks
      await newRuntime.executeTask('expensive-task', { value: 1 });
      await newRuntime.executeTask('expensive-task', { value: 2 });
      await newRuntime.executeTask('expensive-task', { value: 3 });
      
      // Reset the spy to focus on the next calls
      expensiveTaskHandler.mockClear();
      
      // Execute the tasks again
      await newRuntime.executeTask('expensive-task', { value: 1 }); // Should miss (evicted)
      await newRuntime.executeTask('expensive-task', { value: 2 }); // Should hit
      await newRuntime.executeTask('expensive-task', { value: 3 }); // Should hit
      
      // Only the first value should have been evicted and recomputed
      expect(expensiveTaskHandler).toHaveBeenCalledTimes(1);
      expect(expensiveTaskHandler).toHaveBeenCalledWith(expect.objectContaining({ input: { value: 1 } }));
    });
  });
}); 