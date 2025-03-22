import { v4 as uuidv4 } from 'uuid';
import { Identifier, Result, Timestamp } from '../models/core-types';
import { TaskScheduler, TaskExecutor } from '../models/task-system';

/**
 * Simple in-memory implementation of TaskScheduler
 */
export class SimpleTaskScheduler implements TaskScheduler {
  private scheduledTasks = new Map<string, {
    id: string;
    taskType: string;
    input: unknown;
    scheduledTime: number;
    timeoutId: NodeJS.Timeout;
  }>();
  
  private taskExecutor: TaskExecutor;
  
  /**
   * Create a new SimpleTaskScheduler
   * @param taskExecutor The task executor to use for executing scheduled tasks
   */
  constructor(taskExecutor: TaskExecutor) {
    this.taskExecutor = taskExecutor;
  }
  
  /**
   * Schedule a task for execution at a specific time
   * @param taskType The type of task to schedule
   * @param input The input data for the task
   * @param scheduledTime The time to execute the task (timestamp in ms)
   */
  public async scheduleTask<TInput>(
    taskType: string,
    input: TInput,
    scheduledTime: Timestamp
  ): Promise<Result<Identifier>> {
    try {
      const taskId = uuidv4();
      
      // Calculate delay in ms
      const now = Date.now();
      const delay = Math.max(0, scheduledTime - now);
      
      // Schedule the task
      const timeoutId = setTimeout(() => {
        this.executeScheduledTask(taskId);
      }, delay);
      
      // Store the scheduled task
      this.scheduledTasks.set(taskId, {
        id: taskId,
        taskType,
        input,
        scheduledTime,
        timeoutId
      });
      
      return { success: true, value: taskId };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to schedule task: ${String(error)}`) 
      };
    }
  }
  
  /**
   * Cancel a scheduled task
   * @param taskId The ID of the task to cancel
   */
  public async cancelScheduledTask(taskId: Identifier): Promise<Result<boolean>> {
    try {
      const task = this.scheduledTasks.get(taskId);
      
      if (!task) {
        return { success: true, value: false };
      }
      
      // Clear the timeout
      clearTimeout(task.timeoutId);
      
      // Remove the task
      this.scheduledTasks.delete(taskId);
      
      return { success: true, value: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to cancel task: ${String(error)}`) 
      };
    }
  }
  
  /**
   * Reschedule a task to a new execution time
   * @param taskId The ID of the task to reschedule
   * @param newScheduledTime The new time to execute the task
   */
  public async rescheduleTask(
    taskId: Identifier,
    newScheduledTime: Timestamp
  ): Promise<Result<boolean>> {
    try {
      const task = this.scheduledTasks.get(taskId);
      
      if (!task) {
        return { success: true, value: false };
      }
      
      // Clear the existing timeout
      clearTimeout(task.timeoutId);
      
      // Calculate new delay
      const now = Date.now();
      const delay = Math.max(0, newScheduledTime - now);
      
      // Schedule the task with new time
      const timeoutId = setTimeout(() => {
        this.executeScheduledTask(taskId);
      }, delay);
      
      // Update the scheduled task
      this.scheduledTasks.set(taskId, {
        ...task,
        scheduledTime: newScheduledTime,
        timeoutId
      });
      
      return { success: true, value: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to reschedule task: ${String(error)}`) 
      };
    }
  }
  
  /**
   * Get all scheduled tasks
   */
  public async getScheduledTasks(): Promise<Result<Array<{ id: string; taskType: string; scheduledTime: number }>>> {
    try {
      const tasks = Array.from(this.scheduledTasks.values()).map(task => ({
        id: task.id,
        taskType: task.taskType,
        scheduledTime: task.scheduledTime
      }));
      
      return { success: true, value: tasks };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to get scheduled tasks: ${String(error)}`) 
      };
    }
  }
  
  /**
   * Execute a scheduled task
   * @param taskId The ID of the task to execute
   */
  private async executeScheduledTask(taskId: string): Promise<void> {
    const task = this.scheduledTasks.get(taskId);
    
    if (!task) {
      return;
    }
    
    // Remove the task from scheduled tasks
    this.scheduledTasks.delete(taskId);
    
    // Execute the task
    try {
      await this.taskExecutor.executeTask(task.taskType, task.input);
    } catch (error) {
      console.error(`Error executing scheduled task ${taskId}:`, error);
    }
  }
}

/**
 * Factory function to create a new TaskScheduler
 */
export function createTaskScheduler(taskExecutor: TaskExecutor): TaskScheduler {
  return new SimpleTaskScheduler(taskExecutor);
} 