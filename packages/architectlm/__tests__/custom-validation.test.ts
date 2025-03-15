import { describe, it, expect } from 'vitest';
import { ValidationRegistry, ValidationRule, createValidationRegistry } from '../src/schema/custom-validation';

// Define interfaces locally for testing purposes
interface ValidationError {
  path: string;
  message: string;
}

interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
}

interface ValidationContext {
  [key: string]: any;
}

// Create mock functions since they're not available
const mockProcess = (overrides: any = {}) => ({
  id: 'process-1',
  name: 'Test Process',
  type: 'stateless',
  tasks: ['task-1', 'task-2'],
  states: ['state-1', 'state-2'],
  ...overrides
});

const mockTask = (overrides: any = {}) => ({
  id: 'task-1',
  name: 'Test Task',
  implementation: {
    type: 'javascript',
    code: 'console.log("Hello")'
  },
  ...overrides
});

describe('Custom Validation System', () => {
  describe('Validation Registry', () => {
    it('should register and retrieve validation rules', () => {
      const registry = new ValidationRegistry();
      
      const testRule: ValidationRule = {
        id: 'test.rule',
        name: 'Test Rule',
        description: 'A test validation rule',
        applicableTo: ['process'],
        validate: (entity, _context) => {
          return { success: true, errors: [] };
        }
      };
      
      registry.registerRule(testRule);
      
      const retrievedRule = registry.getRule('test.rule');
      expect(retrievedRule).toBeDefined();
      expect(retrievedRule?.id).toBe('test.rule');
      expect(retrievedRule?.name).toBe('Test Rule');
    });
    
    it('should find rules applicable to an entity type', () => {
      const registry = new ValidationRegistry();
      
      const processRule: ValidationRule = {
        id: 'process.rule',
        name: 'Process Rule',
        description: 'A process validation rule',
        applicableTo: ['process'],
        validate: (entity, _context) => {
          return { success: true, errors: [] };
        }
      };
      
      const taskRule: ValidationRule = {
        id: 'task.rule',
        name: 'Task Rule',
        description: 'A task validation rule',
        applicableTo: ['task'],
        validate: (entity, _context) => {
          return { success: true, errors: [] };
        }
      };
      
      const multiRule: ValidationRule = {
        id: 'multi.rule',
        name: 'Multi Rule',
        description: 'A multi-entity validation rule',
        applicableTo: ['process', 'task'],
        validate: (entity, _context) => {
          return { success: true, errors: [] };
        }
      };
      
      registry.registerRule(processRule);
      registry.registerRule(taskRule);
      registry.registerRule(multiRule);
      
      const processRules = registry.findRulesForEntity('process');
      expect(processRules.length).toBe(2);
      expect(processRules.map(r => r.id)).toContain('process.rule');
      expect(processRules.map(r => r.id)).toContain('multi.rule');
      
      const taskRules = registry.findRulesForEntity('task');
      expect(taskRules.length).toBe(2);
      expect(taskRules.map(r => r.id)).toContain('task.rule');
      expect(taskRules.map(r => r.id)).toContain('multi.rule');
    });
  });
  
  describe('Validation with Rules', () => {
    it('should validate entities with specific rules', () => {
      const registry = new ValidationRegistry();
      
      // Register a rule that requires a process to have at least one task
      registry.registerRule({
        id: 'process.has-tasks',
        name: 'Process Has Tasks',
        description: 'Ensures that a process has at least one task',
        applicableTo: ['process'],
        validate: (process, _context) => {
          if (!process.tasks || process.tasks.length === 0) {
            return {
              success: false,
              errors: [{
                path: 'tasks',
                message: 'Process must have at least one task'
              }]
            };
          }
          return { success: true, errors: [] };
        }
      });
      
      // Valid process with tasks
      const validProcess = mockProcess({
        tasks: ['task1', 'task2']
      });
      
      const validResult = registry.validateWithRules(validProcess, ['process.has-tasks'], {});
      expect(validResult.success).toBe(true);
      expect(validResult.errors.length).toBe(0);
      
      // Invalid process without tasks
      const invalidProcess = mockProcess({
        tasks: []
      });
      
      const invalidResult = registry.validateWithRules(invalidProcess, ['process.has-tasks'], {});
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors.length).toBe(1);
      expect(invalidResult.errors[0].message).toContain('Process must have at least one task');
    });
    
    it('should validate entities with all applicable rules', () => {
      const registry = new ValidationRegistry();
      
      // Register multiple rules for processes
      registry.registerRule({
        id: 'process.has-tasks',
        name: 'Process Has Tasks',
        description: 'Ensures that a process has at least one task',
        applicableTo: ['process'],
        validate: (process, _context) => {
          if (!process.tasks || process.tasks.length === 0) {
            return {
              success: false,
              errors: [{
                path: 'tasks',
                message: 'Process must have at least one task'
              }]
            };
          }
          return { success: true, errors: [] };
        }
      });
      
      registry.registerRule({
        id: 'process.has-name',
        name: 'Process Has Name',
        description: 'Ensures that a process has a name',
        applicableTo: ['process'],
        validate: (process, _context) => {
          if (!process.name) {
            return {
              success: false,
              errors: [{
                path: 'name',
                message: 'Process must have a name'
              }]
            };
          }
          return { success: true, errors: [] };
        }
      });
      
      // Process with multiple validation issues
      const invalidProcess = mockProcess({
        name: '',
        tasks: []
      });
      
      const result = registry.validateEntity(invalidProcess, 'process', {});
      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });
  
  describe('Common Validation Rules', () => {
    it('should validate non-empty ID rule', () => {
      const registry = createValidationRegistry();
      
      // Entity with empty ID
      const entityWithEmptyId = {
        id: '',
        name: 'Test Entity'
      };
      
      const result = registry.validateWithRules(entityWithEmptyId, ['core.non-empty-id'], {});
      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toContain('ID cannot be empty');
    });
    
    it('should validate descriptive name rule', () => {
      const registry = createValidationRegistry();
      
      // Entity with short name
      const entityWithShortName = {
        id: 'test-id',
        name: 'AB'
      };
      
      const result = registry.validateWithRules(entityWithShortName, ['core.descriptive-name'], {});
      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toContain('at least 3 characters');
    });
    
    it('should validate stateful process has states rule', () => {
      const registry = createValidationRegistry();
      
      // Stateful process without states
      const statefulProcessWithoutStates = mockProcess({
        type: 'stateful',
        states: []
      });
      
      const result = registry.validateWithRules(statefulProcessWithoutStates, ['process.stateful-has-states'], {});
      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toContain('must define at least one state');
    });
    
    it('should validate task implementation rule', () => {
      const registry = createValidationRegistry();
      
      // Task with invalid implementation
      const taskWithInvalidImplementation = mockTask({
        implementation: {
          type: 'invalid-type',
          code: 'console.log("test")'
        }
      });
      
      const result = registry.validateWithRules(taskWithInvalidImplementation, ['task.valid-implementation'], {});
      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toContain('implementation type');
    });
  });
}); 