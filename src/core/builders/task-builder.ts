/**
 * Task Builder - Fluent API for defining tasks
 */
import { z } from 'zod';
import { TaskDefinition, TaskImplementation, TaskContext } from '../types';

/**
 * Builder class for creating task definitions with a fluent interface
 */
export class TaskBuilder<Input = any, Output = any, State = any> {
  private definition: Partial<TaskDefinition<Input, Output, State>> = {};

  /**
   * Create a new task with the given ID
   * @example
   * const processOrderTask = Task.create('process-order')
   *   .withDescription('Processes an order for fulfillment')
   *   .withImplementation(async (input, context) => {
   *     // Implementation
   *     return { processed: true };
   *   });
   */
  static create<I = any, O = any, S = any>(id: string): TaskBuilder<I, O, S> {
    const builder = new TaskBuilder<I, O, S>();
    builder.definition.id = id;
    return builder;
  }

  /**
   * Add a description to help understand the task purpose
   * @example
   * .withDescription('Processes an order and updates inventory')
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Set the implementation function for the task
   * @example
   * .withImplementation(async (input, context) => {
   *   // Task implementation
   *   return { processed: true };
   * })
   */
  withImplementation(implementation: TaskImplementation<Input, Output, State>): this {
    this.definition.implementation = implementation;
    return this;
  }

  /**
   * Add a schema for validating task input
   * @example
   * .withInputSchema(z.object({
   *   orderId: z.string(),
   *   items: z.array(z.object({
   *     productId: z.string(),
   *     quantity: z.number().positive()
   *   }))
   * }))
   */
  withInputSchema<T extends Input>(schema: z.ZodType<T>): TaskBuilder<T, Output, State> {
    (this.definition as any).inputSchema = schema;
    return this as any;
  }

  /**
   * Add a schema for validating task output
   * @example
   * .withOutputSchema(z.object({
   *   processed: z.boolean(),
   *   orderNumber: z.string()
   * }))
   */
  withOutputSchema<T extends Output>(schema: z.ZodType<T>): TaskBuilder<Input, T, State> {
    (this.definition as any).outputSchema = schema;
    return this as any;
  }

  /**
   * Add an error handler for the task
   * @example
   * .withErrorHandler(async (error, input, context) => {
   *   context.emitEvent('TASK_FAILED', { error: error.message });
   * })
   */
  withErrorHandler(
    handler: (error: Error, input: Input, context: TaskContext<State>) => Promise<void>
  ): this {
    this.definition.onError = handler;
    return this;
  }

  /**
   * Add a success handler for the task
   * @example
   * .withSuccessHandler(async (result, input, context) => {
   *   context.emitEvent('TASK_SUCCEEDED', { result });
   * })
   */
  withSuccessHandler(
    handler: (result: Output, input: Input, context: TaskContext<State>) => Promise<void>
  ): this {
    this.definition.onSuccess = handler;
    return this;
  }

  /**
   * Set a timeout for the task execution
   * @example
   * .withTimeout(5000) // 5 seconds
   */
  withTimeout(timeoutMs: number): this {
    this.definition.timeout = timeoutMs;
    return this;
  }

  /**
   * Configure retry behavior for the task
   * @example
   * .withRetry({
   *   maxAttempts: 3,
   *   backoff: 'exponential',
   *   delayMs: 1000
   * })
   */
  withRetry(config: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  }): this {
    this.definition.retry = config;
    return this;
  }

  /**
   * Add metadata to the task
   * @example
   * .withMetadata({
   *   version: '1.0.0',
   *   owner: 'order-team',
   *   tags: ['critical', 'core']
   * })
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = {
      ...this.definition.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Builds the complete task definition
   */
  build(): TaskDefinition<Input, Output, State> {
    // Validate the definition before returning
    if (!this.definition.id) {
      throw new Error('Task ID is required');
    }

    if (!this.definition.implementation) {
      throw new Error('Task implementation is required');
    }

    return this.definition as TaskDefinition<Input, Output, State>;
  }
}

/**
 * Task factory for creating task definitions
 */
export const Task = {
  create: TaskBuilder.create
}; 