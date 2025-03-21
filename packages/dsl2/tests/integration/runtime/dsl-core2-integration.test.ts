import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { RuntimeAdapter } from '../../../src/runtime/adapter.js';

// Mock the Core2 runtime
vi.mock('@architectlm/core', async () => {
  return {
    createRuntime: vi.fn().mockReturnValue({
      createProcess: vi.fn().mockResolvedValue({ id: 'process-123', state: 'initial' }),
      getProcess: vi.fn().mockImplementation((id) => {
        if (id === 'process-123') {
          return { id: 'process-123', state: 'initial', data: {} };
        }
        return null;
      }),
      transitionProcess: vi.fn().mockImplementation((id, event) => {
        return { id, state: 'next-state', event };
      }),
      executeTask: vi.fn().mockResolvedValue({ result: 'task-executed' }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn()
    })
  };
});

describe('DSL to Core2 Runtime Integration', () => {
  let dsl: DSL;
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    dsl = new DSL();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should convert DSL process definitions to Core2 runtime configuration', () => {
    // Define a simple process in DSL
    dsl.component('UserRegistration', {
      type: ComponentType.PROCESS,
      description: 'User registration process',
      version: '1.0.0',
      initialState: 'started',
      states: {
        started: {
          description: 'Registration started',
          transitions: [{ to: 'verified', on: 'EMAIL_VERIFIED' }]
        },
        verified: {
          description: 'Email verified',
          transitions: [{ to: 'completed', on: 'PROFILE_COMPLETED' }]
        },
        completed: {
          description: 'Registration completed',
          final: true
        }
      }
    });

    // Define system that uses the process
    dsl.system('UserSystem', {
      description: 'User management system',
      version: '1.0.0',
      components: {
        processes: [{ ref: 'UserRegistration' }]
      }
    });

    // Create adapter
    adapter = new RuntimeAdapter(dsl);

    // Get runtime configuration
    const config = adapter.getRuntimeConfig('UserSystem');

    // Verify process definition conversion
    expect(config.processDefinitions).toBeDefined();
    expect(config.processDefinitions.UserRegistration).toBeDefined();
    
    const processDef = config.processDefinitions.UserRegistration;
    expect(processDef.initialState).toBe('started');
    expect(processDef.transitions).toHaveLength(2);
    expect(processDef.transitions[0]).toEqual({
      from: 'started',
      to: 'verified',
      on: 'EMAIL_VERIFIED'
    });
  });

  it('should convert DSL task implementations to Core2 runtime handlers', async () => {
    // Define a task in DSL
    dsl.component('CreateUser', {
      type: ComponentType.TASK,
      description: 'Create a user',
      version: '1.0.0',
      input: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['name', 'email']
      },
      output: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          createdAt: { type: 'string' }
        }
      }
    });

    // Implement the task
    dsl.implement('CreateUser', async (input, context) => {
      return {
        id: `user-${Date.now()}`,
        name: input.name,
        email: input.email,
        createdAt: new Date().toISOString()
      };
    });

    // Define system that uses the task
    dsl.system('UserTaskSystem', {
      description: 'User task system',
      version: '1.0.0',
      components: {
        tasks: [{ ref: 'CreateUser' }]
      }
    });

    // Create adapter
    adapter = new RuntimeAdapter(dsl);

    // Get runtime configuration
    const config = adapter.getRuntimeConfig('UserTaskSystem');

    // Verify task definition conversion
    expect(config.taskDefinitions).toBeDefined();
    expect(config.taskDefinitions.CreateUser).toBeDefined();
    
    const taskDef = config.taskDefinitions.CreateUser;
    expect(taskDef.name).toBe('CreateUser');
    expect(typeof taskDef.handler).toBe('function');

    // Test the handler function
    const result = await taskDef.handler({
      input: {
        name: 'Test User',
        email: 'test@example.com'
      }
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('Test User');
    expect(result.email).toBe('test@example.com');
    expect(result.id).toMatch(/^user-\d+$/);
  });

  it('should create a Core2 runtime instance from a DSL system', async () => {
    // Define components for the system
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

    dsl.component('UserProcess', {
      type: ComponentType.PROCESS,
      description: 'User lifecycle process',
      version: '1.0.0',
      initialState: 'created',
      states: {
        created: {
          description: 'User created',
          transitions: [{ to: 'active', on: 'ACTIVATE_USER' }]
        },
        active: {
          description: 'User active',
          transitions: [{ to: 'inactive', on: 'DEACTIVATE_USER' }]
        },
        inactive: {
          description: 'User inactive',
          final: true
        }
      }
    });

    // Define system
    dsl.system('RuntimeTestSystem', {
      description: 'System for runtime testing',
      version: '1.0.0',
      components: {
        schemas: [{ ref: 'User' }],
        processes: [{ ref: 'UserProcess' }]
      }
    });

    // Create adapter and runtime
    adapter = new RuntimeAdapter(dsl);
    const runtime = await adapter.createRuntime('RuntimeTestSystem');

    // Verify runtime was created
    expect(runtime).toBeDefined();
    
    // Create a process instance
    const process = await runtime.createProcess('UserProcess', { userId: 'user-123' });
    expect(process.id).toBe('process-123');
    expect(process.state).toBe('initial');

    // Get process instance
    const retrieved = await runtime.getProcess('process-123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('process-123');

    // Transition process
    const transitioned = await runtime.transitionProcess('process-123', 'ACTIVATE_USER');
    expect(transitioned.state).toBe('next-state');
    expect(transitioned.event).toBe('ACTIVATE_USER');
  });
}); 