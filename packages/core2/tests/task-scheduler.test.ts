import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimpleTaskScheduler } from '../src/implementations/task-scheduler';
import { TaskExecutor } from '../src/models/task-system';

describe('SimpleTaskScheduler', () => {
  let taskScheduler: SimpleTaskScheduler;
  let mockTaskExecutor: TaskExecutor;
  
  // Setup mocks
  beforeEach(() => {
    // Create a mock TaskExecutor
    mockTaskExecutor = {
      executeTask: vi.fn().mockResolvedValue({ 
        success: true, 
        value: { id: 'task-1', status: 'completed' } 
      })
    } as unknown as TaskExecutor;
    
    // Create the task scheduler with the mock executor
    taskScheduler = new SimpleTaskScheduler(mockTaskExecutor);
    
    // Mock timers
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  
  describe('Scheduling Tasks', () => {
    it('should schedule a task for future execution', async () => {
      const scheduledTime = Date.now() + 1000;
      const result = await taskScheduler.scheduleTask('test-task', { data: 'test' }, scheduledTime);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.value).toBe('string');
      }
    });
    
    it('should execute a task at the scheduled time', async () => {
      const scheduledTime = Date.now() + 1000;
      const result = await taskScheduler.scheduleTask('test-task', { data: 'test' }, scheduledTime);
      
      expect(result.success).toBe(true);
      
      // Advance time
      vi.advanceTimersByTime(1100);
      
      // Give async operations a chance to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Check if task executor was called
      expect(mockTaskExecutor.executeTask).toHaveBeenCalledWith('test-task', { data: 'test' });
    });
    
    it('should handle scheduling a task in the past', async () => {
      const pastTime = Date.now() - 1000;
      const result = await taskScheduler.scheduleTask('test-task', { data: 'test' }, pastTime);
      
      expect(result.success).toBe(true);
      
      // Give async operations a chance to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Task should execute immediately
      expect(mockTaskExecutor.executeTask).toHaveBeenCalledWith('test-task', { data: 'test' });
    });
  });
  
  describe('Cancelling Tasks', () => {
    it('should cancel a scheduled task', async () => {
      // Schedule a task
      const scheduledTime = Date.now() + 1000;
      const scheduleResult = await taskScheduler.scheduleTask('test-task', { data: 'test' }, scheduledTime);
      
      expect(scheduleResult.success).toBe(true);
      if (!scheduleResult.success) return;
      
      // Cancel the task
      const cancelResult = await taskScheduler.cancelScheduledTask(scheduleResult.value);
      
      expect(cancelResult.success).toBe(true);
      if (cancelResult.success) {
        expect(cancelResult.value).toBe(true);
      }
      
      // Advance time past when the task would have executed
      vi.advanceTimersByTime(1100);
      
      // Give async operations a chance to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Task executor should not have been called
      expect(mockTaskExecutor.executeTask).not.toHaveBeenCalled();
    });
    
    it('should return false when cancelling a non-existent task', async () => {
      const cancelResult = await taskScheduler.cancelScheduledTask('non-existent-task');
      
      expect(cancelResult.success).toBe(true);
      if (cancelResult.success) {
        expect(cancelResult.value).toBe(false);
      }
    });
  });
  
  describe('Rescheduling Tasks', () => {
    it('should reschedule a task to a new time', async () => {
      // Schedule a task
      const initialScheduledTime = Date.now() + 1000;
      const scheduleResult = await taskScheduler.scheduleTask('test-task', { data: 'test' }, initialScheduledTime);
      
      expect(scheduleResult.success).toBe(true);
      if (!scheduleResult.success) return;
      
      // Reschedule the task
      const newScheduledTime = Date.now() + 2000;
      const rescheduleResult = await taskScheduler.rescheduleTask(scheduleResult.value, newScheduledTime);
      
      expect(rescheduleResult.success).toBe(true);
      if (rescheduleResult.success) {
        expect(rescheduleResult.value).toBe(true);
      }
      
      // Advance time past the initial scheduled time but before the new time
      vi.advanceTimersByTime(1500);
      
      // Give async operations a chance to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Task should not have executed yet
      expect(mockTaskExecutor.executeTask).not.toHaveBeenCalled();
      
      // Advance time to after the new scheduled time
      vi.advanceTimersByTime(1000);
      
      // Give async operations a chance to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Task should have executed
      expect(mockTaskExecutor.executeTask).toHaveBeenCalledWith('test-task', { data: 'test' });
    });
    
    it('should return false when rescheduling a non-existent task', async () => {
      const newScheduledTime = Date.now() + 1000;
      const rescheduleResult = await taskScheduler.rescheduleTask('non-existent-task', newScheduledTime);
      
      expect(rescheduleResult.success).toBe(true);
      if (rescheduleResult.success) {
        expect(rescheduleResult.value).toBe(false);
      }
    });
  });
  
  describe('Task Execution Errors', () => {
    beforeEach(() => {
      // Override the mock to simulate an error
      (mockTaskExecutor.executeTask as any).mockRejectedValueOnce(new Error('Task execution failed'));
      
      // Spy on console.error
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    it('should handle errors in task execution', async () => {
      const scheduledTime = Date.now() + 500;
      const result = await taskScheduler.scheduleTask('failing-task', { data: 'test' }, scheduledTime);
      
      expect(result.success).toBe(true);
      
      // Advance time
      vi.advanceTimersByTime(600);
      
      // Give async operations a chance to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Error should be caught and logged
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('Getting Scheduled Tasks', () => {
    it('should return all scheduled tasks', async () => {
      // Schedule multiple tasks
      await taskScheduler.scheduleTask('task-1', { data: 'test1' }, Date.now() + 1000);
      await taskScheduler.scheduleTask('task-2', { data: 'test2' }, Date.now() + 2000);
      
      // Get all scheduled tasks
      const result = await taskScheduler.getScheduledTasks();
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].taskType).toBe('task-1');
        expect(result.value[1].taskType).toBe('task-2');
      }
    });
  });
}); 