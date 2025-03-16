/**
 * DSL Integration Tests
 * 
 * This module tests the DSL integration functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  convertFlowToDsl,
  convertDslToFlow,
  generateTaskCode,
  generateFlowCode
} from '../../src/runtime-core/lib/dsl-integration';
import { Flow, FlowStepType, CodeGenerationOptions } from '../../src/runtime-core/types';
import { ReactiveSystem } from '../../src/schema/types';

// Mock the DSL adapter functions
vi.mock('../../src/cli/dsl-adapter', () => ({
  loadSystemFromFile: vi.fn().mockResolvedValue({
    id: 'test-system',
    name: 'Test System',
    version: '1.0.0'
  }),
  validateDslSystem: vi.fn().mockReturnValue({
    success: true,
    issues: []
  }),
  migrateDslSystem: vi.fn().mockImplementation((system, targetVersion) => ({
    ...system,
    version: targetVersion,
    migrationHistory: [
      ...(system.migrationHistory || []),
      {
        fromVersion: system.version,
        toVersion: targetVersion,
        timestamp: new Date().toISOString(),
        description: 'Migration test'
      }
    ]
  })),
  saveSystemToFile: vi.fn().mockResolvedValue(undefined)
}));

describe('DSL Integration', () => {
  describe('Flow Conversion', () => {
    it('should convert a flow to DSL format', () => {
      // Create a flow
      const flow: Flow = {
        id: 'test-flow',
        name: 'Test Flow',
        description: 'A test flow',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: FlowStepType.TASK,
            taskId: 'task1'
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: FlowStepType.CONDITION,
            condition: () => true,
            thenSteps: [
              {
                id: 'step3',
                name: 'Step 3',
                type: FlowStepType.TASK,
                taskId: 'task2'
              }
            ],
            elseSteps: []
          }
        ]
      };
      
      // Convert to DSL
      const dslFlow = convertFlowToDsl(flow);
      
      // Verify the conversion
      expect(dslFlow).toEqual({
        id: 'test-flow',
        name: 'Test Flow',
        description: 'A test flow',
        trigger: 'flow_test-flow_trigger',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            description: undefined,
            type: 'task',
            taskId: 'task1'
          },
          {
            id: 'step2',
            name: 'Step 2',
            description: undefined,
            type: 'decision',
            condition: 'condition_expression',
            branches: [
              {
                id: 'step2_then',
                name: 'Then',
                steps: ['step3']
              },
              {
                id: 'step2_else',
                name: 'Else',
                steps: []
              }
            ]
          }
        ]
      });
    });
    
    it('should convert a DSL flow to runtime format', () => {
      // Create a DSL flow
      const dslFlow = {
        id: 'test-flow',
        name: 'Test Flow',
        description: 'A test flow',
        trigger: 'flow_test-flow_trigger',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'task',
            taskId: 'task1'
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: 'decision',
            condition: 'condition_expression',
            branches: [
              {
                id: 'step2_then',
                name: 'Then',
                steps: ['step3']
              },
              {
                id: 'step2_else',
                name: 'Else',
                steps: []
              }
            ]
          },
          {
            id: 'step3',
            name: 'Step 3',
            type: 'task',
            taskId: 'task2'
          }
        ]
      };
      
      // Convert to runtime flow
      const flow = convertDslToFlow(dslFlow);
      
      // Verify the conversion
      expect(flow.id).toBe('test-flow');
      expect(flow.name).toBe('Test Flow');
      expect(flow.description).toBe('A test flow');
      expect(flow.steps.length).toBe(3);
      expect(flow.steps[0].type).toBe('task');
      expect(flow.steps[1].type).toBe('condition');
      expect(typeof flow.steps[1].condition).toBe('function');
      expect(flow.steps[1].thenSteps?.length).toBe(1);
      expect(flow.steps[2].type).toBe('task');
    });
  });
  
  describe('Code Generation', () => {
    it('should generate task code', async () => {
      // Create a system
      const system: ReactiveSystem = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        tasks: {
          'task1': {
            id: 'task1',
            type: 'operation',
            label: 'Task 1',
            description: 'Test task 1',
            input: ['data'],
            output: ['result']
          }
        }
      };
      
      // Generate code
      const options: CodeGenerationOptions = {
        language: 'typescript',
        includeComments: true,
        includeTests: false,
        includeErrorHandling: false
      };
      
      const result = await generateTaskCode('task1', system, options);
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.code).toContain('Task implementation');
      expect(result.code).toContain('taskImplementation');
    });
    
    it('should generate flow code', async () => {
      // Create a system
      const system: ReactiveSystem = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        flows: {
          'flow1': {
            id: 'flow1',
            name: 'Flow 1',
            description: 'Test flow 1',
            trigger: 'trigger1',
            steps: []
          }
        }
      };
      
      // Generate code
      const options: CodeGenerationOptions = {
        language: 'typescript',
        includeComments: true,
        includeTests: false,
        includeErrorHandling: false
      };
      
      const result = await generateFlowCode('flow1', system, options);
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.code).toContain('Flow implementation');
      expect(result.code).toContain('registerFlow');
    });
    
    it('should handle errors when generating code for nonexistent task', async () => {
      // Create a system
      const system: ReactiveSystem = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        tasks: {}
      };
      
      // Generate code
      const options: CodeGenerationOptions = {
        language: 'typescript',
        includeComments: true,
        includeTests: false,
        includeErrorHandling: false
      };
      
      await expect(generateTaskCode('nonexistent', system, options)).rejects.toThrow();
    });
    
    it('should handle errors when generating code for nonexistent flow', async () => {
      // Create a system
      const system: ReactiveSystem = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        flows: {}
      };
      
      // Generate code
      const options: CodeGenerationOptions = {
        language: 'typescript',
        includeComments: true,
        includeTests: false,
        includeErrorHandling: false
      };
      
      await expect(generateFlowCode('nonexistent', system, options)).rejects.toThrow();
    });
  });
}); 