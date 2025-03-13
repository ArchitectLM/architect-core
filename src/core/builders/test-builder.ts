/**
 * Test Builder - Fluent API for defining tests
 */
import { TestDefinition, TestStep, SystemConfig, ProcessInstance } from '../types';

/**
 * Builder class for creating test definitions with a fluent interface
 */
export class TestBuilder<T = any> {
  private definition: Partial<TestDefinition> = {
    steps: []
  };
  private system?: SystemConfig;
  private initialState: Record<string, any> = {};

  /**
   * Create a new test with the given name
   * @example
   * const orderTest = Test.create('complete order flow')
   *   .withDescription('Tests the complete order processing flow')
   *   .withSystem(ecommerceSystem)
   *   .withInitialState({
   *     processes: {
   *       'order-process': { state: 'created', data: { orderId: '123' } }
   *     }
   *   });
   */
  static create(name: string): TestBuilder {
    const builder = new TestBuilder();
    builder.definition.name = name;
    return builder;
  }

  /**
   * Add a description to help understand the test purpose
   * @example
   * .withDescription('Tests the complete order processing flow')
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Set the system to test
   * @example
   * .withSystem(ecommerceSystem)
   */
  withSystem(system: SystemConfig): this {
    this.system = system;
    return this;
  }

  /**
   * Set the initial state for the test
   * @example
   * .withInitialState({
   *   processes: {
   *     'order-process': { state: 'created', data: { orderId: '123' } }
   *   }
   * })
   */
  withInitialState(state: Record<string, any>): this {
    this.initialState = state;
    return this;
  }

  /**
   * Add a step to create a process instance
   * @example
   * .createProcess('order-process', { orderId: '123' })
   */
  createProcess(processId: string, input: any, expectedState?: string): this {
    this.addStep({
      action: 'createProcess',
      input: { processId, ...input },
      expectedState
    });
    return this;
  }

  /**
   * Add a step to transition a process
   * @example
   * .transitionProcess('START_PROCESSING', { userId: 'user-1' })
   */
  transitionProcess(event: string, data?: any, expectedState?: string): this {
    this.addStep({
      action: 'transition',
      event,
      data,
      expectedState
    });
    return this;
  }

  /**
   * Add a step to execute a task
   * @example
   * .executeTask('process-order', { orderId: '123' })
   */
  executeTask(taskId: string, input: any, expectedOutput?: any): this {
    this.addStep({
      action: 'executeTask',
      taskId,
      input,
      expectedOutput
    });
    return this;
  }

  /**
   * Add a step to verify the process state
   * @example
   * .verifyState('completed')
   */
  verifyState(state: string | ((state: string) => boolean)): this {
    this.addStep({
      action: 'verifyState',
      state
    });
    return this;
  }

  /**
   * Add a step to verify a mock was called
   * @example
   * .verifyMockCalled('emailService', 'sendEmail')
   */
  verifyMockCalled(
    service: string,
    method: string,
    withArgs?: (args: any) => boolean,
    times?: number
  ): this {
    this.addStep({
      action: 'verifyMockCalled',
      service,
      method,
      withArgs,
      times
    });
    return this;
  }

  /**
   * Add a step to set a mock implementation
   * @example
   * .setMock('emailService', 'sendEmail', async () => ({ sent: true }))
   */
  setMock(service: string, method: string, implementation: Function): this {
    this.addStep({
      action: 'setMock',
      service,
      method,
      implementation
    });
    return this;
  }

  /**
   * Add a step to emit an event
   * @example
   * .emitEvent('ORDER_COMPLETED', { orderId: '123' })
   */
  emitEvent(type: string, payload: any): this {
    this.addStep({
      action: 'emitEvent',
      type,
      payload
    });
    return this;
  }

  /**
   * Add a step to execute custom code
   * @example
   * .executeCode((context, runtime) => {
   *   // Custom test logic
   *   return { result: 'success' };
   * })
   */
  executeCode(code: (context: any, runtime: any) => any): this {
    this.addStep({
      action: 'executeCode',
      code
    });
    return this;
  }

  /**
   * Add an expectation for the test
   * @example
   * .expectFinalState('completed')
   */
  expectFinalState(state: string): this {
    if (!this.definition.expected) {
      this.definition.expected = {};
    }
    this.definition.expected.finalState = state;
    return this;
  }

  /**
   * Add expected events to be emitted during the test
   * @example
   * .expectEvents(['ORDER_PROCESSED', 'PAYMENT_COMPLETED'])
   */
  expectEvents(events: string[]): this {
    if (!this.definition.expected) {
      this.definition.expected = {};
    }
    this.definition.expected.events = events;
    return this;
  }

  /**
   * Add expected errors to be thrown during the test
   * @example
   * .expectErrors(['PAYMENT_FAILED'])
   */
  expectErrors(errors: string[]): this {
    if (!this.definition.expected) {
      this.definition.expected = {};
    }
    this.definition.expected.errors = errors;
    return this;
  }

  /**
   * Add expected output for the test
   * @example
   * .expectOutput({ orderProcessed: true, paymentCompleted: true })
   */
  expectOutput(output: Record<string, unknown>): this {
    if (!this.definition.expected) {
      this.definition.expected = {};
    }
    this.definition.expected.output = output;
    return this;
  }

  /**
   * Add a test step
   */
  private addStep(step: TestStep): this {
    if (!this.definition.steps) {
      this.definition.steps = [];
    }
    this.definition.steps.push(step);
    return this;
  }

  /**
   * Add a fluent assertion step
   * @example
   * .thenExpect(system => {
   *   const orderProcess = system.getProcess('order-process', { orderId: '123' });
   *   expect(orderProcess.state).toBe('completed');
   * })
   */
  thenExpect(assertion: (system: any) => void): this {
    return this.executeCode((context, runtime) => {
      assertion({ 
        getProcess: runtime.getProcess,
        getTask: runtime.getTaskDefinition,
        getAllProcesses: runtime.getAllProcesses
      });
    });
  }

  /**
   * Add a step to expect a specific event
   * @example
   * .thenExpectEvent('ORDER_COMPLETED')
   */
  thenExpectEvent(eventType: string, payloadMatcher?: (payload: any) => boolean): this {
    // Add to expected events
    this.expectEvents([...(this.definition.expected?.events || []), eventType]);
    
    // Add verification step
    return this.executeCode((context, runtime) => {
      // This would be implemented in the test runner
      // Here we're just defining the expectation
    });
  }

  /**
   * Builds the complete test definition
   */
  build(): TestDefinition {
    // Validate the definition before returning
    if (!this.definition.name) {
      throw new Error('Test name is required');
    }

    if (!this.definition.steps || this.definition.steps.length === 0) {
      throw new Error('Test must have at least one step');
    }

    // Add initial setup steps if needed
    if (Object.keys(this.initialState).length > 0) {
      // Prepend setup steps
      this.definition.steps = [
        // Setup steps would go here
        ...this.definition.steps
      ];
    }

    return this.definition as TestDefinition;
  }
}

/**
 * Test factory for creating test definitions
 */
export const Test = {
  create: TestBuilder.create
}; 