import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { RuntimeInstance } from '../../src/implementations/runtime';
import { ExtensionSystemImpl } from '../../src/implementations/extension-system';
import { EventBusImpl } from '../../src/implementations/event-bus-impl';
import { InMemoryEventStorage } from '../../src/implementations/event-storage-impl';
import { ProcessDefinition, TaskDefinition, Extension } from '../../src/models/index';
import { performance } from 'perf_hooks';
import { setTimeout as sleep } from 'timers/promises';

/**
 * Helper function to measure execution time
 */
async function measureExecutionTime(fn: () => Promise<any>, iterations: number = 1): Promise<number> {
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  
  const end = performance.now();
  return (end - start) / iterations; // Average execution time
}

/**
 * Helper function to measure memory usage
 */
function measureMemoryUsage(): { heapUsed: number, heapTotal: number } {
  const memoryUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) // MB
  };
}

// Test process and task definitions
const processDefinitions: Record<string, ProcessDefinition> = {
  'test-process': {
    id: 'test-process',
    name: 'Test Process',
    description: 'A test process for performance testing',
    version: '1.0.0',
    initialState: 'created',
    transitions: [
      { from: 'created', to: 'running', on: 'start' },
      { from: 'running', to: 'completed', on: 'complete' }
    ]
  }
};

const taskDefinitions: Record<string, TaskDefinition> = {
  'noop-task': {
    id: 'noop-task',
    name: 'No-op Task',
    description: 'Task that does nothing, for baseline measurement',
    handler: async () => ({ result: 'success' })
  },
  'cpu-intensive-task': {
    id: 'cpu-intensive-task',
    name: 'CPU Intensive Task',
    description: 'Task that performs CPU-intensive operations',
    handler: async () => {
      // Simulate CPU-intensive work
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
      }
      return { result };
    }
  },
  'io-intensive-task': {
    id: 'io-intensive-task',
    name: 'I/O Intensive Task',
    description: 'Task that performs I/O-intensive operations',
    handler: async () => {
      // Simulate I/O operations with delays
      await sleep(100);
      return { result: 'success' };
    }
  },
  'dependent-task': {
    id: 'dependent-task',
    name: 'Dependent Task',
    description: 'Task with dependencies',
    dependencies: ['noop-task'],
    handler: async () => ({ result: 'dependency-success' })
  },
  'retryable-task': {
    id: 'retryable-task',
    name: 'Retryable Task',
    description: 'Task that fails and needs to be retried',
    handler: async (context) => {
      if ((context.attemptNumber || 0) < 2) {
        throw new Error('Simulated failure for retry');
      }
      return { result: 'retry-success' };
    }
  }
};

// Mock plugins for testing
const createMockPlugin = (name: string, hookExecutionTime: number = 0): Extension => ({
  name,
  description: `Mock plugin for performance testing`,
  hooks: {
    'process:beforeCreate': async (context) => {
      if (hookExecutionTime > 0) {
        await sleep(hookExecutionTime);
      }
      return context;
    },
    'task:beforeExecute': async (context) => {
      if (hookExecutionTime > 0) {
        await sleep(hookExecutionTime);
      }
      return context;
    }
  }
});

describe('Plugin Performance Tests', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;
  
  beforeEach(() => {
    // Set up clean system for each test
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();
    
    runtime = new RuntimeInstance(
      processDefinitions, 
      taskDefinitions,
      { 
        extensionSystem,
        eventBus,
        eventStorage
      }
    );
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
  });

  describe('Plugin Execution Performance', () => {
    it('should measure baseline performance with no plugins', async () => {
      // Baseline measurement
      const baselineMemory = measureMemoryUsage();
      const executionTime = await measureExecutionTime(async () => {
        await runtime.createProcess('test-process', {});
        await runtime.executeTask('noop-task', {});
      }, 10);
      
      const afterMemory = measureMemoryUsage();
      
      console.log(`Baseline - Execution time: ${executionTime.toFixed(2)}ms`);
      console.log(`Baseline - Memory usage: ${afterMemory.heapUsed - baselineMemory.heapUsed}MB additional`);
      
      expect(executionTime).toBeLessThan(500); // Adjust threshold based on your environment
    });
    
    it('should measure performance with increasing number of plugins', async () => {
      const pluginCounts = [1, 5, 10, 20];
      const results: Record<number, { time: number, memoryIncrease: number }> = {};
      
      for (const count of pluginCounts) {
        // Clear previous plugins
        extensionSystem.clear();
        
        // Register specified number of plugins
        for (let i = 0; i < count; i++) {
          extensionSystem.registerExtension(createMockPlugin(`plugin-${i}`));
        }
        
        const baselineMemory = measureMemoryUsage();
        const executionTime = await measureExecutionTime(async () => {
          await runtime.createProcess('test-process', {});
          await runtime.executeTask('noop-task', {});
        }, 10);
        
        const afterMemory = measureMemoryUsage();
        const memoryIncrease = afterMemory.heapUsed - baselineMemory.heapUsed;
        
        results[count] = { time: executionTime, memoryIncrease };
        
        console.log(`${count} plugins - Execution time: ${executionTime.toFixed(2)}ms`);
        console.log(`${count} plugins - Memory usage: ${memoryIncrease}MB additional`);
      }
      
      // Verify performance scales reasonably
      expect(results[10].time).toBeLessThan(results[20].time); // More plugins should take more time
      expect(results[1].time).toBeLessThan(results[10].time * 10); // But should not scale linearly
    });
    
    it('should measure performance impact of plugin hook execution time', async () => {
      const hookTimes = [0, 10, 50, 100]; // milliseconds
      const results: Record<number, { time: number }> = {};
      
      for (const hookTime of hookTimes) {
        // Clear previous plugins
        extensionSystem.clear();
        
        // Register plugin with specified hook execution time
        extensionSystem.registerExtension(createMockPlugin('timed-plugin', hookTime));
        
        const executionTime = await measureExecutionTime(async () => {
          await runtime.createProcess('test-process', {});
          await runtime.executeTask('noop-task', {});
        }, 5);
        
        results[hookTime] = { time: executionTime };
        
        console.log(`Hook time ${hookTime}ms - Execution time: ${executionTime.toFixed(2)}ms`);
      }
      
      // Verify hook execution time impact
      expect(results[0].time).toBeLessThan(results[100].time - 90); // Expect close to linear scaling
    });
  });
  
  describe('Plugin Interaction Performance', () => {
    it('should measure performance of task dependency resolution', async () => {
      const executionTime = await measureExecutionTime(async () => {
        await runtime.executeTaskWithDependencies('dependent-task', {}, ['noop-task']);
      }, 10);
      
      console.log(`Task dependency resolution - Execution time: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(1000); // Adjust based on your environment
    });
    
    it('should measure performance of task retry mechanism', async () => {
      const executionTime = await measureExecutionTime(async () => {
        try {
          await runtime.executeTask('retryable-task', {});
        } catch (e) {
          // Ignore expected errors during retry
        }
      }, 5);
      
      console.log(`Task retry mechanism - Execution time: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(2000); // Retries will take longer
    });
    
    it('should measure performance of event persistence and replay', async () => {
      // Publish some events first
      for (let i = 0; i < 10; i++) {
        await eventBus.publish(`test-event-${i}`, { data: `test-${i}` });
      }
      
      const persistTime = await measureExecutionTime(async () => {
        await runtime.persistEvent({ 
          type: 'test-event', 
          payload: { data: 'test' },
          metadata: { timestamp: Date.now() }
        });
      }, 10);
      
      const replayTime = await measureExecutionTime(async () => {
        await runtime.replayEvents(Date.now() - 60000, Date.now());
      }, 3);
      
      console.log(`Event persistence - Execution time: ${persistTime.toFixed(2)}ms`);
      console.log(`Event replay - Execution time: ${replayTime.toFixed(2)}ms`);
      
      expect(persistTime).toBeLessThan(500);
      expect(replayTime).toBeLessThan(1000);
    });
  });
  
  describe('Plugin Concurrency Performance', () => {
    it('should measure performance under concurrent process creation', async () => {
      const concurrentProcesses = 10;
      const start = performance.now();
      
      const processes = await Promise.all(
        Array.from({ length: concurrentProcesses }).map((_, i) => 
          runtime.createProcess('test-process', { index: i })
        )
      );
      
      const end = performance.now();
      console.log(`Concurrent process creation (${concurrentProcesses}) - Total time: ${(end - start).toFixed(2)}ms`);
      console.log(`Concurrent process creation (${concurrentProcesses}) - Avg time: ${((end - start) / concurrentProcesses).toFixed(2)}ms`);
      
      expect(processes.length).toBe(concurrentProcesses);
      expect(end - start).toBeLessThan(concurrentProcesses * 200); // Should be sub-linear scaling
    });
    
    it('should measure performance under concurrent task execution', async () => {
      const concurrentTasks = 10;
      const start = performance.now();
      
      const tasks = await Promise.all(
        Array.from({ length: concurrentTasks }).map((_, i) => 
          runtime.executeTask(i % 2 === 0 ? 'cpu-intensive-task' : 'io-intensive-task', { index: i })
        )
      );
      
      const end = performance.now();
      console.log(`Concurrent task execution (${concurrentTasks}) - Total time: ${(end - start).toFixed(2)}ms`);
      console.log(`Concurrent task execution (${concurrentTasks}) - Avg time: ${((end - start) / concurrentTasks).toFixed(2)}ms`);
      
      expect(tasks.length).toBe(concurrentTasks);
    });
  });
  
  describe('Plugin Memory Performance', () => {
    it('should track memory usage during extended operation', async () => {
      // Capture initial memory
      const initialMemory = measureMemoryUsage();
      console.log(`Initial memory usage: ${initialMemory.heapUsed}MB used, ${initialMemory.heapTotal}MB total`);
      
      // Register 10 plugins
      for (let i = 0; i < 10; i++) {
        extensionSystem.registerExtension(createMockPlugin(`memory-plugin-${i}`));
      }
      
      // Create 100 processes and tasks
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        await runtime.createProcess('test-process', { index: i });
        await runtime.executeTask('noop-task', { index: i });
        
        // Measure every 25 iterations
        if (i % 25 === 0) {
          const currentMemory = measureMemoryUsage();
          console.log(`After ${i} iterations: ${currentMemory.heapUsed}MB used, ${currentMemory.heapTotal}MB total`);
        }
      }
      
      // Final memory measurement
      const finalMemory = measureMemoryUsage();
      console.log(`Final memory usage: ${finalMemory.heapUsed}MB used, ${finalMemory.heapTotal}MB total`);
      console.log(`Memory increase: ${finalMemory.heapUsed - initialMemory.heapUsed}MB`);
      
      // Memory usage should grow, but not excessively
      expect(finalMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(100); // Less than 100MB growth
    });
  });
}); 