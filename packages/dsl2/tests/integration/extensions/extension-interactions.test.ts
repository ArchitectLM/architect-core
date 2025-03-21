import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

// Mock extensions
vi.mock('../../../src/extensions/process.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/process.extension.js');
  return {
    ...actual,
    setupProcessExtension: vi.fn().mockImplementation((dsl) => {
      // Add process-related methods to DSL
      (dsl as any)._extensions = (dsl as any)._extensions || {};
      (dsl as any)._extensions.process = true;
    })
  };
});

vi.mock('../../../src/extensions/workflow.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/workflow.extension.js');
  return {
    ...actual,
    setupWorkflowExtension: vi.fn().mockImplementation((dsl) => {
      // Add workflow-related methods to DSL
      (dsl as any)._extensions = (dsl as any)._extensions || {};
      (dsl as any)._extensions.workflow = true;
    })
  };
});

vi.mock('../../../src/extensions/schema.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/schema.extension.js');
  return {
    ...actual,
    setupSchemaExtension: vi.fn().mockImplementation((dsl) => {
      // Add schema-related methods to DSL
      (dsl as any)._extensions = (dsl as any)._extensions || {};
      (dsl as any)._extensions.schema = true;
    })
  };
});

// Import after mocking
import { setupProcessExtension } from '../../../src/extensions/process.extension.js';
import { setupWorkflowExtension } from '../../../src/extensions/workflow.extension.js';
import { setupSchemaExtension } from '../../../src/extensions/schema.extension.js';

describe('Extension Interactions', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should be able to load multiple extensions', () => {
    // Setup extensions
    setupProcessExtension(dsl);
    setupWorkflowExtension(dsl);
    setupSchemaExtension(dsl);
    
    // Verify all extensions were loaded
    expect(setupProcessExtension).toHaveBeenCalledWith(dsl);
    expect(setupWorkflowExtension).toHaveBeenCalledWith(dsl);
    expect(setupSchemaExtension).toHaveBeenCalledWith(dsl);
    
    // Check if extensions were registered
    expect((dsl as any)._extensions.process).toBe(true);
    expect((dsl as any)._extensions.workflow).toBe(true);
    expect((dsl as any)._extensions.schema).toBe(true);
  });

  it('should demonstrate process and workflow interactions', () => {
    // Setup extensions
    setupProcessExtension(dsl);
    setupWorkflowExtension(dsl);
    
    // Define a process that's part of a workflow
    const orderProcess = dsl.component('OrderProcess', {
      type: ComponentType.PROCESS,
      description: 'Order processing',
      version: '1.0.0',
      initialState: 'created',
      states: {
        created: {
          description: 'Order created',
          transitions: [{ to: 'processing', on: 'START_PROCESSING' }]
        },
        processing: {
          description: 'Order processing',
          transitions: [{ to: 'completed', on: 'COMPLETE_ORDER' }]
        },
        completed: {
          description: 'Order completed',
          final: true
        }
      }
    });
    
    // Define a workflow that orchestrates the process
    const shopWorkflow = dsl.component('ShoppingWorkflow', {
      type: ComponentType.WORKFLOW,
      description: 'Shopping workflow',
      version: '1.0.0',
      steps: [
        {
          name: 'placeOrder',
          description: 'Place an order',
          type: 'task',
          next: 'processOrder'
        },
        {
          name: 'processOrder',
          description: 'Process the order',
          type: 'process',
          processRef: 'OrderProcess',
          next: 'completeTransaction'
        },
        {
          name: 'completeTransaction',
          description: 'Complete the transaction',
          type: 'task',
          end: true
        }
      ]
    });
    
    // Verify that components were defined
    expect(orderProcess.id).toBe('OrderProcess');
    expect(orderProcess.type).toBe(ComponentType.PROCESS);
    
    expect(shopWorkflow.id).toBe('ShoppingWorkflow');
    expect(shopWorkflow.type).toBe(ComponentType.WORKFLOW);
    expect(shopWorkflow.steps).toHaveLength(3);
    
    // Verify process reference in workflow
    const processStep = shopWorkflow.steps.find(step => step.name === 'processOrder');
    expect(processStep).toBeDefined();
    expect(processStep?.processRef).toBe('OrderProcess');
  });

  it('should demonstrate schema and process interactions', () => {
    // Setup extensions
    setupSchemaExtension(dsl);
    setupProcessExtension(dsl);
    
    // Define a schema for the order
    const orderSchema = dsl.component('Order', {
      type: ComponentType.SCHEMA,
      description: 'Order schema',
      version: '1.0.0',
      properties: {
        id: { type: 'string' },
        items: { 
          type: 'array',
          items: { 
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number' }
            }
          }
        },
        status: { type: 'string', enum: ['created', 'processing', 'completed'] }
      },
      required: ['id', 'items']
    });
    
    // Define a process that uses the schema
    const orderProcess = dsl.component('OrderProcess', {
      type: ComponentType.PROCESS,
      description: 'Order processing',
      version: '1.0.0',
      dataSchema: { ref: 'Order' },
      initialState: 'created',
      states: {
        created: {
          description: 'Order created',
          transitions: [{ to: 'processing', on: 'START_PROCESSING' }],
          onExit: {
            actions: [
              {
                type: 'update',
                path: 'status',
                value: 'processing'
              }
            ]
          }
        },
        processing: {
          description: 'Order processing',
          transitions: [{ to: 'completed', on: 'COMPLETE_ORDER' }],
          onExit: {
            actions: [
              {
                type: 'update',
                path: 'status',
                value: 'completed'
              }
            ]
          }
        },
        completed: {
          description: 'Order completed',
          final: true
        }
      }
    });
    
    // Verify that components were defined
    expect(orderSchema.id).toBe('Order');
    expect(orderSchema.type).toBe(ComponentType.SCHEMA);
    
    expect(orderProcess.id).toBe('OrderProcess');
    expect(orderProcess.type).toBe(ComponentType.PROCESS);
    expect(orderProcess.dataSchema).toEqual({ ref: 'Order' });
  });

  it('should create a system with multiple extension-enhanced components', () => {
    // Setup extensions
    setupSchemaExtension(dsl);
    setupProcessExtension(dsl);
    setupWorkflowExtension(dsl);
    
    // Define components using different extensions
    dsl.component('User', {
      type: ComponentType.SCHEMA,
      description: 'User schema',
      version: '1.0.0',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' }
      }
    });
    
    dsl.component('RegistrationProcess', {
      type: ComponentType.PROCESS,
      description: 'User registration process',
      version: '1.0.0',
      initialState: 'started',
      states: {
        started: {
          description: 'Registration started',
          transitions: [{ to: 'completed', on: 'COMPLETE_REGISTRATION' }]
        },
        completed: {
          description: 'Registration completed',
          final: true
        }
      }
    });
    
    dsl.component('OnboardingWorkflow', {
      type: ComponentType.WORKFLOW,
      description: 'User onboarding workflow',
      version: '1.0.0',
      steps: [
        {
          name: 'register',
          description: 'Register user',
          type: 'process',
          processRef: 'RegistrationProcess',
          next: 'welcome'
        },
        {
          name: 'welcome',
          description: 'Send welcome email',
          type: 'task',
          end: true
        }
      ]
    });
    
    // Create a system that combines all components
    const system = dsl.system('UserSystem', {
      description: 'User management system',
      version: '1.0.0',
      components: {
        schemas: [{ ref: 'User' }],
        processes: [{ ref: 'RegistrationProcess' }],
        workflows: [{ ref: 'OnboardingWorkflow' }]
      }
    });
    
    // Verify system definition
    expect(system).toBeDefined();
    expect(system.id).toBe('UserSystem');
    expect(system.components.schemas).toHaveLength(1);
    expect(system.components.processes).toHaveLength(1);
    expect(system.components.workflows).toHaveLength(1);
  });
}); 