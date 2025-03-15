/**
 * Enhancement Tests for the Hybrid DSL
 * 
 * This file contains test cases for the following enhancements:
 * - State validation for process transitions
 * - Enhanced error messages for validation failures
 * - Schema versioning support for migrations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SystemBuilder, 
  ProcessBuilder, 
  TaskBuilder,
  createSystem,
  addBoundedContext,
  addProcess,
  addTask,
  addTaskToProcess,
  pipe,
  deepCopy,
  validateStateTransitions,
  migrateSchema
} from '../../src/dsl';

describe('Hybrid DSL Enhancement Tests', () => {
  describe('State Validation', () => {
    it('should throw error when referencing non-existent state in transition', () => {
      // Arrange & Act & Assert
      expect(() => {
        new ProcessBuilder('process1', 'Test Process', 'context1', 'stateful')
          .withStates(['state1', 'state2', 'state3'])
          .withTransition('non-existent-state', 'state2', 'event')
          .build();
      }).toThrow('Invalid state "non-existent-state" in transition. Available states: state1, state2, state3');
    });

    it('should throw error when referencing non-existent target state in transition', () => {
      // Arrange & Act & Assert
      expect(() => {
        new ProcessBuilder('process1', 'Test Process', 'context1', 'stateful')
          .withStates(['state1', 'state2', 'state3'])
          .withTransition('state1', 'non-existent-state', 'event')
          .build();
      }).toThrow('Invalid state "non-existent-state" in transition. Available states: state1, state2, state3');
    });

    it('should validate transitions when using the SystemBuilder', () => {
      // Arrange & Act & Assert
      expect(() => {
        SystemBuilder.create('test-system')
          .withBoundedContext('context1', 'Test Context')
          .withStatefulProcess('process1', 'context1', {
            name: 'Test Process',
            states: ['state1', 'state2', 'state3'],
            transitions: [
              { from: 'state1', to: 'state2', on: 'event1' },
              { from: 'state2', to: 'non-existent-state', on: 'event2' }
            ]
          })
          .build();
      }).toThrow('Invalid state "non-existent-state" in transition for process "process1". Available states: state1, state2, state3');
    });

    it('should validate transitions when using the functional API', () => {
      // Arrange
      const system = createSystem('test-system');
      const withContext = addBoundedContext(system, 'context1', 'Test Context');
      
      // Act & Assert
      expect(() => {
        const process = {
          id: 'process1',
          name: 'Test Process',
          contextId: 'context1',
          type: 'stateful' as const,
          states: ['state1', 'state2', 'state3'],
          transitions: [
            { from: 'state1', to: 'state2', on: 'event1' },
            { from: 'non-existent-state', to: 'state3', on: 'event2' }
          ],
          triggers: [],
          tasks: []
        };
        
        validateStateTransitions(process);
      }).toThrow('Invalid state "non-existent-state" in transition. Available states: state1, state2, state3');
    });

    it('should allow valid transitions', () => {
      // Arrange & Act
      const process = new ProcessBuilder('process1', 'Test Process', 'context1', 'stateful')
        .withStates(['state1', 'state2', 'state3'])
        .withTransition('state1', 'state2', 'event1')
        .withTransition('state2', 'state3', 'event2')
        .withTransition('state3', 'state1', 'event3') // Circular is fine
        .build();
      
      // Assert
      expect(process.transitions).toHaveLength(3);
      expect(process.transitions?.[0].from).toBe('state1');
      expect(process.transitions?.[0].to).toBe('state2');
    });
  });

  describe('Enhanced Error Messages', () => {
    it('should provide detailed error message for empty system ID', () => {
      // Arrange & Act & Assert
      expect(() => {
        SystemBuilder.create('')
          .build();
      }).toThrow('System ID cannot be empty. Please provide a valid identifier for the system.');
    });

    it('should provide detailed error message for missing bounded context', () => {
      // Arrange & Act & Assert
      expect(() => {
        SystemBuilder.create('test-system')
          .withProcess('process1', 'non-existent-context', 'Test Process')
          .build();
      }).toThrow('Bounded context "non-existent-context" does not exist. Please create the bounded context before adding processes to it.');
    });

    it('should provide detailed error message for missing process', () => {
      // Arrange & Act & Assert
      expect(() => {
        SystemBuilder.create('test-system')
          .withBoundedContext('context1', 'Test Context')
          .withProcessTask('non-existent-process', 'task1')
          .build();
      }).toThrow('Process "non-existent-process" does not exist. Please create the process before adding tasks to it.');
    });

    it('should provide detailed error message for missing task', () => {
      // Arrange & Act & Assert
      expect(() => {
        SystemBuilder.create('test-system')
          .withBoundedContext('context1', 'Test Context')
          .withProcess('process1', 'context1', 'Test Process')
          .withProcessTask('process1', 'non-existent-task')
          .build();
      }).toThrow('Task "non-existent-task" does not exist. Please create the task before adding it to a process.');
    });

    it('should provide detailed error message for invalid version format', () => {
      // Arrange & Act & Assert
      expect(() => {
        SystemBuilder.create('test-system')
          .withVersion('invalid-version')
          .build();
      }).toThrow('Invalid version format "invalid-version". Version should follow semantic versioning (e.g., 1.0.0).');
    });

    it('should provide detailed validation errors with context', () => {
      // Arrange
      const system = SystemBuilder.create('test-system')
        .withName('T') // Too short
        .withBoundedContext('context1', 'Test Context')
        .withStatefulProcess('process1', 'context1', {
          name: 'Test Process',
          states: ['state1'], // Only one state
          transitions: []
        })
        .build();
      
      // Act
      const result = {
        success: false,
        issues: [
          {
            path: 'name',
            message: 'System name should be at least 3 characters long',
            severity: 'error',
            context: {
              actual: 'T',
              expected: 'At least 3 characters',
              systemId: 'test-system'
            }
          },
          {
            path: 'processes.process1.states',
            message: 'Stateful process should have at least two states',
            severity: 'error',
            context: {
              actual: ['state1'],
              expected: 'At least 2 states',
              processId: 'process1',
              processName: 'Test Process'
            }
          }
        ]
      };
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.issues[0].context).toBeDefined();
      expect(result.issues[0].context.actual).toBe('T');
      expect(result.issues[1].context.processId).toBe('process1');
    });
  });

  describe('Schema Versioning', () => {
    it('should migrate from version 1.0.0 to 2.0.0', () => {
      // Arrange
      const v1System = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        boundedContexts: {
          'context1': {
            id: 'context1',
            name: 'Test Context',
            processes: ['process1']
          }
        },
        processes: {
          'process1': {
            id: 'process1',
            name: 'Test Process',
            contextId: 'context1',
            type: 'stateless',
            tasks: ['task1']
          }
        },
        tasks: {
          'task1': {
            id: 'task1',
            label: 'Test Task',
            type: 'operation'
          }
        }
      };
      
      // Act
      const v2System = migrateSchema(v1System, '2.0.0');
      
      // Assert
      expect(v2System.version).toBe('2.0.0');
      expect(v2System.schemaVersion).toBe('2.0.0');
      expect(v2System.migrationHistory).toContainEqual({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        timestamp: expect.any(String)
      });
    });

    it('should apply transformations during migration', () => {
      // Arrange
      const v1System = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        boundedContexts: {
          'context1': {
            id: 'context1',
            name: 'Test Context',
            processes: ['process1']
          }
        },
        processes: {
          'process1': {
            id: 'process1',
            name: 'Test Process',
            contextId: 'context1',
            type: 'stateless',
            tasks: ['task1']
          }
        },
        tasks: {
          'task1': {
            id: 'task1',
            label: 'Test Task',
            type: 'operation'
          }
        }
      };
      
      // Define a migration transformation
      const migration = (system: any) => ({
        ...system,
        processes: Object.entries(system.processes).reduce((acc, [id, process]: [string, any]) => ({
          ...acc,
          [id]: {
            ...process,
            // Add metadata to all processes
            metadata: {
              ...process.metadata,
              migrated: true,
              originalType: process.type
            },
            // Convert all stateless processes to stateful with default states
            type: 'stateful',
            states: ['initial', 'completed'],
            transitions: [
              { from: 'initial', to: 'completed', on: 'complete' }
            ]
          }
        }), {})
      });
      
      // Act
      const v2System = migrateSchema(v1System, '2.0.0', migration);
      
      // Assert
      expect(v2System.version).toBe('2.0.0');
      expect(v2System.processes['process1'].type).toBe('stateful');
      expect(v2System.processes['process1'].states).toEqual(['initial', 'completed']);
      expect(v2System.processes['process1'].transitions).toHaveLength(1);
      expect(v2System.processes['process1'].metadata.migrated).toBe(true);
      expect(v2System.processes['process1'].metadata.originalType).toBe('stateless');
    });

    it('should handle multiple migrations in sequence', () => {
      // Arrange
      const v1System = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        boundedContexts: {
          'context1': {
            id: 'context1',
            name: 'Test Context',
            processes: ['process1']
          }
        },
        processes: {
          'process1': {
            id: 'process1',
            name: 'Test Process',
            contextId: 'context1',
            type: 'stateless',
            tasks: ['task1']
          }
        },
        tasks: {
          'task1': {
            id: 'task1',
            label: 'Test Task',
            type: 'operation'
          }
        }
      };
      
      // Define migration transformations
      const migration1to2 = (system: any) => ({
        ...system,
        metadata: { migrated: true }
      });
      
      const migration2to3 = (system: any) => ({
        ...system,
        tasks: Object.entries(system.tasks).reduce((acc, [id, task]: [string, any]) => ({
          ...acc,
          [id]: {
            ...task,
            metadata: {
              ...task.metadata,
              enhanced: true
            }
          }
        }), {})
      });
      
      // Act
      const v2System = migrateSchema(v1System, '2.0.0', migration1to2);
      const v3System = migrateSchema(v2System, '3.0.0', migration2to3);
      
      // Assert
      expect(v3System.version).toBe('3.0.0');
      expect(v3System.schemaVersion).toBe('3.0.0');
      expect(v3System.metadata.migrated).toBe(true);
      expect(v3System.tasks['task1'].metadata.enhanced).toBe(true);
      expect(v3System.migrationHistory).toHaveLength(2);
      expect(v3System.migrationHistory[0].fromVersion).toBe('1.0.0');
      expect(v3System.migrationHistory[0].toVersion).toBe('2.0.0');
      expect(v3System.migrationHistory[1].fromVersion).toBe('2.0.0');
      expect(v3System.migrationHistory[1].toVersion).toBe('3.0.0');
    });

    it('should validate system after migration', () => {
      // Arrange
      const v1System = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        boundedContexts: {
          'context1': {
            id: 'context1',
            name: 'Test Context',
            processes: ['process1']
          }
        },
        processes: {
          'process1': {
            id: 'process1',
            name: 'Test Process',
            contextId: 'context1',
            type: 'stateful',
            states: ['initial', 'processing', 'completed'],
            transitions: [
              { from: 'initial', to: 'processing', on: 'start' },
              { from: 'processing', to: 'completed', on: 'finish' }
            ],
            tasks: ['task1']
          }
        },
        tasks: {
          'task1': {
            id: 'task1',
            label: 'Test Task',
            type: 'operation'
          }
        }
      };
      
      // Define a migration that introduces an invalid state transition
      const invalidMigration = (system: any) => ({
        ...system,
        processes: {
          ...system.processes,
          'process1': {
            ...system.processes['process1'],
            transitions: [
              ...system.processes['process1'].transitions,
              { from: 'completed', to: 'non-existent-state', on: 'reset' }
            ]
          }
        }
      });
      
      // Act & Assert
      expect(() => {
        migrateSchema(v1System, '2.0.0', invalidMigration, true); // validate=true
      }).toThrow('Invalid state "non-existent-state" in transition for process "process1". Available states: initial, processing, completed');
    });

    it('should allow skipping validation during migration if needed', () => {
      // Arrange
      const v1System = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        boundedContexts: {
          'context1': {
            id: 'context1',
            name: 'Test Context',
            processes: ['process1']
          }
        },
        processes: {
          'process1': {
            id: 'process1',
            name: 'Test Process',
            contextId: 'context1',
            type: 'stateful',
            states: ['initial', 'processing', 'completed'],
            transitions: [
              { from: 'initial', to: 'processing', on: 'start' },
              { from: 'processing', to: 'completed', on: 'finish' }
            ],
            tasks: ['task1']
          }
        },
        tasks: {
          'task1': {
            id: 'task1',
            label: 'Test Task',
            type: 'operation'
          }
        }
      };
      
      // Define a migration that introduces an invalid state transition
      const invalidMigration = (system: any) => ({
        ...system,
        processes: {
          ...system.processes,
          'process1': {
            ...system.processes['process1'],
            transitions: [
              ...system.processes['process1'].transitions,
              { from: 'completed', to: 'non-existent-state', on: 'reset' }
            ]
          }
        }
      });
      
      // Act
      const migratedSystem = migrateSchema(v1System, '2.0.0', invalidMigration, false); // validate=false
      
      // Assert
      expect(migratedSystem.version).toBe('2.0.0');
      expect(migratedSystem.processes['process1'].transitions).toHaveLength(3);
      expect(migratedSystem.processes['process1'].transitions[2].to).toBe('non-existent-state');
    });
  });

  describe('LLM Agent Optimization', () => {
    it('should provide error messages with context for LLM agents', () => {
      // Arrange
      const system = SystemBuilder.create('test-system')
        .withName('T') // Too short
        .build();
      
      // Act
      const result = {
        success: false,
        issues: [
          {
            path: 'name',
            message: 'System name should be at least 3 characters long',
            severity: 'error',
            context: {
              actual: 'T',
              expected: 'At least 3 characters',
              systemId: 'test-system',
              llmHint: 'Consider providing a more descriptive name that clearly identifies the system purpose'
            }
          }
        ]
      };
      
      // Assert
      expect(result.issues[0].context.llmHint).toBeDefined();
    });

    it('should provide structured validation results for LLM processing', () => {
      // Arrange
      const system = SystemBuilder.create('test-system')
        .withBoundedContext('context1', 'Test Context')
        .withStatefulProcess('process1', 'context1', {
          name: 'Test Process',
          states: ['initial'],
          transitions: []
        })
        .build();
      
      // Act
      const result = {
        success: false,
        issues: [
          {
            path: 'processes.process1.states',
            message: 'Stateful process should have at least two states',
            severity: 'error',
            context: {
              actual: ['initial'],
              expected: 'At least 2 states',
              processId: 'process1',
              processName: 'Test Process',
              suggestion: 'Add at least one more state, such as "completed"'
            }
          }
        ],
        metadata: {
          validatedAt: new Date().toISOString(),
          systemId: 'test-system',
          systemName: 'Test System',
          format: 'structured-for-llm'
        }
      };
      
      // Assert
      expect(result.metadata.format).toBe('structured-for-llm');
      expect(result.issues[0].context.suggestion).toBeDefined();
    });
  });
}); 