import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

describe('System Definition', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  it('should define a system with components', () => {
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

    dsl.component('UserActor', {
      type: ComponentType.ACTOR,
      description: 'Actor managing user operations',
      version: '1.0.0',
      messageHandlers: {
        createUser: {
          input: { type: 'object' },
          output: { ref: 'User' }
        }
      }
    });

    // Define system
    const system = dsl.system('UserManagement', {
      description: 'User management system',
      version: '1.0.0',
      components: {
        schemas: [{ ref: 'User' }],
        commands: [{ ref: 'CreateUser' }],
        actors: [{ ref: 'UserActor' }]
      }
    });

    expect(system).toBeDefined();
    expect(system.id).toBe('UserManagement');
    expect(system.description).toBe('User management system');
    expect(system.components.schemas).toHaveLength(1);
    expect(system.components.commands).toHaveLength(1);
    expect(system.components.actors).toHaveLength(1);
    expect(system.components.schemas[0].ref).toBe('User');
  });

  it('should define a system with processes', () => {
    // Define components
    dsl.component('OrderProcess', {
      type: ComponentType.PROCESS,
      description: 'Order process definition',
      version: '1.0.0',
      initialState: 'created',
      states: {
        created: {
          description: 'Order created',
          transitions: [{ to: 'processing', on: 'START_PROCESSING' }]
        },
        processing: {
          description: 'Order being processed',
          transitions: [{ to: 'shipped', on: 'SHIP_ORDER' }]
        },
        shipped: {
          description: 'Order shipped',
          transitions: [{ to: 'delivered', on: 'DELIVER_ORDER' }]
        },
        delivered: {
          description: 'Order delivered',
          final: true
        }
      }
    });

    // Define system with processes
    const system = dsl.system('OrderManagement', {
      description: 'Order management system',
      version: '1.0.0',
      components: {
        processes: [{ ref: 'OrderProcess' }]
      }
    });

    expect(system).toBeDefined();
    expect(system.components.processes).toHaveLength(1);
    expect(system.components.processes[0].ref).toBe('OrderProcess');
  });

  it('should define a system with workflows', () => {
    // Define system with inline workflow definition
    const system = dsl.system('WorkflowSystem', {
      description: 'System with workflows',
      version: '1.0.0',
      workflows: [
        {
          name: 'UserRegistration',
          description: 'User registration workflow',
          initialState: 'started',
          transitions: [
            { from: 'started', to: 'emailVerified', on: 'EMAIL_VERIFIED' },
            { from: 'emailVerified', to: 'profileCompleted', on: 'PROFILE_COMPLETED' },
            { from: 'profileCompleted', to: 'active', on: 'ACCOUNT_ACTIVATED' }
          ]
        }
      ]
    });

    expect(system).toBeDefined();
    expect(system.workflows).toHaveLength(1);
    expect(system.workflows[0].name).toBe('UserRegistration');
    expect(system.workflows[0].transitions).toHaveLength(3);
  });

  it('should retrieve a defined system by ID', () => {
    // Define a system
    dsl.system('TestSystem', {
      description: 'Test system',
      version: '1.0.0',
      components: {}
    });

    // Retrieve the system
    const system = dsl.getSystem('TestSystem');
    
    expect(system).toBeDefined();
    expect(system?.id).toBe('TestSystem');
    expect(system?.description).toBe('Test system');
  });

  it('should return undefined for unknown system', () => {
    const system = dsl.getSystem('NonExistentSystem');
    expect(system).toBeUndefined();
  });

  it('should throw error when defining a system with references to non-existent components', () => {
    expect(() => dsl.system('InvalidSystem', {
      description: 'Invalid system with non-existent components',
      version: '1.0.0',
      components: {
        schemas: [{ ref: 'NonExistentSchema' }]
      }
    })).toThrow(/component not found/i);
  });
}); 