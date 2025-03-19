import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { createExtensionSystem } from '../../src/implementations/extension-system.js';
import { createEventBus } from '../../src/implementations/event-bus.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { 
  createTaskPrioritizationPlugin, 
  TaskPrioritizationPlugin,
  Priority,
  SchedulingPolicy
} from '../../src/plugins/task-prioritization.js';

describe('Task Prioritization Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let prioritizationPlugin: TaskPrioritizationPlugin;
  
  // Mock current time for testing
  const mockNow = new Date('2023-01-01T12:00:00Z').getTime();
  
  // Keep track of task execution order
  let executionOrder: string[] = [];
  
  // Sample process definition
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing task prioritization',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  // Task definitions for testing different priorities
  const createTrackedTaskDefinition = (id: string, executionTime = 10): TaskDefinition => ({
    id,
    name: `${id} Task`,
    description: `A task for testing prioritization`,
    handler: vi.fn().mockImplementation(async (context) => {
      // Record this task's execution
      executionOrder.push(id);
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, executionTime));
      
      return { result: `${id} executed` };
    })
  });
  
  // Initialize tasks with different priorities and execution times
  const highPriorityTask = createTrackedTaskDefinition('high-priority-task', 20);
  const mediumPriorityTask = createTrackedTaskDefinition('medium-priority-task', 30);
  const lowPriorityTask = createTrackedTaskDefinition('low-priority-task', 10);
  const criticalTask = createTrackedTaskDefinition('critical-task', 5);
  const deadlineTask = createTrackedTaskDefinition('deadline-task', 15);
  const longRunningTask = createTrackedTaskDefinition('long-running-task', 100);
  
  beforeEach(() => {
    // Reset execution tracking
    executionOrder = [];
    
    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow);
    
    // Create fresh instances for each test
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin with default settings
    prioritizationPlugin = createTaskPrioritizationPlugin({
      defaultPriority: Priority.MEDIUM,
      defaultPolicy: SchedulingPolicy.FIFO,
      maxConcurrentTasks: 2,  // Allow 2 concurrent tasks for testing
      enablePreemption: false
    }) as TaskPrioritizationPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(prioritizationPlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [highPriorityTask.id]: highPriorityTask,
      [mediumPriorityTask.id]: mediumPriorityTask,
      [lowPriorityTask.id]: lowPriorityTask,
      [criticalTask.id]: criticalTask,
      [deadlineTask.id]: deadlineTask,
      [longRunningTask.id]: longRunningTask
    };
    
    runtime = createRuntime(
      processDefinitions, 
      taskDefinitions, 
      { extensionSystem, eventBus }
    );
    
    // Reset mock function call counts
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  describe('Priority-Based Execution', () => {
    it('should execute tasks in priority order when all submitted at once', async () => {
      // Configure task priorities
      prioritizationPlugin.setTaskPriority(highPriorityTask.id, Priority.HIGH);
      prioritizationPlugin.setTaskPriority(mediumPriorityTask.id, Priority.MEDIUM);
      prioritizationPlugin.setTaskPriority(lowPriorityTask.id, Priority.LOW);
      
      // Force execution to be sequential for testing
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Submit tasks
      const promises = [
        runtime.executeTask(lowPriorityTask.id, { data: 'low' }),
        runtime.executeTask(mediumPriorityTask.id, { data: 'medium' }),
        runtime.executeTask(highPriorityTask.id, { data: 'high' })
      ];
      
      // Wait for all tasks to complete
      await Promise.all(promises);
      
      // Should have executed in priority order: high, medium, low
      expect(executionOrder).toEqual([
        highPriorityTask.id, 
        mediumPriorityTask.id, 
        lowPriorityTask.id
      ]);
    });
    
    it('should respect the critical priority level', async () => {
      // Configure task priorities
      prioritizationPlugin.setTaskPriority(criticalTask.id, Priority.CRITICAL);
      prioritizationPlugin.setTaskPriority(highPriorityTask.id, Priority.HIGH);
      
      // Long-running task will start first
      const longRunningPromise = runtime.executeTask(longRunningTask.id, { data: 'long' });
      
      // Wait a bit for the long-running task to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Submit high priority and critical tasks
      const highPromise = runtime.executeTask(highPriorityTask.id, { data: 'high' });
      const criticalPromise = runtime.executeTask(criticalTask.id, { data: 'critical' });
      
      // Wait for all tasks to complete
      await Promise.all([longRunningPromise, highPromise, criticalPromise]);
      
      // Critical task should execute before high priority, even though it was submitted later
      expect(executionOrder.indexOf(criticalTask.id)).toBeLessThan(
        executionOrder.indexOf(highPriorityTask.id)
      );
    });
  });
  
  describe('Scheduling Policies', () => {
    it('should support FIFO scheduling policy', async () => {
      // Set all tasks to the same priority to test FIFO policy
      prioritizationPlugin.setTaskPriority(highPriorityTask.id, Priority.MEDIUM);
      prioritizationPlugin.setTaskPriority(mediumPriorityTask.id, Priority.MEDIUM);
      prioritizationPlugin.setTaskPriority(lowPriorityTask.id, Priority.MEDIUM);
      
      // Set FIFO policy
      prioritizationPlugin.setSchedulingPolicy(SchedulingPolicy.FIFO);
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Submit tasks in a specific order
      const promises = [
        runtime.executeTask(highPriorityTask.id, { data: 'first' }),
        runtime.executeTask(mediumPriorityTask.id, { data: 'second' }),
        runtime.executeTask(lowPriorityTask.id, { data: 'third' })
      ];
      
      // Wait for all tasks to complete
      await Promise.all(promises);
      
      // Should execute in submission order
      expect(executionOrder).toEqual([
        highPriorityTask.id, 
        mediumPriorityTask.id, 
        lowPriorityTask.id
      ]);
    });
    
    it('should support Shortest Job First (SJF) scheduling policy', async () => {
      // Configure task priorities to be the same
      prioritizationPlugin.setTaskPriority(highPriorityTask.id, Priority.MEDIUM);
      prioritizationPlugin.setTaskPriority(mediumPriorityTask.id, Priority.MEDIUM);
      prioritizationPlugin.setTaskPriority(lowPriorityTask.id, Priority.MEDIUM);
      
      // Configure estimated execution times
      prioritizationPlugin.setTaskExecutionTime(highPriorityTask.id, 20);  // 20ms
      prioritizationPlugin.setTaskExecutionTime(mediumPriorityTask.id, 30); // 30ms
      prioritizationPlugin.setTaskExecutionTime(lowPriorityTask.id, 10);   // 10ms
      
      // Set SJF policy
      prioritizationPlugin.setSchedulingPolicy(SchedulingPolicy.SHORTEST_JOB_FIRST);
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Submit tasks
      const promises = [
        runtime.executeTask(highPriorityTask.id, { data: 'medium-length' }),
        runtime.executeTask(mediumPriorityTask.id, { data: 'longest' }),
        runtime.executeTask(lowPriorityTask.id, { data: 'shortest' })
      ];
      
      // Wait for all tasks to complete
      await Promise.all(promises);
      
      // Should execute in order of execution time (shortest first)
      expect(executionOrder).toEqual([
        lowPriorityTask.id,    // Shortest (10ms)
        highPriorityTask.id,   // Medium (20ms)
        mediumPriorityTask.id  // Longest (30ms)
      ]);
    });
    
    it('should support deadline-based scheduling policy', async () => {
      // Set up deadlines
      const now = Date.now();
      prioritizationPlugin.setTaskDeadline(highPriorityTask.id, now + 50);   // 50ms from now
      prioritizationPlugin.setTaskDeadline(mediumPriorityTask.id, now + 100); // 100ms from now
      prioritizationPlugin.setTaskDeadline(deadlineTask.id, now + 30);       // 30ms from now
      
      // Set EDF policy
      prioritizationPlugin.setSchedulingPolicy(SchedulingPolicy.EARLIEST_DEADLINE_FIRST);
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Submit tasks
      const promises = [
        runtime.executeTask(highPriorityTask.id, { data: 'medium-deadline' }),
        runtime.executeTask(mediumPriorityTask.id, { data: 'long-deadline' }),
        runtime.executeTask(deadlineTask.id, { data: 'urgent-deadline' })
      ];
      
      // Wait for all tasks to complete
      await Promise.all(promises);
      
      // Should execute in order of deadlines (earliest first)
      expect(executionOrder).toEqual([
        deadlineTask.id,      // Earliest deadline (now + 30ms)
        highPriorityTask.id,  // Medium deadline (now + 50ms)
        mediumPriorityTask.id // Latest deadline (now + 100ms)
      ]);
    });
  });
  
  describe('Concurrency Management', () => {
    it('should limit the number of concurrent tasks', async () => {
      // Use fake timers to control task execution
      vi.useFakeTimers();
      
      // Set max concurrent tasks to 2
      prioritizationPlugin.setMaxConcurrentTasks(2);
      
      // Start 3 tasks
      const task1Promise = runtime.executeTask(highPriorityTask.id, { data: '1' });
      const task2Promise = runtime.executeTask(mediumPriorityTask.id, { data: '2' });
      const task3Promise = runtime.executeTask(lowPriorityTask.id, { data: '3' });
      
      // After a small delay, only 2 tasks should have started
      await vi.advanceTimersByTimeAsync(5);
      
      // Only 2 tasks should be executing
      expect(executionOrder.length).toBe(2);
      
      // Complete the first task
      await vi.advanceTimersByTimeAsync(20);
      
      // Now the third task should start
      await vi.advanceTimersByTimeAsync(5);
      
      // All 3 tasks should have started
      expect(executionOrder.length).toBe(3);
      
      // Complete all tasks
      await vi.runAllTimersAsync();
      await Promise.all([task1Promise, task2Promise, task3Promise]);
    });
    
    it('should handle task waiting and resumption', async () => {
      // Use fake timers for control
      vi.useFakeTimers();
      
      // Set max concurrent tasks to 1 for simple testing
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Set high priority for one task
      prioritizationPlugin.setTaskPriority(highPriorityTask.id, Priority.HIGH);
      prioritizationPlugin.setTaskPriority(lowPriorityTask.id, Priority.LOW);
      
      // Start a low priority task
      const lowPriorityPromise = runtime.executeTask(lowPriorityTask.id, { data: 'low' });
      
      // Wait a bit for the task to start
      await vi.advanceTimersByTimeAsync(5);
      
      // Submit a high priority task
      const highPriorityPromise = runtime.executeTask(highPriorityTask.id, { data: 'high' });
      
      // Low priority task should complete since preemption is disabled by default
      await vi.advanceTimersByTimeAsync(10);
      
      // Now high priority task should start
      await vi.advanceTimersByTimeAsync(20);
      
      // Check execution order
      expect(executionOrder).toEqual([lowPriorityTask.id, highPriorityTask.id]);
      
      // Complete all tasks
      await vi.runAllTimersAsync();
      await Promise.all([lowPriorityPromise, highPriorityPromise]);
    });
  });
  
  describe('Preemption', () => {
    it('should support preemptive scheduling for high priority tasks', async () => {
      // Enable preemption
      prioritizationPlugin.enablePreemption(true);
      
      // Set priorities
      prioritizationPlugin.setTaskPriority(highPriorityTask.id, Priority.HIGH);
      prioritizationPlugin.setTaskPriority(lowPriorityTask.id, Priority.LOW);
      
      // Set max concurrent tasks to 1
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Create a long-running low priority task with progress tracking
      let lowTaskProgress = 0;
      const longLowPriorityTask: TaskDefinition = {
        id: 'long-low-priority-task',
        name: 'Long Low Priority Task',
        description: 'A long-running low priority task',
        handler: vi.fn().mockImplementation(async (context) => {
          executionOrder.push('long-low-start');
          
          // This will track if we get preempted and resumed
          try {
            await new Promise<void>((resolve, reject) => {
              const interval = setInterval(() => {
                lowTaskProgress += 10;
                if (lowTaskProgress >= 100) {
                  clearInterval(interval);
                  resolve();
                }
              }, 10);
              
              // Add ability to cancel this promise
              context.cancellation = {
                cancel: () => {
                  clearInterval(interval);
                  reject(new Error('Task preempted'));
                }
              };
            });
            
            executionOrder.push('long-low-complete');
            return { success: true };
          } catch (error) {
            executionOrder.push('long-low-preempted');
            throw error;
          }
        })
      };
      
      // Register the task
      (runtime as any).taskDefinitions[longLowPriorityTask.id] = longLowPriorityTask;
      
      // Start the long-running low priority task
      const lowPriorityPromise = runtime.executeTask(longLowPriorityTask.id, { data: 'low' });
      
      // Wait a bit for the task to start
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Now submit a high priority task
      const highPriorityPromise = runtime.executeTask(highPriorityTask.id, { data: 'high' });
      
      // Wait for high priority task to complete
      await highPriorityPromise;
      
      // Catch the error from the preempted task
      try {
        await lowPriorityPromise;
      } catch (error) {
        // Expected error
      }
      
      // Verify the execution order - low priority should have started, then been preempted,
      // then high priority should have executed
      expect(executionOrder).toContain('long-low-start');
      expect(executionOrder).toContain('long-low-preempted');
      expect(executionOrder).toContain(highPriorityTask.id);
      
      // High priority should have executed after preemption
      expect(executionOrder.indexOf('long-low-preempted')).toBeLessThan(
        executionOrder.indexOf(highPriorityTask.id)
      );
    });
    
    it('should only preempt tasks with significantly lower priority', async () => {
      // Enable preemption
      prioritizationPlugin.enablePreemption(true);
      
      // Set task priorities
      prioritizationPlugin.setTaskPriority(criticalTask.id, Priority.CRITICAL);
      prioritizationPlugin.setTaskPriority(highPriorityTask.id, Priority.HIGH);
      prioritizationPlugin.setTaskPriority(mediumPriorityTask.id, Priority.MEDIUM);
      
      // Force sequential execution for testing
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Start with a high priority task
      const highPromise = runtime.executeTask(highPriorityTask.id, { data: 'high' });
      
      // Wait for task to start
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Submit a medium priority task (should not preempt high priority)
      const mediumPromise = runtime.executeTask(mediumPriorityTask.id, { data: 'medium' });
      
      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Submit a critical task (should preempt high priority)
      const criticalPromise = runtime.executeTask(criticalTask.id, { data: 'critical' });
      
      // Wait for all tasks to finish (may fail for preempted tasks)
      try {
        await Promise.all([highPromise, mediumPromise, criticalPromise]);
      } catch (error) {
        // Expected preemption errors
      }
      
      // Critical should interrupt the high priority task
      expect(executionOrder.indexOf(criticalTask.id)).toBeLessThan(executionOrder.length - 1);
      
      // Medium should not interrupt anything
      expect(executionOrder.indexOf(mediumPriorityTask.id)).toBeGreaterThan(
        executionOrder.indexOf(criticalTask.id)
      );
    });
  });
  
  describe('Dynamic Priority Adjustment', () => {
    it('should support dynamic priority boosting', async () => {
      // Set initial priorities
      prioritizationPlugin.setTaskPriority(mediumPriorityTask.id, Priority.MEDIUM);
      prioritizationPlugin.setTaskPriority(lowPriorityTask.id, Priority.LOW);
      
      // Enable priority aging (boost priority of waiting tasks)
      prioritizationPlugin.enablePriorityAging({
        waitingTimeThreshold: 50,  // ms
        boostAmount: 1  // boost by one level after threshold
      });
      
      // Force sequential execution
      prioritizationPlugin.setMaxConcurrentTasks(1);
      
      // Submit low priority task first
      const lowPriorityPromise = runtime.executeTask(lowPriorityTask.id, { data: 'low' });
      
      // Wait for it to start
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Submit medium priority task
      const mediumPriorityPromise = runtime.executeTask(mediumPriorityTask.id, { data: 'medium' });
      
      // Wait for them to complete
      await Promise.all([lowPriorityPromise, mediumPriorityPromise]);
      
      // Low priority should execute first because it was already running
      expect(executionOrder[0]).toBe(lowPriorityTask.id);
      expect(executionOrder[1]).toBe(mediumPriorityTask.id);
      
      // Reset execution order for next test
      executionOrder = [];
      
      // Now submit medium first but make it take longer
      const longMediumPromise = runtime.executeTask(mediumPriorityTask.id, { data: 'medium-long' });
      
      // Wait for it to start
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Submit low priority task
      const lowPriorityPromise2 = runtime.executeTask(lowPriorityTask.id, { data: 'low' });
      
      // Wait for tasks to be in progress
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Simulate priority aging by manually advancing the clock
      vi.advanceTimersByTime(51);
      
      // Signal that a task has completed to trigger queue reassessment
      eventBus.publish('task:completed', { taskId: 'dummy' });
      
      // Wait for completion
      await Promise.all([longMediumPromise, lowPriorityPromise2]);
      
      // Get final priorities from plugin
      const finalLowPriority = prioritizationPlugin.getTaskPriority(lowPriorityTask.id);
      
      // Low priority should have been boosted
      expect(finalLowPriority).toBe(Priority.MEDIUM);
    });
  });
  
  describe('Task Grouping and Affinity', () => {
    it('should support task group scheduling', async () => {
      // Create task group
      prioritizationPlugin.createTaskGroup('database-tasks', { 
        priority: Priority.HIGH,
        maxConcurrent: 1  // Only allow one database task at a time
      });
      
      // Assign tasks to the group
      prioritizationPlugin.assignTaskToGroup(highPriorityTask.id, 'database-tasks');
      prioritizationPlugin.assignTaskToGroup(mediumPriorityTask.id, 'database-tasks');
      
      // Allow 2 concurrent tasks overall
      prioritizationPlugin.setMaxConcurrentTasks(2);
      
      // Submit database tasks and a non-database task
      const highPromise = runtime.executeTask(highPriorityTask.id, { data: 'db1' });
      const mediumPromise = runtime.executeTask(mediumPriorityTask.id, { data: 'db2' });
      const lowPromise = runtime.executeTask(lowPriorityTask.id, { data: 'non-db' });
      
      // Wait for tasks to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Two tasks should be running, but only one database task
      const runningTasks = prioritizationPlugin.getRunningTasks();
      expect(runningTasks.length).toBeGreaterThanOrEqual(2);
      
      const runningDbTasks = runningTasks.filter(taskId => 
        taskId === highPriorityTask.id || taskId === mediumPriorityTask.id
      );
      expect(runningDbTasks.length).toBe(1);
      
      // Wait for all tasks to complete
      await Promise.all([highPromise, mediumPromise, lowPromise]);
      
      // The second database task should have started after the first one finished
      const dbTaskExecutionOrder = executionOrder.filter(taskId => 
        taskId === highPriorityTask.id || taskId === mediumPriorityTask.id
      );
      expect(dbTaskExecutionOrder.length).toBe(2);
    });
    
    it('should support resource affinity scheduling', async () => {
      // Define resources
      prioritizationPlugin.defineResource('cpu-intensive', 2); // 2 CPU slots
      prioritizationPlugin.defineResource('memory-intensive', 1); // 1 memory slot
      
      // Assign resource requirements to tasks
      prioritizationPlugin.setTaskResourceRequirements(highPriorityTask.id, { 'cpu-intensive': 1 });
      prioritizationPlugin.setTaskResourceRequirements(mediumPriorityTask.id, { 'cpu-intensive': 1 });
      prioritizationPlugin.setTaskResourceRequirements(lowPriorityTask.id, { 'memory-intensive': 1 });
      
      // Submit tasks
      const highPromise = runtime.executeTask(highPriorityTask.id, { data: 'cpu1' });
      const mediumPromise = runtime.executeTask(mediumPriorityTask.id, { data: 'cpu2' });
      const lowPromise = runtime.executeTask(lowPriorityTask.id, { data: 'memory' });
      const extraCpuPromise = runtime.executeTask(highPriorityTask.id, { data: 'cpu3' });
      
      // Wait for tasks to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have 3 running tasks (2 CPU and 1 memory)
      const runningTasks = prioritizationPlugin.getRunningTasks();
      expect(runningTasks.length).toBe(3);
      
      // Wait for all tasks to complete
      await Promise.all([highPromise, mediumPromise, lowPromise, extraCpuPromise]);
      
      // Verify that CPU tasks didn't exceed capacity
      // This is hard to test precisely without mocking the internal state
      // So we'll check the plugin's internal resource allocation
      const cpuAllocations = prioritizationPlugin.getResourceAllocations('cpu-intensive');
      expect(cpuAllocations).toBeLessThanOrEqual(2);
    });
  });
}); 