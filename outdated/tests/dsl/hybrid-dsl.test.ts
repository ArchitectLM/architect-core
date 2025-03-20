/**
 * Tests for the Hybrid DSL
 * 
 * This file contains tests for both the builder pattern and functional approaches
 * of the Hybrid DSL.
 */

import { describe, it, expect } from 'vitest';
import { 
  SystemBuilder, 
  ProcessBuilder, 
  TaskBuilder,
  createSystem,
  addBoundedContext,
  addProcess,
  addTask,
  addTaskToProcess,
  pipe
} from '../../src/dsl';

describe('Hybrid DSL', () => {
  describe('Builder Pattern Approach', () => {
    it('should create a simple system with the builder pattern', () => {
      // Arrange & Act
      const system = SystemBuilder.create('test-system')
        .withName('Test System')
        .withDescription('A test system')
        .withVersion('1.0.0')
        .build();
      
      // Assert
      expect(system).toBeDefined();
      expect(system.id).toBe('test-system');
      expect(system.name).toBe('Test System');
      expect(system.description).toBe('A test system');
      expect(system.version).toBe('1.0.0');
      expect(system.boundedContexts).toEqual({});
      expect(system.processes).toEqual({});
      expect(system.tasks).toEqual({});
    });

    it('should create a system with bounded contexts using the builder pattern', () => {
      // Arrange & Act
      const system = SystemBuilder.create('test-system')
        .withName('Test System')
        .withBoundedContext('context1', 'First Context')
        .withBoundedContext('context2', context => ({
          ...context,
          name: 'Second Context',
          description: 'A more detailed description'
        }))
        .build();
      
      // Assert
      expect(system.boundedContexts).toBeDefined();
      expect(Object.keys(system.boundedContexts || {})).toHaveLength(2);
      expect(system.boundedContexts?.['context1']?.name).toBe('First Context');
      expect(system.boundedContexts?.['context2']?.name).toBe('Second Context');
      expect(system.boundedContexts?.['context2']?.description).toBe('A more detailed description');
    });

    it('should create a system with processes using the builder pattern', () => {
      // Arrange & Act
      const system = SystemBuilder.create('test-system')
        .withBoundedContext('context1', 'First Context')
        .withProcess('process1', 'context1', 'First Process')
        .withProcess('process2', 'context1', process => ({
          ...process,
          name: 'Second Process',
          description: 'A more detailed process'
        }))
        .build();
      
      // Assert
      expect(system.processes).toBeDefined();
      expect(Object.keys(system.processes || {})).toHaveLength(2);
      expect(system.processes?.['process1']?.name).toBe('First Process');
      expect(system.processes?.['process2']?.name).toBe('Second Process');
      expect(system.processes?.['process2']?.description).toBe('A more detailed process');
      expect(system.boundedContexts?.['context1']?.processes).toContain('process1');
      expect(system.boundedContexts?.['context1']?.processes).toContain('process2');
    });

    it('should create a system with stateful processes using the builder pattern', () => {
      // Arrange & Act
      const system = SystemBuilder.create('test-system')
        .withBoundedContext('context1', 'First Context')
        .withStatefulProcess('process1', 'context1', {
          name: 'Stateful Process',
          states: ['initial', 'processing', 'completed'],
          transitions: [
            { from: 'initial', to: 'processing', on: 'start' },
            { from: 'processing', to: 'completed', on: 'finish' }
          ]
        })
        .build();
      
      // Assert
      expect(system.processes?.['process1']?.type).toBe('stateful');
      expect(system.processes?.['process1']?.states).toEqual(['initial', 'processing', 'completed']);
      expect(system.processes?.['process1']?.transitions).toHaveLength(2);
      expect(system.processes?.['process1']?.transitions?.[0]?.from).toBe('initial');
      expect(system.processes?.['process1']?.transitions?.[0]?.to).toBe('processing');
      expect(system.processes?.['process1']?.transitions?.[0]?.on).toBe('start');
    });

    it('should create a system with tasks using the builder pattern', () => {
      // Arrange & Act
      const system = SystemBuilder.create('test-system')
        .withBoundedContext('context1', 'First Context')
        .withProcess('process1', 'context1', 'First Process')
        .withTask('task1', 'First Task')
        .withTask('task2', task => ({
          ...task,
          type: 'transformation',
          description: 'A transformation task'
        }))
        .withProcessTask('process1', 'task1')
        .withProcessTask('process1', 'task2')
        .build();
      
      // Assert
      expect(system.tasks).toBeDefined();
      expect(Object.keys(system.tasks || {})).toHaveLength(2);
      expect(system.tasks?.['task1']?.label).toBe('First Task');
      expect(system.tasks?.['task2']?.type).toBe('transformation');
      expect(system.tasks?.['task2']?.description).toBe('A transformation task');
      expect(system.processes?.['process1']?.tasks).toContain('task1');
      expect(system.processes?.['process1']?.tasks).toContain('task2');
    });

    it('should validate a system and return validation issues', () => {
      // Arrange
      const builder = SystemBuilder.create('test-system')
        .withBoundedContext('context1', 'First Context')
        .withProcess('process1', 'context1', 'First Process');
      
      // We need to modify this test to not use withProcessTask directly
      // since it now throws an error immediately
      
      // Create a system with validation issues using the transform method
      const systemWithIssues = builder
        .transform(system => {
          if (system.processes && system.processes['process1']) {
            return {
              ...system,
              processes: {
                ...system.processes,
                'process1': {
                  ...system.processes['process1'],
                  tasks: [...(system.processes['process1'].tasks || []), 'non-existent-task']
                }
              }
            };
          }
          return system;
        });
      
      // Act
      const validationResult = systemWithIssues.validate();
      
      // Assert
      expect(validationResult.success).toBe(false);
      expect(validationResult.issues.length).toBeGreaterThan(0);
      // The exact path might vary depending on validation implementation
      expect(validationResult.issues[0].severity).toBe('error');
    });

    it('should throw an error when referencing a non-existent bounded context', () => {
      // Arrange
      const builder = SystemBuilder.create('test-system');
      
      // Act & Assert
      expect(() => {
        builder.withProcess('process1', 'non-existent-context', 'First Process');
      }).toThrow('Bounded context "non-existent-context" does not exist');
    });

    it('should throw an error when referencing a non-existent process', () => {
      // Arrange
      const builder = SystemBuilder.create('test-system')
        .withBoundedContext('context1', 'First Context')
        .withTask('task1', 'First Task');
      
      // Act & Assert
      expect(() => {
        builder.withProcessTask('non-existent-process', 'task1');
      }).toThrow('Process "non-existent-process" does not exist');
    });
  });

  describe('Process Builder', () => {
    it('should create a process with the ProcessBuilder', () => {
      // Arrange & Act
      const process = new ProcessBuilder('process1', 'Test Process', 'context1')
        .withType('stateful')
        .withStates(['initial', 'processing', 'completed'])
        .withTransition('initial', 'processing', 'start')
        .withTransition('processing', 'completed', 'finish')
        .withTask('task1')
        .withTask('task2')
        .build();
      
      // Assert
      expect(process).toBeDefined();
      expect(process.id).toBe('process1');
      expect(process.name).toBe('Test Process');
      expect(process.contextId).toBe('context1');
      expect(process.type).toBe('stateful');
      expect(process.states).toEqual(['initial', 'processing', 'completed']);
      expect(process.transitions).toHaveLength(2);
      expect(process.tasks).toEqual(['task1', 'task2']);
    });

    it('should throw an error when adding states to a stateless process', () => {
      // Arrange
      const builder = new ProcessBuilder('process1', 'Test Process', 'context1', 'stateless');
      
      // Act & Assert
      expect(() => {
        builder.withStates(['initial', 'processing', 'completed']);
      }).toThrow('States can only be added to stateful processes');
    });

    it('should throw an error when adding transitions to a stateless process', () => {
      // Arrange
      const builder = new ProcessBuilder('process1', 'Test Process', 'context1', 'stateless');
      
      // Act & Assert
      expect(() => {
        builder.withTransition('initial', 'processing', 'start');
      }).toThrow('Transitions can only be added to stateful processes');
    });
  });

  describe('Task Builder', () => {
    it('should create a task with the TaskBuilder', () => {
      // Arrange & Act
      const task = new TaskBuilder('task1')
        .withLabel('Test Task')
        .withDescription('A test task')
        .withInput(['param1', 'param2'])
        .withOutput(['result'])
        .build();
      
      // Assert
      expect(task).toBeDefined();
      expect(task.id).toBe('task1');
      expect(task.label).toBe('Test Task');
      expect(task.description).toBe('A test task');
      expect(task.input).toEqual(['param1', 'param2']);
      expect(task.output).toEqual(['result']);
    });
  });

  describe('Functional Approach', () => {
    it('should create a simple system with the functional approach', () => {
      // Arrange & Act
      const system = createSystem('test-system', 'Test System', '1.0.0');
      
      // Assert
      expect(system).toBeDefined();
      expect(system.id).toBe('test-system');
      expect(system.name).toBe('Test System');
      expect(system.version).toBe('1.0.0');
      expect(system.boundedContexts).toEqual({});
      expect(system.processes).toEqual({});
      expect(system.tasks).toEqual({});
    });

    it('should create a system with bounded contexts using the functional approach', () => {
      // Arrange & Act
      const system = pipe(
        createSystem('test-system', 'Test System', '1.0.0'),
        sys => addBoundedContext(sys, 'context1', 'First Context'),
        sys => addBoundedContext(sys, 'context2', 'Second Context', 'A more detailed description')
      );
      
      // Assert
      expect(system.boundedContexts).toBeDefined();
      expect(Object.keys(system.boundedContexts || {})).toHaveLength(2);
      expect(system.boundedContexts?.['context1']?.name).toBe('First Context');
      expect(system.boundedContexts?.['context2']?.name).toBe('Second Context');
      expect(system.boundedContexts?.['context2']?.description).toBe('A more detailed description');
    });

    it('should create a system with processes using the functional approach', () => {
      // Arrange & Act
      const system = pipe(
        createSystem('test-system', 'Test System', '1.0.0'),
        sys => addBoundedContext(sys, 'context1', 'First Context'),
        sys => addProcess(sys, 'process1', 'First Process', 'context1'),
        sys => addProcess(sys, 'process2', 'Second Process', 'context1', 'stateful')
      );
      
      // Assert
      expect(system.processes).toBeDefined();
      expect(Object.keys(system.processes || {})).toHaveLength(2);
      expect(system.processes?.['process1']?.name).toBe('First Process');
      expect(system.processes?.['process1']?.type).toBe('stateless');
      expect(system.processes?.['process2']?.name).toBe('Second Process');
      expect(system.processes?.['process2']?.type).toBe('stateful');
      expect(system.boundedContexts?.['context1']?.processes).toContain('process1');
      expect(system.boundedContexts?.['context1']?.processes).toContain('process2');
    });

    it('should create a system with tasks using the functional approach', () => {
      // Arrange & Act
      const system = pipe(
        createSystem('test-system', 'Test System', '1.0.0'),
        sys => addBoundedContext(sys, 'context1', 'First Context'),
        sys => addProcess(sys, 'process1', 'First Process', 'context1'),
        sys => addTask(sys, 'task1', 'operation', 'First Task'),
        sys => addTask(sys, 'task2', 'transformation', 'Second Task'),
        sys => addTaskToProcess(sys, 'process1', 'task1'),
        sys => addTaskToProcess(sys, 'process1', 'task2')
      );
      
      // Assert
      expect(system.tasks).toBeDefined();
      expect(Object.keys(system.tasks || {})).toHaveLength(2);
      expect(system.tasks?.['task1']?.label).toBe('First Task');
      expect(system.tasks?.['task1']?.type).toBe('operation');
      expect(system.tasks?.['task2']?.label).toBe('Second Task');
      expect(system.tasks?.['task2']?.type).toBe('transformation');
      expect(system.processes?.['process1']?.tasks).toContain('task1');
      expect(system.processes?.['process1']?.tasks).toContain('task2');
    });

    it('should throw an error when referencing a non-existent bounded context', () => {
      // Arrange
      const system = createSystem('test-system', 'Test System', '1.0.0');
      
      // Act & Assert
      expect(() => {
        addProcess(system, 'process1', 'First Process', 'non-existent-context');
      }).toThrow("Bounded context 'non-existent-context' does not exist");
    });

    it('should throw an error when referencing a non-existent process', () => {
      // Arrange
      const system = pipe(
        createSystem('test-system', 'Test System', '1.0.0'),
        sys => addBoundedContext(sys, 'context1', 'First Context'),
        sys => addTask(sys, 'task1', 'operation', 'First Task')
      );
      
      // Act & Assert
      expect(() => {
        addTaskToProcess(system, 'non-existent-process', 'task1');
      }).toThrow("Process 'non-existent-process' does not exist");
    });

    it('should throw an error when referencing a non-existent task', () => {
      // Arrange
      const system = pipe(
        createSystem('test-system', 'Test System', '1.0.0'),
        sys => addBoundedContext(sys, 'context1', 'First Context'),
        sys => addProcess(sys, 'process1', 'First Process', 'context1')
      );
      
      // Act & Assert
      expect(() => {
        addTaskToProcess(system, 'process1', 'non-existent-task');
      }).toThrow("Task 'non-existent-task' does not exist");
    });
  });

  describe('Combining Approaches', () => {
    it('should allow combining builder and functional approaches', () => {
      // Arrange & Act
      // Start with functional approach
      const baseSystem = pipe(
        createSystem('test-system', 'Test System', '1.0.0'),
        sys => addBoundedContext(sys, 'context1', 'First Context'),
        sys => addProcess(sys, 'process1', 'First Process', 'context1')
      );
      
      // Continue with builder approach
      const finalSystem = SystemBuilder.create(baseSystem.id)
        .transform(() => baseSystem) // Use the existing system as a base
        .withTask('task1', 'First Task')
        .withProcessTask('process1', 'task1')
        .build();
      
      // Assert
      expect(finalSystem.boundedContexts?.['context1']).toBeDefined();
      expect(finalSystem.processes?.['process1']).toBeDefined();
      expect(finalSystem.tasks?.['task1']).toBeDefined();
      expect(finalSystem.processes?.['process1']?.tasks).toContain('task1');
    });
  });
}); 