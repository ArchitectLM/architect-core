import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { createExtensionSystem } from '../../src/implementations/extension-system.js';
import { createEventBus } from '../../src/implementations/event-bus.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { createRetryPlugin, RetryPlugin, BackoffStrategy } from '../../src/plugins/retry.js';

describe('Retry Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let retryPlugin: RetryPlugin;
  
  // Sample process and task definitions
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing retry functionality',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  // Create a failing task that will succeed after a certain number of attempts
  const createFlakeyTaskDefinition = (successOnAttempt = 3) => {
    const attemptCounter = { count: 0 };
    
    const handler = vi.fn().mockImplementation(async (context) => {
      attemptCounter.count++;
      
      if (attemptCounter.count < successOnAttempt) {
        throw new Error(`Task failed on attempt ${attemptCounter.count}`);
      }
      
      return { result: `Task succeeded on attempt ${attemptCounter.count}` };
    });
    
    return {
      taskDefinition: {
        id: 'flakey-task',
        name: 'Flakey Task',
        description: 'A task that fails initially but succeeds after multiple attempts',
        handler
      },
      handler,
      attemptCounter
    };
  };
  
  // Create a permanently failing task
  const createFailingTaskDefinition = () => {
    const attemptCounter = { count: 0 };
    
    const handler = vi.fn().mockImplementation(async (context) => {
      attemptCounter.count++;
      throw new Error(`Task failed on attempt ${attemptCounter.count}`);
    });
    
    return {
      taskDefinition: {
        id: 'failing-task',
        name: 'Failing Task',
        description: 'A task that always fails',
        handler
      },
      handler,
      attemptCounter
    };
  };
  
  beforeEach(() => {
    // Reset mocks and create fresh instances for each test
    vi.useFakeTimers();
    
    // Create the extension system and event bus
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin with default settings
    retryPlugin = createRetryPlugin({
      maxRetries: 3,
      retryableErrors: [Error],
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 100,
      maxDelay: 5000
    }) as RetryPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(retryPlugin);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('Basic Retry Functionality', () => {
    it('should retry failed tasks up to maxRetries', async () => {
      // Create a task that succeeds on the third attempt
      const { taskDefinition, handler } = createFlakeyTaskDefinition(3);
      
      // Create runtime with the extension system
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem, eventBus }
      );
      
      // Execute the task - it should fail twice and succeed on the third attempt
      const result = await runtime.executeTask('flakey-task', { test: true });
      
      // Advance timers for retries to complete
      vi.runAllTimers();
      
      // Handler should have been called exactly 3 times
      expect(handler).toHaveBeenCalledTimes(3);
      
      // Result should be from the successful third attempt
      expect(result.result).toContain('succeeded on attempt 3');
    });
    
    it('should fail after exceeding maxRetries', async () => {
      // Create a task that always fails
      const { taskDefinition, handler, attemptCounter } = createFailingTaskDefinition();
      
      // Create runtime with the extension system
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem, eventBus }
      );
      
      // Execute the task - it should fail after all retries
      let error;
      try {
        await runtime.executeTask('failing-task', { test: true });
        // Advance timers for retries to complete
        vi.runAllTimers();
      } catch (err) {
        error = err;
      }
      
      // Should have thrown an error
      expect(error).toBeDefined();
      
      // Handler should have been called 1 + maxRetries = 4 times
      expect(handler).toHaveBeenCalledTimes(4);
      
      // The error should indicate it was the final attempt
      expect(attemptCounter.count).toBe(4);
    });
  });
  
  describe('Backoff Strategies', () => {
    it('should respect exponential backoff', async () => {
      // Create a task that always fails for testing backoff
      const { taskDefinition } = createFailingTaskDefinition();
      
      // Create a plugin with exponential backoff
      const expBackoffPlugin = createRetryPlugin({
        maxRetries: 3,
        retryableErrors: [Error],
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        initialDelay: 100,
        maxDelay: 5000
      }) as RetryPlugin;
      
      // Create new extension system with just this plugin
      const testExtensionSystem = createExtensionSystem();
      testExtensionSystem.registerExtension(expBackoffPlugin);
      
      // Create runtime
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem: testExtensionSystem, eventBus }
      );
      
      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout;
      const setTimeoutSpy = vi.fn().mockImplementation((fn, delay) => {
        return originalSetTimeout(fn, delay);
      });
      global.setTimeout = setTimeoutSpy as any;
      
      // Execute the task (it will fail)
      try {
        await runtime.executeTask('failing-task', { test: true });
      } catch (error) {
        // Expected error
      }
      
      // Advance timers for all retries
      vi.runAllTimers();
      
      // Check that the delays followed exponential backoff
      // First retry: 100ms, Second: 200ms, Third: 400ms
      expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 100);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 200);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(3, expect.any(Function), 400);
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
    
    it('should respect linear backoff', async () => {
      // Create a task that always fails for testing backoff
      const { taskDefinition } = createFailingTaskDefinition();
      
      // Create a plugin with linear backoff
      const linearBackoffPlugin = createRetryPlugin({
        maxRetries: 3,
        retryableErrors: [Error],
        backoffStrategy: BackoffStrategy.LINEAR,
        initialDelay: 100,
        maxDelay: 5000
      }) as RetryPlugin;
      
      // Create new extension system with just this plugin
      const testExtensionSystem = createExtensionSystem();
      testExtensionSystem.registerExtension(linearBackoffPlugin);
      
      // Create runtime
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem: testExtensionSystem, eventBus }
      );
      
      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout;
      const setTimeoutSpy = vi.fn().mockImplementation((fn, delay) => {
        return originalSetTimeout(fn, delay);
      });
      global.setTimeout = setTimeoutSpy as any;
      
      // Execute the task (it will fail)
      try {
        await runtime.executeTask('failing-task', { test: true });
      } catch (error) {
        // Expected error
      }
      
      // Advance timers for all retries
      vi.runAllTimers();
      
      // Check that the delays followed linear backoff
      // First retry: 100ms, Second: 200ms, Third: 300ms
      expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 100);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 200);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(3, expect.any(Function), 300);
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
    
    it('should respect constant backoff', async () => {
      // Create a task that always fails for testing backoff
      const { taskDefinition } = createFailingTaskDefinition();
      
      // Create a plugin with constant backoff
      const constantBackoffPlugin = createRetryPlugin({
        maxRetries: 3,
        retryableErrors: [Error],
        backoffStrategy: BackoffStrategy.CONSTANT,
        initialDelay: 200,
        maxDelay: 5000
      }) as RetryPlugin;
      
      // Create new extension system with just this plugin
      const testExtensionSystem = createExtensionSystem();
      testExtensionSystem.registerExtension(constantBackoffPlugin);
      
      // Create runtime
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem: testExtensionSystem, eventBus }
      );
      
      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout;
      const setTimeoutSpy = vi.fn().mockImplementation((fn, delay) => {
        return originalSetTimeout(fn, delay);
      });
      global.setTimeout = setTimeoutSpy as any;
      
      // Execute the task (it will fail)
      try {
        await runtime.executeTask('failing-task', { test: true });
      } catch (error) {
        // Expected error
      }
      
      // Advance timers for all retries
      vi.runAllTimers();
      
      // Check that the delays were constant
      // All retries should use the same delay: 200ms
      expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 200);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 200);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(3, expect.any(Function), 200);
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });
  
  describe('Task-Specific Retry Configuration', () => {
    it('should allow task-specific retry settings', async () => {
      // Create a task that always fails
      const { taskDefinition, handler } = createFailingTaskDefinition();
      
      // Create runtime with the extension system
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem, eventBus }
      );
      
      // Set task-specific retry settings
      retryPlugin.setTaskRetryOptions('failing-task', {
        maxRetries: 1, // Only retry once
        backoffStrategy: BackoffStrategy.CONSTANT,
        initialDelay: 50
      });
      
      // Execute the task
      try {
        await runtime.executeTask('failing-task', { test: true });
        vi.runAllTimers();
      } catch (error) {
        // Expected error
      }
      
      // Handler should have been called 1 + maxRetries = 2 times
      // (instead of the default 4 times)
      expect(handler).toHaveBeenCalledTimes(2);
    });
    
    it('should allow disabling retries for specific tasks', async () => {
      // Create a task that always fails
      const { taskDefinition, handler } = createFailingTaskDefinition();
      
      // Create runtime with the extension system
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem, eventBus }
      );
      
      // Disable retries for this task
      retryPlugin.setTaskRetryOptions('failing-task', {
        disabled: true
      });
      
      // Execute the task
      try {
        await runtime.executeTask('failing-task', { test: true });
      } catch (error) {
        // Expected error
      }
      
      // Handler should have been called only once (no retries)
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Retry Analytics', () => {
    it('should track retry statistics', async () => {
      // Create a task that succeeds on the third attempt
      const { taskDefinition } = createFlakeyTaskDefinition(3);
      
      // Create runtime with the extension system
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem, eventBus }
      );
      
      // Execute the task - it should fail twice and succeed on the third attempt
      await runtime.executeTask('flakey-task', { test: true });
      vi.runAllTimers();
      
      // Get retry statistics
      const stats = retryPlugin.getRetryStats('flakey-task');
      
      // Should have recorded two retries
      expect(stats).toBeDefined();
      expect(stats.retryCount).toBe(2);
      expect(stats.successAfterRetry).toBe(1);
      expect(stats.failureAfterRetry).toBe(0);
    });
    
    it('should track retry failures', async () => {
      // Create a task that always fails
      const { taskDefinition } = createFailingTaskDefinition();
      
      // Create runtime with the extension system
      runtime = createRuntime(
        { [testProcessDefinition.id]: testProcessDefinition },
        { [taskDefinition.id]: taskDefinition },
        { extensionSystem, eventBus }
      );
      
      // Execute the task - it should fail after all retries
      try {
        await runtime.executeTask('failing-task', { test: true });
        vi.runAllTimers();
      } catch (error) {
        // Expected error
      }
      
      // Get retry statistics
      const stats = retryPlugin.getRetryStats('failing-task');
      
      // Should have recorded the failed retries
      expect(stats).toBeDefined();
      expect(stats.retryCount).toBe(3);
      expect(stats.successAfterRetry).toBe(0);
      expect(stats.failureAfterRetry).toBe(1);
    });
  });
}); 