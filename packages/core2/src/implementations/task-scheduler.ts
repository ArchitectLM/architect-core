import { v4 as uuidv4 } from 'uuid';
import { Identifier, Result, Timestamp } from '../models/core-types';
import { 
  TaskScheduler, 
  TaskExecutor, 
  TaskRegistry,
  TaskExecution,
  TaskStatus as SystemTaskStatus
} from '../models/task-system';

// Define a local DomainError class to avoid import issues
class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

// Define local interfaces for internal implementation
interface ScheduledTask {
  id: Identifier;
  taskType: string;
  scheduledTime: number;
  input: unknown;
  createdAt: number;
  updatedAt: number;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  result?: unknown;
  error?: Error;
  completedAt?: number;
  recurring: boolean;
  cronExpression?: string;
  metadata?: Record<string, unknown>;
}

/**
 * In-memory implementation of TaskScheduler
 */
export class InMemoryTaskScheduler implements TaskScheduler {
  private taskRegistry: TaskRegistry;
  private taskExecutor: TaskExecutor;
  private scheduledTasks = new Map<Identifier, ScheduledTask>();
  
  /**
   * Create a new InMemoryTaskScheduler
   * @param taskRegistry Registry of task definitions
   * @param taskExecutor Executor for running tasks
   */
  constructor(taskRegistry: TaskRegistry, taskExecutor: TaskExecutor) {
    this.taskRegistry = taskRegistry;
    this.taskExecutor = taskExecutor;
  }
  
  /**
   * Schedule a task to run at a specific time
   * @param taskType The type of task to schedule
   * @param input The task input parameters
   * @param scheduledTime The time to run the task
   */
  public async scheduleTask<TInput = unknown>(
    taskType: string,
    input: TInput,
    scheduledTime: number
  ): Promise<Identifier> {
    try {
      // Verify task type exists
      const taskDef = this.taskRegistry.getTask(taskType);
      
      if (!taskDef) {
        throw new DomainError(`Task definition for type ${taskType} not found`);
      }
      
      const now = Date.now();
      const taskId = uuidv4();
      
      // Create scheduled task
      const scheduledTask: ScheduledTask = {
        id: taskId,
        taskType,
        scheduledTime,
        input,
        createdAt: now,
        updatedAt: now,
        status: 'SCHEDULED',
        recurring: false,
      };
      
      // Store the task
      this.scheduledTasks.set(taskId, scheduledTask);
      
      return taskId;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to schedule task: ${String(error)}`);
    }
  }
  
  /**
   * Schedule a recurring task
   * @param taskType The type of task to schedule
   * @param input The task input parameters
   * @param cronExpression The cron expression for recurrence
   */
  public async scheduleRecurringTask<TInput = unknown>(
    taskType: string,
    input: TInput,
    cronExpression: string
  ): Promise<Identifier> {
    try {
      // Verify task type exists
      const taskDef = this.taskRegistry.getTask(taskType);
      
      if (!taskDef) {
        throw new DomainError(`Task definition for type ${taskType} not found`);
      }
      
      const now = Date.now();
      const taskId = uuidv4();
      
      // Calculate next execution time based on cron expression
      const nextExecutionTime = this.calculateNextExecutionTime(cronExpression);
      
      if (!nextExecutionTime) {
        throw new DomainError(`Invalid cron expression: ${cronExpression}`);
      }
      
      // Create scheduled task
      const scheduledTask: ScheduledTask = {
        id: taskId,
        taskType,
        scheduledTime: nextExecutionTime,
        input,
        createdAt: now,
        updatedAt: now,
        status: 'SCHEDULED',
        recurring: true,
        cronExpression,
      };
      
      // Store the task
      this.scheduledTasks.set(taskId, scheduledTask);
      
      return taskId;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to schedule recurring task: ${String(error)}`);
    }
  }
  
  /**
   * Cancel a scheduled task
   * @param scheduleId The ID of the scheduled task
   */
  public async cancelScheduledTask(scheduleId: Identifier): Promise<boolean> {
    try {
      const task = this.scheduledTasks.get(scheduleId);
      
      if (!task) {
        return false;
      }
      
      if (task.status === 'RUNNING') {
        // Can't cancel a running task
        return false;
      }
      
      if (task.status === 'COMPLETED' || task.status === 'FAILED') {
        // Can't cancel a task that has already completed or failed
        return false;
      }
      
      task.status = 'CANCELLED';
      task.updatedAt = Date.now();
      
      // Update in storage
      this.scheduledTasks.set(scheduleId, task);
      
      return true;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to cancel scheduled task: ${String(error)}`);
    }
  }
  
  /**
   * Get all scheduled tasks
   */
  public async getScheduledTasks(): Promise<Array<{
    id: Identifier;
    taskType: string;
    input: Record<string, unknown>;
    scheduledTime: number;
    recurring: boolean;
    cronExpression?: string;
  }>> {
    try {
      const result = [];
      
      for (const task of this.scheduledTasks.values()) {
        if (task.status === 'SCHEDULED') {
          result.push({
            id: task.id,
            taskType: task.taskType,
            input: task.input as Record<string, unknown>,
            scheduledTime: task.scheduledTime,
            recurring: task.recurring,
            cronExpression: task.cronExpression
          });
        }
      }
      
      return result;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to get scheduled tasks: ${String(error)}`);
    }
  }

  /**
   * Calculate the next execution time based on a cron expression
   * @param cronExpression Cron expression for scheduling
   * @private
   */
  private calculateNextExecutionTime(cronExpression: string): number | null {
    // This is a simplified implementation
    // In a real implementation, you would use a cron parser library
    
    try {
      // For now, just schedule one hour from now as a placeholder
      return Date.now() + 60 * 60 * 1000;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Factory function to create a new TaskScheduler
 */
export function createTaskScheduler(
  taskRegistry: TaskRegistry,
  taskExecutor: TaskExecutor
): TaskScheduler {
  return new InMemoryTaskScheduler(taskRegistry, taskExecutor);
} 