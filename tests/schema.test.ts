import { describe, it, expect } from 'vitest';
import { ReactiveSystemSchema } from '../src/schema/validation';

describe('ReactiveSystem Schema', () => {
  it('should validate a valid system', () => {
    const validSystem = {
      id: 'test-system',
      name: 'Test System',
      version: '1.0.0',
      description: 'A test system',
      // Add required fields for the enhanced schema
      boundedContexts: {
        'ctx-test': {
          id: 'ctx-test',
          name: 'Test Context',
          description: 'A test bounded context',
          processes: ['proc-test']
        }
      },
      processes: {
        'proc-test': {
          id: 'proc-test',
          name: 'Test Process',
          description: 'A test process',
          contextId: 'ctx-test',
          type: 'stateful',
          triggers: [
            {
              type: 'user_event',
              name: 'test-trigger',
              description: 'A test trigger'
            }
          ],
          tasks: ['task-test'],
          states: ['initial', 'processing', 'completed'],
          transitions: [
            {
              from: 'initial',
              to: 'processing',
              on: 'start',
              description: 'Start processing'
            }
          ]
        }
      },
      tasks: {
        'task-test': {
          id: 'task-test',
          type: 'operation',
          description: 'A test task'
        }
      }
    };
    
    const result = ReactiveSystemSchema.safeParse(validSystem);
    expect(result.success).toBe(true);
  });
  
  it('should reject a system with missing required fields', () => {
    const invalidSystem = {
      id: 'test-system',
      // Missing name
      version: '1.0.0'
    };
    
    const result = ReactiveSystemSchema.safeParse(invalidSystem);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('name');
    }
  });
  
  it('should reject a system with invalid field types', () => {
    const invalidSystem = {
      id: 'test-system',
      name: 123, // Should be a string
      version: '1.0.0'
    };
    
    const result = ReactiveSystemSchema.safeParse(invalidSystem);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('name');
    }
  });
}); 