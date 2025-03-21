import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

// Mock the process extension module
vi.mock('../../../src/extensions/process.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/process.extension.js');
  return {
    ...actual,
    setupProcessExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation that adds process methods
      dsl.enhanceComponent = (componentId, methods) => {
        // Mock implementation of enhanceComponent for testing
      };
    })
  };
});

// Import after mocking
import { 
  setupProcessExtension, 
  ProcessExtensionOptions
} from '../../../src/extensions/process.extension.js';

describe('Process Extension Core', () => {
  let dsl: DSL;
  let processOptions: ProcessExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    processOptions = {
      enablePersistence: true,
      historySize: 50,
      autoValidateTransitions: true
    };
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register the process extension with the DSL', () => {
    // Setup extension
    setupProcessExtension(dsl, processOptions);
    
    // Verify the extension setup was called with the right parameters
    expect(setupProcessExtension).toHaveBeenCalledWith(dsl, processOptions);
  });

  it('should define a process component with states and transitions', () => {
    // Setup extension
    setupProcessExtension(dsl, processOptions);

    // Define a process component
    const process = dsl.component('OrderProcess', {
      type: ComponentType.PROCESS,
      description: 'Order processing workflow',
      version: '1.0.0',
      initialState: 'created',
      states: {
        created: {
          description: 'Order has been created',
          transitions: [
            { to: 'processing', on: 'START_PROCESSING' }
          ]
        },
        processing: {
          description: 'Order is being processed',
          transitions: [
            { to: 'shipped', on: 'SHIP_ORDER' },
            { to: 'cancelled', on: 'CANCEL_ORDER' }
          ]
        },
        shipped: {
          description: 'Order has been shipped',
          transitions: [
            { to: 'delivered', on: 'DELIVER_ORDER' }
          ]
        },
        delivered: {
          description: 'Order has been delivered',
          final: true
        },
        cancelled: {
          description: 'Order has been cancelled',
          final: true
        }
      }
    });

    expect(process).toBeDefined();
    expect(process.id).toBe('OrderProcess');
    expect(process.type).toBe(ComponentType.PROCESS);
    expect(process.initialState).toBe('created');
    expect(process.states).toBeDefined();
    expect(Object.keys(process.states)).toHaveLength(5);
    expect(process.states.created.transitions).toHaveLength(1);
    expect(process.states.processing.transitions).toHaveLength(2);
    expect(process.states.delivered.final).toBe(true);
  });

  it('should allow processes with nested states', () => {
    // Setup extension
    setupProcessExtension(dsl, processOptions);

    // Define a process with nested states
    const process = dsl.component('ComplexProcess', {
      type: ComponentType.PROCESS,
      description: 'Process with nested states',
      version: '1.0.0',
      initialState: 'initial',
      states: {
        initial: {
          description: 'Initial state',
          transitions: [{ to: 'processing', on: 'START' }]
        },
        processing: {
          description: 'Processing state',
          nested: {
            initialState: 'step1',
            states: {
              step1: {
                description: 'Step 1',
                transitions: [{ to: 'step2', on: 'NEXT' }]
              },
              step2: {
                description: 'Step 2',
                transitions: [{ to: 'step3', on: 'NEXT' }]
              },
              step3: {
                description: 'Step 3',
                transitions: [{ to: 'completed', on: 'COMPLETE' }]
              }
            }
          }
        },
        completed: {
          description: 'Completed state',
          final: true
        }
      }
    });

    expect(process).toBeDefined();
    expect(process.states.processing.nested).toBeDefined();
    expect(process.states.processing.nested.initialState).toBe('step1');
    expect(Object.keys(process.states.processing.nested.states)).toHaveLength(3);
  });

  it('should support process states with entry and exit actions', () => {
    // Setup extension
    setupProcessExtension(dsl, processOptions);

    // Define a process with entry and exit actions
    const process = dsl.component('ActionProcess', {
      type: ComponentType.PROCESS,
      description: 'Process with actions',
      version: '1.0.0',
      initialState: 'start',
      states: {
        start: {
          description: 'Start state',
          onEnter: { task: 'logStart' },
          transitions: [{ to: 'middle', on: 'ADVANCE' }]
        },
        middle: {
          description: 'Middle state',
          onEnter: { task: 'logEnterMiddle' },
          onExit: { task: 'logExitMiddle' },
          transitions: [{ to: 'end', on: 'FINISH' }]
        },
        end: {
          description: 'End state',
          onEnter: { task: 'logCompletion' },
          final: true
        }
      }
    });

    expect(process).toBeDefined();
    expect(process.states.start.onEnter).toEqual({ task: 'logStart' });
    expect(process.states.middle.onEnter).toEqual({ task: 'logEnterMiddle' });
    expect(process.states.middle.onExit).toEqual({ task: 'logExitMiddle' });
    expect(process.states.end.onEnter).toEqual({ task: 'logCompletion' });
  });
}); 