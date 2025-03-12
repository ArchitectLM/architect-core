
import { describe, it, expect } from 'vitest';
import { executeFilterImportantTodos } from '../../src/tasks/filter-important-todos';

describe('Filter Important Todos', () => {
  const sampleTodos = [
    { id: '1', title: 'Task 1', priority: 'low' },
    { id: '2', title: 'Task 2', priority: 'medium' },
    { id: '3', title: 'Task 3', priority: 'high' },
    { id: '4', title: 'Task 4', priority: 'low' },
    { id: '5', title: 'Task 5' } // No priority
  ];
  
  it('should filter todos with low priority and above', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'low'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(4);
    expect(result.output.filteredTodos.map(t => t.id)).toContain('1');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('2');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('3');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('4');
  });
  
  it('should filter todos with medium priority and above', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'medium'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(2);
    expect(result.output.filteredTodos.map(t => t.id)).toContain('2');
    expect(result.output.filteredTodos.map(t => t.id)).toContain('3');
  });
  
  it('should filter todos with high priority only', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'high'
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(1);
    expect(result.output.filteredTodos[0].id).toBe('3');
  });
  
  it('should default to low priority if not specified', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos
    });
    
    expect(result.success).toBe(true);
    expect(result.output.filteredTodos).toHaveLength(4);
  });
  
  it('should fail with invalid todos input', async () => {
    const result = await executeFilterImportantTodos({
      todos: 'not an array'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('todos must be an array');
  });
  
  it('should fail with invalid priority value', async () => {
    const result = await executeFilterImportantTodos({
      todos: sampleTodos,
      minPriority: 'invalid'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('minPriority must be one of');
  });
});
