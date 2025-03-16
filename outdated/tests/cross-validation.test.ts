import { describe, it, expect } from 'vitest';
import { validateProcessFlow, detectCircularDependencies, validateEntityRelationships } from '../src/schema/cross-validation';
import { mockProcess, mockSystem } from './mocks';

describe('Cross-Entity Validation', () => {
  describe('Process Flow Validation', () => {
    it('should validate stateful processes have valid transitions', () => {
      const validProcess = mockProcess({
        type: 'stateful',
        states: ['initial', 'processing', 'completed', 'failed'],
        transitions: [
          { from: 'initial', to: 'processing', on: 'start' },
          { from: 'processing', to: 'completed', on: 'finish' },
          { from: 'processing', to: 'failed', on: 'error' }
        ]
      });
      
      const result = validateProcessFlow(validProcess);
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });
    
    it('should detect invalid state transitions', () => {
      const invalidProcess = mockProcess({
        type: 'stateful',
        states: ['initial', 'processing', 'completed'],
        transitions: [
          { from: 'initial', to: 'processing', on: 'start' },
          { from: 'processing', to: 'completed', on: 'finish' },
          { from: 'completed', to: 'non-existent', on: 'restart' } // Invalid transition
        ]
      });
      
      const result = validateProcessFlow(invalidProcess);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('does not exist');
    });
    
    it('should detect unreachable states', () => {
      const processWithUnreachableState = mockProcess({
        type: 'stateful',
        states: ['initial', 'processing', 'completed', 'isolated'],
        transitions: [
          { from: 'initial', to: 'processing', on: 'start' },
          { from: 'processing', to: 'completed', on: 'finish' }
          // No transition to 'isolated' state
        ]
      });
      
      const result = validateProcessFlow(processWithUnreachableState);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('unreachable');
    });
    
    it('should skip validation for stateless processes', () => {
      const statelessProcess = mockProcess({
        type: 'stateless',
        tasks: ['task1', 'task2']
      });
      
      const result = validateProcessFlow(statelessProcess);
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
  
  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies between processes', () => {
      const systemWithCircularDeps = mockSystem({
        processes: {
          'process1': mockProcess({
            dependencies: ['process2']
          }),
          'process2': mockProcess({
            dependencies: ['process3']
          }),
          'process3': mockProcess({
            dependencies: ['process1']
          })
        }
      });
      
      const result = detectCircularDependencies(systemWithCircularDeps);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Circular dependency');
    });
    
    it('should pass validation for systems without circular dependencies', () => {
      const validSystem = mockSystem({
        processes: {
          'process1': mockProcess({
            dependencies: ['process2']
          }),
          'process2': mockProcess({
            dependencies: ['process3']
          }),
          'process3': mockProcess({
            dependencies: []
          })
        }
      });
      
      const result = detectCircularDependencies(validSystem);
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
  
  describe('Entity Relationship Validation', () => {
    it('should validate that referenced tasks exist', () => {
      const systemWithValidReferences = mockSystem({
        processes: {
          'process1': mockProcess({
            tasks: ['task1', 'task2']
          })
        },
        tasks: {
          'task1': { id: 'task1', type: 'operation' },
          'task2': { id: 'task2', type: 'condition' }
        }
      });
      
      const result = validateEntityRelationships(systemWithValidReferences);
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });
    
    it('should detect missing task references', () => {
      const systemWithInvalidReferences = mockSystem({
        processes: {
          'process1': mockProcess({
            tasks: ['task1', 'non-existent-task']
          })
        },
        tasks: {
          'task1': { id: 'task1', type: 'operation' }
        }
      });
      
      const result = validateEntityRelationships(systemWithInvalidReferences);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('does not exist');
    });
    
    it('should validate that referenced bounded contexts exist', () => {
      const systemWithInvalidContextRef = mockSystem({
        processes: {
          'process1': mockProcess({
            contextId: 'non-existent-context'
          })
        },
        boundedContexts: {
          'context1': { id: 'context1', name: 'Context 1', processes: [] }
        }
      });
      
      const result = validateEntityRelationships(systemWithInvalidContextRef);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('does not exist');
    });
  });
}); 