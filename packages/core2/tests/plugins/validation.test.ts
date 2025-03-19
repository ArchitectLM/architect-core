import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { createExtensionSystem } from '../../src/implementations/extension-system.js';
import { createEventBus } from '../../src/implementations/event-bus.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { createValidationPlugin, ValidationPlugin } from '../../src/plugins/validation.js';

describe('Validation Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let validationPlugin: ValidationPlugin;
  
  // Sample process and task definitions
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing validation',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' },
      { from: 'processing', to: 'canceled', on: 'CANCEL' }
    ]
  };
  
  const calculationTaskDefinition: TaskDefinition = {
    id: 'calculation-task',
    name: 'Calculation Task',
    description: 'A task that performs calculations with numeric inputs',
    handler: async (context) => {
      const { a, b, operation } = context.input;
      let result;
      
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          result = a / b;
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      return { result };
    }
  };
  
  beforeEach(() => {
    // Create the extension system and event bus
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin
    validationPlugin = createValidationPlugin() as ValidationPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(validationPlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [calculationTaskDefinition.id]: calculationTaskDefinition
    };
    
    runtime = createRuntime(
      processDefinitions, 
      taskDefinitions, 
      { extensionSystem, eventBus }
    );
    
    // Add missing process:beforeTransition extension point
    extensionSystem.registerExtensionPoint({
      name: 'process:beforeTransition',
      description: 'Called before a process transition occurs',
      handlers: []
    });
  });
  
  describe('Task Input Validation', () => {
    it('should allow valid task inputs to proceed', async () => {
      // Define validation rules for the calculation task
      validationPlugin.setTaskValidation('calculation-task', {
        schema: {
          type: 'object',
          required: ['a', 'b', 'operation'],
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
            operation: { 
              type: 'string',
              enum: ['add', 'subtract', 'multiply', 'divide']
            }
          }
        }
      });
      
      // Execute task with valid input
      const result = await runtime.executeTask('calculation-task', {
        a: 10,
        b: 5,
        operation: 'add'
      });
      
      // Task should execute successfully
      expect(result).toBeDefined();
      expect(result.result).toBe(15);
    });
    
    it('should reject task inputs that do not match the schema', async () => {
      // Define validation rules for the calculation task
      validationPlugin.setTaskValidation('calculation-task', {
        schema: {
          type: 'object',
          required: ['a', 'b', 'operation'],
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
            operation: { 
              type: 'string',
              enum: ['add', 'subtract', 'multiply', 'divide']
            }
          }
        }
      });
      
      // Execute task with invalid input (missing required property)
      await expect(runtime.executeTask('calculation-task', {
        a: 10,
        // Missing b
        operation: 'add'
      })).rejects.toThrow(/validation failed/i);
      
      // Execute task with invalid input (wrong type)
      await expect(runtime.executeTask('calculation-task', {
        a: "10", // string instead of number
        b: 5,
        operation: 'add'
      })).rejects.toThrow(/validation failed/i);
      
      // Execute task with invalid input (value not in enum)
      await expect(runtime.executeTask('calculation-task', {
        a: 10,
        b: 5,
        operation: 'power' // not in enum
      })).rejects.toThrow(/validation failed/i);
    });
    
    it('should allow custom validation functions', async () => {
      // Define custom validation function
      const customValidator = vi.fn((input) => {
        if (input.operation === 'divide' && input.b === 0) {
          return { valid: false, errors: ['Division by zero is not allowed'] };
        }
        return { valid: true };
      });
      
      // Set custom validator
      validationPlugin.setTaskValidation('calculation-task', {
        validator: customValidator
      });
      
      // Valid input should pass
      await runtime.executeTask('calculation-task', {
        a: 10,
        b: 5,
        operation: 'divide'
      });
      
      // Division by zero should fail
      await expect(runtime.executeTask('calculation-task', {
        a: 10,
        b: 0,
        operation: 'divide'
      })).rejects.toThrow(/Division by zero/);
      
      // Validator should have been called twice
      expect(customValidator).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Process Transition Validation', () => {
    it('should allow valid process transitions', async () => {
      // Create a process
      const process = await runtime.createProcess('test-process', { test: true });
      
      // Define validation rules for the process
      validationPlugin.setProcessValidation('test-process', {
        transitions: {
          'START': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                reason: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Mock the runtime's transitionProcess method to allow data to be passed
      const originalTransition = runtime.transitionProcess;
      (runtime as any).transitionProcess = vi.fn(
        async (processId: string, event: string, data?: any) => {
          // Update process data if provided
          if (data) {
            const process = (runtime as any).processes.get(processId);
            if (process) {
              process.data = { ...process.data, ...data };
            }
          }
          // Call the original method
          return originalTransition.call(runtime, processId, event);
        }
      );
      
      // Transition with valid data
      await expect((runtime as any).transitionProcess(
        process.id, 
        'START',
        { reason: 'Test transition' }
      )).resolves.toBeDefined();
    });
    
    it('should reject invalid process transitions', async () => {
      // Create a process
      const process = await runtime.createProcess('test-process', { test: true });
      
      // Define validation rules for the process
      validationPlugin.setProcessValidation('test-process', {
        transitions: {
          'START': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                reason: { type: 'string', minLength: 5 }
              }
            }
          }
        }
      });
      
      // Mock the runtime's transitionProcess method to allow data to be passed
      const originalTransition = runtime.transitionProcess;
      (runtime as any).transitionProcess = vi.fn(
        async (processId: string, event: string, data?: any) => {
          // Update process data if provided
          if (data) {
            const process = (runtime as any).processes.get(processId);
            if (process) {
              process.data = { ...process.data, ...data };
            }
          }
          // Call the original method
          return originalTransition.call(runtime, processId, event);
        }
      );
      
      // Transition with missing required field
      await expect((runtime as any).transitionProcess(
        process.id, 
        'START',
        {}
      )).rejects.toThrow(/validation failed/i);
      
      // Transition with too short string
      await expect((runtime as any).transitionProcess(
        process.id, 
        'START',
        { reason: 'Test' }
      )).rejects.toThrow(/validation failed/i);
    });
    
    it('should validate transitions conditionally based on state', async () => {
      // Create a process
      const process = await runtime.createProcess('test-process', { test: true });
      
      // Define validation rules for the process
      validationPlugin.setProcessValidation('test-process', {
        transitions: {
          'START': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                reason: { type: 'string' }
              }
            }
          },
          'COMPLETE': {
            schema: {
              type: 'object',
              required: ['result'],
              properties: {
                result: { type: 'number', minimum: 0 }
              }
            }
          },
          'CANCEL': {
            schema: {
              type: 'object',
              required: ['cancellationReason'],
              properties: {
                cancellationReason: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Mock the runtime's transitionProcess method to allow data to be passed
      const originalTransition = runtime.transitionProcess;
      (runtime as any).transitionProcess = vi.fn(
        async (processId: string, event: string, data?: any) => {
          // Update process data if provided
          if (data) {
            const process = (runtime as any).processes.get(processId);
            if (process) {
              process.data = { ...process.data, ...data };
            }
          }
          // Call the original method
          return originalTransition.call(runtime, processId, event);
        }
      );
      
      // Start the process with valid data
      await (runtime as any).transitionProcess(
        process.id, 
        'START',
        { reason: 'Starting process' }
      );
      
      // Complete with valid data
      await expect((runtime as any).transitionProcess(
        process.id, 
        'COMPLETE',
        { result: 42 }
      )).resolves.toBeDefined();
      
      // Create another process to test cancellation
      const process2 = await runtime.createProcess('test-process', { test: true });
      
      // Start the process
      await (runtime as any).transitionProcess(
        process2.id, 
        'START',
        { reason: 'Starting process' }
      );
      
      // Cancel with valid data
      await expect((runtime as any).transitionProcess(
        process2.id, 
        'CANCEL',
        { cancellationReason: 'No longer needed' }
      )).resolves.toBeDefined();
      
      // Cancel with invalid data
      await expect((runtime as any).transitionProcess(
        process2.id, 
        'CANCEL',
        { reason: 'Wrong field name' }
      )).rejects.toThrow(/validation failed/i);
    });
  });
  
  describe('Validation Configuration', () => {
    it('should allow different validation modes', async () => {
      // Define validation rules with warn mode
      validationPlugin.setTaskValidation('calculation-task', {
        mode: 'warn',
        schema: {
          type: 'object',
          required: ['a', 'b', 'operation'],
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          }
        }
      });
      
      // Mock console.warn to check for warnings
      const originalWarn = console.warn;
      const mockWarn = vi.fn();
      console.warn = mockWarn;
      
      // Execute task with invalid input, but it should still proceed in warn mode
      const result = await runtime.executeTask('calculation-task', {
        a: 10,
        b: 5,
        operation: 'unknown' // This doesn't match schema but should warn only
      });
      
      // Restore console.warn
      console.warn = originalWarn;
      
      // Task should execute despite validation failure in warn mode
      expect(result).toBeDefined();
      
      // Should have triggered a warning
      expect(mockWarn).toHaveBeenCalled();
    });
    
    it('should allow disabling validation for specific tasks', async () => {
      // Define strict validation rules
      validationPlugin.setTaskValidation('calculation-task', {
        schema: {
          type: 'object',
          required: ['a', 'b', 'operation'],
          properties: {
            a: { type: 'number' },
            b: { type: 'number' }
          }
        }
      });
      
      // Then disable validation
      validationPlugin.setTaskValidation('calculation-task', {
        disabled: true
      });
      
      // Execute task with invalid input
      const result = await runtime.executeTask('calculation-task', {
        // Missing required fields, but validation is disabled
        operation: 'add'
      });
      
      // Task should execute despite missing required fields
      expect(result).toBeDefined();
    });
  });
}); 