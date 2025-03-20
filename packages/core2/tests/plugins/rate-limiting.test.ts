import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { createExtensionSystem } from '../../src/implementations/extension-system.js';
import { createEventBus } from '../../src/implementations/event-bus.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { createRateLimitingPlugin, RateLimitingPlugin } from '../../src/plugins/rate-limiting.js';

describe('Rate Limiting Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let rateLimitingPlugin: RateLimitingPlugin;
  
  // Sample process and task definitions
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing rate limiting',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  const testTaskDefinition: TaskDefinition = {
    id: 'test-task',
    name: 'Test Task',
    description: 'A task for testing rate limiting',
    handler: async (context) => {
      return { result: 'Task completed' };
    }
  };
  
  beforeEach(() => {
    // Use fake timers for time-based testing
    vi.useFakeTimers();
    
    // Create the extension system and event bus
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin
    rateLimitingPlugin = createRateLimitingPlugin({
      defaultLimit: {
        tokensPerInterval: 5,  // Allow 5 executions
        interval: 1000,        // Per second
        burstLimit: 2          // With a burst of 2 extra (7 total)
      }
    }) as RateLimitingPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(rateLimitingPlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [testTaskDefinition.id]: testTaskDefinition
    };
    
    runtime = createRuntime(
      processDefinitions, 
      taskDefinitions, 
      { extensionSystem, eventBus }
    );
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('Basic Rate Limiting', () => {
    it('should allow requests up to the rate limit', async () => {
      // Execute tasks up to the defined limit (5 + 2 burst)
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      
      // All 7 should complete without being rate limited
      await expect(Promise.all(promises)).resolves.toHaveLength(7);
    });
    
    it('should reject requests that exceed the rate limit', async () => {
      // Execute tasks up to the limit
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      
      // Let all complete
      await Promise.all(promises);
      
      // The next one should be rate limited
      await expect(runtime.executeTask('test-task', {})).rejects.toThrow(/Rate limit exceeded/);
    });
    
    it('should replenish tokens over time', async () => {
      // Use up all tokens
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Advance time by 200ms (should replenish 1 token)
      vi.advanceTimersByTime(200);
      
      // Should be able to execute one more task
      await runtime.executeTask('test-task', {});
      
      // But not two
      await expect(runtime.executeTask('test-task', {})).rejects.toThrow(/Rate limit exceeded/);
      
      // Advance time to replenish more tokens
      vi.advanceTimersByTime(1000); // Full replenishment of 5 more tokens
      
      // Should be able to execute 5 more tasks
      const morePromises = [];
      for (let i = 0; i < 5; i++) {
        morePromises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(morePromises);
    });
  });
  
  describe('Task-Specific Rate Limits', () => {
    it('should apply different limits to different tasks', async () => {
      // Add a second task definition
      const highPriorityTaskDefinition: TaskDefinition = {
        id: 'high-priority-task',
        name: 'High Priority Task',
        description: 'A task with higher rate limits',
        handler: async () => {
          return { result: 'High priority task completed' };
        }
      };
      
      (runtime as any).taskDefinitions.set('high-priority-task', highPriorityTaskDefinition);
      
      // Set a higher limit for the high priority task
      rateLimitingPlugin.setTaskRateLimit('high-priority-task', {
        tokensPerInterval: 20,
        interval: 1000,
        burstLimit: 5
      });
      
      // Use up all tokens for the regular task
      const regularPromises = [];
      for (let i = 0; i < 7; i++) {
        regularPromises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(regularPromises);
      
      // Regular task should be limited
      await expect(runtime.executeTask('test-task', {})).rejects.toThrow(/Rate limit exceeded/);
      
      // But high priority task should still work
      const highPriorityPromises = [];
      for (let i = 0; i < 20; i++) {
        highPriorityPromises.push(runtime.executeTask('high-priority-task', {}));
      }
      await Promise.all(highPriorityPromises);
    });
    
    it('should allow disabling rate limiting for specific tasks', async () => {
      // Add an unlimited task
      const unlimitedTaskDefinition: TaskDefinition = {
        id: 'unlimited-task',
        name: 'Unlimited Task',
        description: 'A task with no rate limits',
        handler: async () => {
          return { result: 'Unlimited task completed' };
        }
      };
      
      (runtime as any).taskDefinitions.set('unlimited-task', unlimitedTaskDefinition);
      
      // Disable rate limiting for this task
      rateLimitingPlugin.setTaskRateLimit('unlimited-task', {
        disabled: true
      });
      
      // Execute a large number of unlimited tasks
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(runtime.executeTask('unlimited-task', {}));
      }
      
      // All should complete without being rate limited
      await expect(Promise.all(promises)).resolves.toHaveLength(100);
    });
  });
  
  describe('Rate Limit Management', () => {
    it('should provide rate limit statistics', async () => {
      // Execute several tasks
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Get statistics for the task
      const stats = rateLimitingPlugin.getRateLimitStats('test-task');
      
      // Check statistics
      expect(stats).toBeDefined();
      expect(stats.tokensRemaining).toBe(2); // 5 used out of 7 (5+2 burst)
      expect(stats.totalExecutions).toBe(5);
      expect(stats.rejections).toBe(0);
    });
    
    it('should count rejections in statistics', async () => {
      // Use all tokens
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Try to execute more and expect rejection
      try {
        await runtime.executeTask('test-task', {});
      } catch (error) {
        // Expected error
      }
      
      try {
        await runtime.executeTask('test-task', {});
      } catch (error) {
        // Expected error
      }
      
      // Check statistics
      const stats = rateLimitingPlugin.getRateLimitStats('test-task');
      expect(stats.rejections).toBe(2);
    });
    
    it('should allow resetting rate limiters', async () => {
      // Use all tokens
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(runtime.executeTask('test-task', {}));
      }
      await Promise.all(promises);
      
      // Reset the rate limiter
      rateLimitingPlugin.resetRateLimiter('test-task');
      
      // Should be able to execute more tasks
      const morePromises = [];
      for (let i = 0; i < 7; i++) {
        morePromises.push(runtime.executeTask('test-task', {}));
      }
      
      // All should complete without being rate limited
      await expect(Promise.all(morePromises)).resolves.toHaveLength(7);
    });
  });
}); 