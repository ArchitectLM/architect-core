import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskDefinition, TaskExecution, TaskRegistry, TaskExecutor, TaskScheduler } from '../src/models/task-system';
import { Result } from '../src/models/core-types';

describe('Task System', () => {
  let taskRegistry: TaskRegistry;
  let taskExecutor: TaskExecutor;
  let taskScheduler: TaskScheduler;

  // Sample task definition
  const sampleTask: TaskDefinition<{ value: number }, number> = {
    id: 'test-task',
    name: 'Test Task',
    description: 'A test task that doubles its input',
    handler: async (context) => {
      return context.input.value * 2;
    },
    retry: {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      initialDelay: 100,
      maxDelay: 1000
    },
    timeout: 5000
  };

  beforeEach(() => {
    // Reset mocks and implementations before each test
    vi.clearAllMocks();
  });

  describe('Task Registry', () => {
    it('should register and retrieve task definitions', () => {
      // Register task
      const registerResult = taskRegistry.registerTask(sampleTask);
      expect(registerResult.success).toBe(true);

      // Retrieve task
      const getResult = taskRegistry.getTaskDefinition<{ value: number }, number>(sampleTask.id);
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.value).toEqual(sampleTask);
      }
    });

    it('should handle duplicate task registration', () => {
      // Register task first time
      taskRegistry.registerTask(sampleTask);

      // Try to register again
      const result = taskRegistry.registerTask(sampleTask);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already registered');
      }
    });

    it('should unregister tasks', () => {
      // Register task
      taskRegistry.registerTask(sampleTask);

      // Unregister task
      const unregisterResult = taskRegistry.unregisterTask(sampleTask.id);
      expect(unregisterResult.success).toBe(true);

      // Verify task is gone
      expect(taskRegistry.hasTaskDefinition(sampleTask.id)).toBe(false);
    });
  });

  describe('Task Execution', () => {
    it('should execute tasks successfully', async () => {
      // Register task
      taskRegistry.registerTask(sampleTask);

      // Execute task
      const result = await taskExecutor.executeTask<{ value: number }, number>(
        sampleTask.id,
        { value: 5 }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const execution = result.value;
        expect(execution.status).toBe('completed');
        expect(execution.result).toBe(10);
        expect(execution.attemptNumber).toBe(1);
      }
    });

    it('should handle task failures and retries', async () => {
      // Create a failing task
      const failingTask: TaskDefinition<{ value: number }, number> = {
        ...sampleTask,
        id: 'failing-task',
        handler: async (context) => {
          if (context.attemptNumber < 3) {
            throw new Error('Temporary failure');
          }
          return context.input.value * 2;
        }
      };

      // Register task
      taskRegistry.registerTask(failingTask);

      // Execute task
      const result = await taskExecutor.executeTask<{ value: number }, number>(
        failingTask.id,
        { value: 5 }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const execution = result.value;
        expect(execution.status).toBe('completed');
        expect(execution.result).toBe(10);
        expect(execution.attemptNumber).toBe(3);
      }
    });

    it('should handle task dependencies', async () => {
      // Create dependent tasks
      const taskA: TaskDefinition<{ value: number }, number> = {
        ...sampleTask,
        id: 'task-a'
      };

      const taskB: TaskDefinition<{ value: number }, number> = {
        ...sampleTask,
        id: 'task-b',
        handler: async (context) => {
          return context.input.value * 3;
        }
      };

      // Register tasks
      taskRegistry.registerTask(taskA);
      taskRegistry.registerTask(taskB);

      // Execute task with dependency
      const result = await taskExecutor.executeTaskWithDependencies<{ value: number }, number>(
        taskB.id,
        { value: 5 },
        [taskA.id]
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const execution = result.value;
        expect(execution.status).toBe('completed');
        expect(execution.result).toBe(15);
        expect(execution.relations?.dependsOn).toContain(taskA.id);
      }
    });
  });

  describe('Task Scheduling', () => {
    it('should schedule tasks for future execution', async () => {
      // Register task
      taskRegistry.registerTask(sampleTask);

      // Schedule task
      const scheduledTime = Date.now() + 1000;
      const result = await taskScheduler.scheduleTask<{ value: number }>(
        sampleTask.id,
        { value: 5 },
        scheduledTime
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const taskId = result.value;
        
        // Verify task can be cancelled
        const cancelResult = await taskScheduler.cancelScheduledTask(taskId);
        expect(cancelResult.success).toBe(true);
        if (cancelResult.success) {
          expect(cancelResult.value).toBe(true);
        }
      }
    });

    it('should handle task rescheduling', async () => {
      // Register task
      taskRegistry.registerTask(sampleTask);

      // Schedule task
      const scheduledTime = Date.now() + 1000;
      const scheduleResult = await taskScheduler.scheduleTask<{ value: number }>(
        sampleTask.id,
        { value: 5 },
        scheduledTime
      );

      expect(scheduleResult.success).toBe(true);
      if (scheduleResult.success) {
        const taskId = scheduleResult.value;
        
        // Reschedule task
        const newScheduledTime = Date.now() + 2000;
        const rescheduleResult = await taskScheduler.rescheduleTask(
          taskId,
          newScheduledTime
        );

        expect(rescheduleResult.success).toBe(true);
        if (rescheduleResult.success) {
          expect(rescheduleResult.value).toBe(true);
        }
      }
    });
  });
}); 