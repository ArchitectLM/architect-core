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
          on: 'REVIEW', 
          guard: guardFn
        },
        { 
          from: 'pending', 
          to: 'rejected', 
          on: 'REVIEW', 
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
}); 