/**
 * Reactive System DSL Tests
 */
import { describe, it, expect } from 'vitest';
import { ReactiveSystem } from './reactive-system';
import { ReactiveSystemCompiler, createCompiler } from './compiler';
import { PaymentProcessingPlugin } from './plugin';

describe('Reactive System DSL', () => {
  describe('Basic DSL', () => {
    it('should create a valid system definition', () => {
      // Arrange & Act
      const system = ReactiveSystem.define('order-system')
        .withName('Order System')
        .withDescription('A system for managing orders')
        .withProcess('order-process')
          .withName('Order Process')
          .withDescription('Handles order processing')
          .initialState('created')
          .state('created')
            .withDescription('Order has been created')
            .on('START_PROCESSING').transitionTo('processing')
            .on('CANCEL').transitionTo('cancelled')
          .state('processing')
            .withDescription('Order is being processed')
            .withTask('process-order')
            .on('COMPLETE').transitionTo('completed')
            .on('CANCEL').transitionTo('cancelled')
          .state('completed')
            .withDescription('Order has been completed')
            .isFinal()
          .state('cancelled')
            .withDescription('Order has been cancelled')
            .isFinal()
          .build()
        .withTask('process-order')
          .withName('Process Order')
          .withDescription('Processes an order')
          .input({
            orderId: { type: 'string', required: true },
            items: { type: 'array', required: true }
          })
          .output({
            processed: { type: 'boolean', required: true },
            orderNumber: { type: 'string', required: true }
          })
          .implementation(`
            async function processOrder(input, context) {
              console.log('Processing order:', input.orderId);
              
              // Simulate processing time
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              return {
                processed: true,
                orderNumber: 'ORD-' + Math.floor(Math.random() * 1000000)
              };
            }
          `)
          .test('unit', (task) => [
            {
              name: 'should process an order successfully',
              setup: () => ({
                input: {
                  orderId: '123',
                  items: [{ productId: 'P1', quantity: 1 }]
                },
                context: { logger: console }
              }),
              execute: async (setup) => task(setup.input, setup.context),
              verify: (result) => {
                expect(result.processed).toBe(true);
                expect(result.orderNumber).toMatch(/^ORD-\d+$/);
              }
            }
          ])
          .build()
        .build();

      // Assert
      expect(system.id).toBe('order-system');
      expect(system.name).toBe('Order System');
      expect(system.description).toBe('A system for managing orders');
      expect(system.processes.length).toBe(1);
      expect(system.tasks.length).toBe(1);
      
      // Check process
      const process = system.processes[0];
      expect(process.id).toBe('order-process');
      expect(process.name).toBe('Order Process');
      expect(process.initialState).toBe('created');
      expect(process.states.length).toBe(4);
      
      // Check states
      const createdState = process.states.find(s => s.name === 'created');
      expect(createdState).toBeDefined();
      expect(createdState?.transitions.length).toBe(2);
      
      // Check task
      const task = system.tasks[0];
      expect(task.id).toBe('process-order');
      expect(task.name).toBe('Process Order');
      expect(task.input).toBeDefined();
      expect(task.output).toBeDefined();
      expect(task.implementation).toBeDefined();
      expect(task.tests?.length).toBe(1);
    });
    
    it('should validate the system definition', () => {
      // Arrange & Act & Assert
      expect(() => {
        ReactiveSystem.define('invalid-system').build();
      }).toThrow('System must have at least one process');
      
      expect(() => {
        ReactiveSystem.define('invalid-system')
          .withProcess('process')
          .build()
          .build();
      }).toThrow('Process must have an initial state');
      
      expect(() => {
        ReactiveSystem.define('invalid-system')
          .withProcess('process')
          .initialState('state')
          .build()
          .build();
      }).toThrow('Process must have at least one state');
    });
  });
  
  describe('Compiler', () => {
    it('should compile a system definition', () => {
      // Arrange
      const system = ReactiveSystem.define('order-system')
        .withProcess('order-process')
          .initialState('created')
          .state('created')
            .on('START_PROCESSING').transitionTo('processing')
          .state('processing')
            .withTask('process-order')
            .on('COMPLETE').transitionTo('completed')
          .state('completed')
            .isFinal()
          .build()
        .withTask('process-order')
          .implementation(`
            async function processOrder(input, context) {
              return { processed: true };
            }
          `)
          .build()
        .build();
      
      const compiler = createCompiler();
      
      // Act
      const compiledSystem = compiler.compile(system);
      
      // Assert
      expect(compiledSystem.id).toBe('order-system');
      expect(compiledSystem.processes['order-process']).toBeDefined();
      expect(compiledSystem.tasks['process-order']).toBeDefined();
      
      // Check state machine
      const stateMachine = compiledSystem.processes['order-process'].stateMachine;
      expect(stateMachine.getInitialState().name).toBe('created');
      expect(stateMachine.getAllStates().length).toBe(3);
      
      // Check transitions
      const createdState = stateMachine.getState('created');
      expect(createdState?.getTransition('START_PROCESSING')?.target).toBe('processing');
      
      // Check task implementation
      const taskImplementation = compiledSystem.tasks['process-order'].implementation;
      expect(typeof taskImplementation).toBe('function');
    });
  });
  
  describe('Plugins', () => {
    it('should extend the system with a plugin', () => {
      // This is a conceptual test since we don't have the full plugin integration yet
      // In a real implementation, we would register the plugin with the system builder
      
      // Arrange
      const plugin = PaymentProcessingPlugin;
      
      // Assert
      expect(plugin.name).toBe('payment-processing');
      expect(plugin.extend).toBeDefined();
    });
  });
}); 