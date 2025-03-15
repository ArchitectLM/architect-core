import { describe, it, expect, vi } from 'vitest';
import { defineProcess } from './process';
import { ProcessDefinition } from './types';

describe('defineProcess', () => {
  it('should create a valid process definition', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'order-process',
      states: ['created', 'processing', 'completed', 'cancelled'],
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'processing', on: 'START_PROCESSING' },
        { from: 'processing', to: 'completed', on: 'COMPLETE' },
        { from: 'processing', to: 'cancelled', on: 'CANCEL' },
        { from: 'created', to: 'cancelled', on: 'CANCEL' }
      ],
      description: 'Order processing workflow'
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process).toEqual(processConfig);
  });

  it('should set default initial state if not provided', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'simple-process',
      states: ['start', 'middle', 'end'],
      transitions: [
        { from: 'start', to: 'middle', on: 'NEXT' },
        { from: 'middle', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.initialState).toBe('start');
  });

  it('should throw error if process ID is missing', () => {
    // Arrange
    const processConfig = {
      states: ['start', 'end'],
      transitions: [
        { from: 'start', to: 'end', on: 'FINISH' }
      ]
    } as ProcessDefinition;
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Process ID is required');
  });

  it('should throw error if states are missing', () => {
    // Arrange
    const processConfig = {
      id: 'invalid-process',
      transitions: [
        { from: 'start', to: 'end', on: 'FINISH' }
      ]
    } as ProcessDefinition;
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Process must have at least one state');
  });

  it('should throw error if states array is empty', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'invalid-process',
      states: [],
      transitions: [
        { from: 'start', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Process must have at least one state');
  });

  it('should throw error if transitions are missing', () => {
    // Arrange
    const processConfig = {
      id: 'invalid-process',
      states: ['start', 'end']
    } as ProcessDefinition;
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Process must have at least one transition');
  });

  it('should throw error if transitions array is empty', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'invalid-process',
      states: ['start', 'end'],
      transitions: []
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Process must have at least one transition');
  });

  it('should support array of source states in transitions', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'multi-source-process',
      states: ['start', 'middle', 'end', 'error'],
      transitions: [
        { from: ['start', 'middle'], to: 'error', on: 'ERROR' },
        { from: 'start', to: 'middle', on: 'NEXT' },
        { from: 'middle', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.transitions).toEqual(processConfig.transitions);
  });

  // New tests for transitions with guard conditions
  it('should support transitions with guard conditions', () => {
    // Arrange
    const guardFn = (context: any) => context.score >= 70;
    const processConfig: ProcessDefinition = {
      id: 'guarded-process',
      states: ['pending', 'approved', 'rejected'],
      transitions: [
        { 
          from: 'pending', 
          to: 'approved', 
          on: 'REVIEW_APPROVE', 
          guard: guardFn
        },
        { 
          from: 'pending', 
          to: 'rejected', 
          on: 'REVIEW_REJECT', 
          guard: (context) => context.score < 70 
        }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.transitions[0].guard).toBe(guardFn);
    expect(typeof process.transitions[1].guard).toBe('function');
  });

  it('should support transitions to the same state', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'self-transition-process',
      states: ['active', 'paused'],
      transitions: [
        { from: 'active', to: 'active', on: 'REFRESH' },
        { from: 'active', to: 'paused', on: 'PAUSE' },
        { from: 'paused', to: 'active', on: 'RESUME' }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.transitions[0].from).toBe(process.transitions[0].to);
    expect(process.transitions).toEqual(processConfig.transitions);
  });

  it('should support wildcard source state in transitions', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'wildcard-process',
      states: ['start', 'middle', 'end', 'error'],
      transitions: [
        { from: '*', to: 'error', on: 'ERROR' },
        { from: 'start', to: 'middle', on: 'NEXT' },
        { from: 'middle', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.transitions[0].from).toBe('*');
  });

  it('should support process with context schema', () => {
    // Arrange
    const contextSchema = {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        items: { type: 'array' },
        total: { type: 'number' }
      },
      required: ['orderId']
    };
    
    const processConfig: ProcessDefinition = {
      id: 'schema-process',
      states: ['created', 'completed'],
      transitions: [
        { from: 'created', to: 'completed', on: 'COMPLETE' }
      ],
      contextSchema
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.contextSchema).toEqual(contextSchema);
  });

  it('should preserve description in process definition', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'described-process',
      states: ['start', 'end'],
      transitions: [
        { from: 'start', to: 'end', on: 'FINISH' }
      ],
      description: 'A process with a detailed description'
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.description).toBe('A process with a detailed description');
  });

  // Additional edge case tests

  it('should throw error if initial state is not in states array', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'invalid-initial-state',
      states: ['start', 'middle', 'end'],
      initialState: 'invalid',
      transitions: [
        { from: 'start', to: 'middle', on: 'NEXT' },
        { from: 'middle', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Initial state must be one of the defined states');
  });

  it('should throw error if transition references undefined states', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'invalid-transition-states',
      states: ['start', 'end'],
      transitions: [
        { from: 'start', to: 'middle', on: 'NEXT' }, // 'middle' is not defined
        { from: 'middle', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Transition references undefined state: middle');
  });

  it('should throw error if transition has no event type', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'invalid-transition-event',
      states: ['start', 'end'],
      transitions: [
        { from: 'start', to: 'end', on: '' } // Empty event type
      ]
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Transition must have an event type');
  });

  it('should handle process with many states and transitions', () => {
    // Arrange
    const states = Array.from({ length: 50 }, (_, i) => `state-${i}`);
    const transitions = states.slice(0, -1).map((state, i) => ({
      from: state,
      to: `state-${i + 1}`,
      on: `EVENT_${i}`
    }));
    
    const processConfig: ProcessDefinition = {
      id: 'large-process',
      states,
      transitions
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.states.length).toBe(50);
    expect(process.transitions.length).toBe(49);
    expect(process.initialState).toBe('state-0');
  });

  it('should handle process with duplicate state names', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'duplicate-states',
      states: ['start', 'middle', 'end', 'start'], // Duplicate 'start'
      transitions: [
        { from: 'start', to: 'middle', on: 'NEXT' },
        { from: 'middle', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Duplicate state name: start');
  });

  it('should handle process with duplicate transition events from same state', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'duplicate-transitions',
      states: ['start', 'middle', 'end'],
      transitions: [
        { from: 'start', to: 'middle', on: 'NEXT' },
        { from: 'start', to: 'end', on: 'NEXT' } // Same event from same state
      ]
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Duplicate transition event: NEXT from state: start');
  });

  it('should handle process with transitions using array of source states including wildcard', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'mixed-sources',
      states: ['start', 'middle', 'end', 'error'],
      transitions: [
        { from: ['start', '*'], to: 'error', on: 'ERROR' } // Mixed specific and wildcard
      ]
    };
    
    // Act & Assert
    expect(() => defineProcess(processConfig)).toThrow('Cannot mix wildcard with specific states in transition source');
  });

  it('should handle process with metadata', () => {
    // Arrange
    const metadata = {
      owner: 'system',
      version: '1.0.0',
      tags: ['critical', 'core'],
      timeout: 3600
    };
    
    const processConfig: ProcessDefinition = {
      id: 'metadata-process',
      states: ['start', 'end'],
      transitions: [
        { from: 'start', to: 'end', on: 'FINISH' }
      ],
      metadata
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.metadata).toEqual(metadata);
  });

  it('should handle process with transition metadata', () => {
    // Arrange
    const transitionMetadata = {
      description: 'Transition when order is approved',
      permissions: ['admin', 'manager'],
      audit: true
    };
    
    const processConfig: ProcessDefinition = {
      id: 'transition-metadata',
      states: ['pending', 'approved'],
      transitions: [
        { 
          from: 'pending', 
          to: 'approved', 
          on: 'APPROVE', 
          metadata: transitionMetadata
        }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.transitions[0].metadata).toEqual(transitionMetadata);
  });

  it('should handle process with very long ID', () => {
    // Arrange
    const veryLongId = 'a'.repeat(1000);
    const processConfig: ProcessDefinition = {
      id: veryLongId,
      states: ['start', 'end'],
      transitions: [
        { from: 'start', to: 'end', on: 'FINISH' }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.id).toBe(veryLongId);
    expect(process.id.length).toBe(1000);
  });

  it('should handle process with special characters in state names', () => {
    // Arrange
    const processConfig: ProcessDefinition = {
      id: 'special-chars',
      states: ['start-state', 'middle_state', 'end.state', 'error@state'],
      transitions: [
        { from: 'start-state', to: 'middle_state', on: 'NEXT' },
        { from: 'middle_state', to: 'end.state', on: 'FINISH' },
        { from: '*', to: 'error@state', on: 'ERROR' }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.states).toContain('start-state');
    expect(process.states).toContain('middle_state');
    expect(process.states).toContain('end.state');
    expect(process.states).toContain('error@state');
  });

  it('should handle process with async guard conditions', () => {
    // Arrange
    const asyncGuard = async (context: any) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return context.score >= 70;
    };
    
    const processConfig: ProcessDefinition = {
      id: 'async-guard',
      states: ['pending', 'approved', 'rejected'],
      transitions: [
        { 
          from: 'pending', 
          to: 'approved', 
          on: 'REVIEW', 
          guard: asyncGuard
        }
      ]
    };
    
    // Act
    const process = defineProcess(processConfig);
    
    // Assert
    expect(process.transitions[0].guard).toBe(asyncGuard);
  });
}); 