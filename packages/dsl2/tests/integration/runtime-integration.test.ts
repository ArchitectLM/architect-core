import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { RuntimeAdapter } from '../../src/runtime/adapter.js';
import { ComponentType } from '../../src/models/component.js';
import { ProcessDefinition, TaskDefinition, Runtime } from '@architectlm/core';

// Mock runtime object for testing
const mockRuntime = {
  createProcess: vi.fn().mockResolvedValue({ id: 'process-123', state: 'initial' }),
  getProcess: vi.fn(),
  transitionProcess: vi.fn(),
  executeTask: vi.fn().mockResolvedValue({ result: 'task-executed' }),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  publish: vi.fn()
};

// Mock the core2 runtime
vi.mock('@architectlm/core', async () => {
  return {
    createRuntime: vi.fn().mockReturnValue(mockRuntime)
  };
});

describe('Runtime Integration', () => {
  let dsl: DSL;
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    dsl = new DSL();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Converting DSL to Runtime Configuration', () => {
    it('should convert DSL system to process definitions', () => {
      // Define components
      dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: { id: { type: 'string' } }
      });

      dsl.component('CreateUser', {
        type: ComponentType.COMMAND,
        description: 'Create a user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' }
      });

      dsl.implement('CreateUser', async (input: any, context: any) => {
        return { id: 'user-123', ...input };
      });

      // Define system
      const system = dsl.system('UserSystem', {
        description: 'User management system',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'User' }],
          commands: [{ ref: 'CreateUser' }]
        },
        workflows: [
          {
            name: 'UserRegistrationFlow',
            description: 'User registration workflow',
            initialState: 'started',
            transitions: [
              { from: 'started', to: 'completed', on: 'USER_CREATED' }
            ]
          }
        ]
      });

      // Create adapter
      adapter = new RuntimeAdapter(dsl);

      // Convert to runtime configuration
      const config = adapter.getRuntimeConfig('UserSystem');

      // Verify process definitions
      expect(config.processDefinitions).toBeDefined();
      const processKeys = Object.keys(config.processDefinitions);
      expect(processKeys).toContain('UserRegistrationFlow');
      
      const process = config.processDefinitions['UserRegistrationFlow'] as ProcessDefinition;
      expect(process.initialState).toBe('started');
      expect(process.transitions).toHaveLength(1);
      expect(process.transitions[0]).toEqual({ 
        from: 'started', 
        to: 'completed', 
        on: 'USER_CREATED' 
      });

      // Verify task definitions
      expect(config.taskDefinitions).toBeDefined();
      const taskKeys = Object.keys(config.taskDefinitions);
      expect(taskKeys).toContain('CreateUser');
      
      const task = config.taskDefinitions['CreateUser'] as TaskDefinition;
      expect(task.name).toBe('CreateUser');
      expect(typeof task.handler).toBe('function');
    });

    it('should throw an error for unknown system', () => {
      adapter = new RuntimeAdapter(dsl);
      expect(() => adapter.getRuntimeConfig('NonExistentSystem'))
        .toThrow(/system not found/i);
    });
  });

  describe('Runtime Creation and Operation', () => {
    it('should create a runtime from a system definition', async () => {
      // Set up the test components and system
      setupTestSystem(dsl);
      
      // Create adapter
      adapter = new RuntimeAdapter(dsl);
      
      // Create runtime
      const runtime = await adapter.createRuntime('UserSystem');
      
      // Verify runtime was created with the right configuration
      expect(runtime).toBeDefined();
      expect(runtime).toBe(mockRuntime);
    });

    it('should execute a command through the runtime', async () => {
      // Set up the test components and system
      setupTestSystem(dsl);
      
      // Create adapter and runtime
      adapter = new RuntimeAdapter(dsl);
      const runtime = await adapter.createRuntime('UserSystem');
      
      // Execute a command
      const result = await adapter.executeCommand(
        runtime, 
        'CreateUser', 
        { name: 'John Doe', email: 'john@example.com' }
      );
      
      expect(result).toBeDefined();
      expect(result).toEqual({ result: 'task-executed' });
      expect(runtime.executeTask).toHaveBeenCalledWith(
        'CreateUser', 
        { name: 'John Doe', email: 'john@example.com' }
      );
    });

    it('should start a workflow process', async () => {
      // Set up the test components and system
      setupTestSystem(dsl);
      
      // Create adapter and runtime
      adapter = new RuntimeAdapter(dsl);
      const runtime = await adapter.createRuntime('UserSystem');
      
      // Start a workflow process
      const process = await adapter.startWorkflow(
        runtime, 
        'UserRegistrationFlow',
        { userId: 'user-123' }
      );
      
      expect(process).toBeDefined();
      expect(process.id).toBe('process-123');
      expect(process.state).toBe('initial');
      expect(runtime.createProcess).toHaveBeenCalledWith(
        'UserRegistrationFlow',
        { userId: 'user-123' }
      );
    });
  });
});

// Helper to set up test components and system
function setupTestSystem(dsl: DSL) {
  // Define components
  dsl.component('User', {
    type: ComponentType.SCHEMA,
    description: 'User schema',
    version: '1.0.0',
    properties: { 
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' }
    }
  });

  dsl.component('CreateUser', {
    type: ComponentType.COMMAND,
    description: 'Create a user',
    version: '1.0.0',
    input: { ref: 'CreateUserInput' },
    output: { ref: 'User' }
  });

  dsl.implement('CreateUser', async (input: any, context: any) => {
    return { id: 'user-123', ...input };
  });

  // Define system
  return dsl.system('UserSystem', {
    description: 'User management system',
    version: '1.0.0',
    components: {
      schemas: [{ ref: 'User' }],
      commands: [{ ref: 'CreateUser' }]
    },
    workflows: [
      {
        name: 'UserRegistrationFlow',
        description: 'User registration workflow',
        initialState: 'started',
        transitions: [
          { from: 'started', to: 'completed', on: 'USER_CREATED' }
        ]
      }
    ]
  });
} 