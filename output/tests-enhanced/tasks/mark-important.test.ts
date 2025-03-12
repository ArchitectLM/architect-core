
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMarkImportant } from '../../src/tasks/mark-important';

describe('Mark Todo as Important', () => {
  it('should mark a todo as important with valid priority', async () => {
    const result = await executeMarkImportant({
      todoId: '123',
      priority: 'high'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.success).toBe(true);
    expect(result.output.todoId).toBe('123');
    expect(result.output.priority).toBe('high');
    expect(result.output.updatedAt).toBeDefined();
  });
  
  it('should fail when todoId is missing', async () => {
    const result = await executeMarkImportant({
      priority: 'high'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('todoId is required');
  });
  
  it('should fail when priority is missing', async () => {
    const result = await executeMarkImportant({
      todoId: '123'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('priority is required');
  });
  
  it('should fail with invalid priority value', async () => {
    const result = await executeMarkImportant({
      todoId: '123',
      priority: 'invalid'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('priority must be one of');
  });
});
