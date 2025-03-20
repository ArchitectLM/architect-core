/**
 * Task Builder - Fluent API for defining tasks
 */
import { z } from 'zod';
import { TaskDefinition, TaskImplementation, TaskContext } from '../types';

/**
 * Builder class for creating task definitions with a fluent interface
 */
export class TaskBuilder<Input = any, Output = any> {
  private definition: Partial<TaskDefinition<Input, Output>> = {};

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
  static create<I = any, O = any>(id: string): TaskBuilder<I, O> {
    const builder = new TaskBuilder<I, O>();
    builder.definition.id = id;
    return builder;
  }

  /**
   * Set the task description
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Set the task implementation function
   */
  withImplementation(implementation: TaskImplementation<Input, Output>): this {
    this.definition.implementation = implementation;
    return this;
  }

  /**
   * Set the input schema for validation
   */
  withInputSchema<T extends Input>(schema: z.ZodType<T>): TaskBuilder<T, Output> {
    const builder = this as unknown as TaskBuilder<T, Output>;
    builder.definition.inputSchema = schema;
    return builder;
  }

  /**
   * Set the output schema for validation
   */
  withOutputSchema<T extends Output>(schema: z.ZodType<T>): TaskBuilder<Input, T> {
    const builder = this as unknown as TaskBuilder<Input, T>;
    builder.definition.outputSchema = schema;
    return builder;
  }

  /**
   * Set the error handler
   */
  withErrorHandler(
    handler: (error: Error, input: Input, context: TaskContext) => Promise<void>
  ): this {
    this.definition.errorHandler = handler;
    return this;
  }

  /**
   * Set the success handler
   */
  withSuccessHandler(
    handler: (result: Output, input: Input, context: TaskContext) => Promise<void>
  ): this {
    this.definition.successHandler = handler;
    return this;
  }

  /**
   * Set the task timeout
   */
  withTimeout(timeoutMs: number): this {
    this.definition.timeout = timeoutMs;
    return this;
  }

  /**
   * Set the retry policy
   */
  withRetry(config: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  }): this {
    this.definition.retry = {
      maxAttempts: config.maxAttempts,
      backoff: config.backoff,
      delayMs: config.delayMs
    };
    return this;
  }

  /**
   * Set additional metadata
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = metadata;
    return this;
  }

  /**
   * Build the task definition
   */
  build(): TaskDefinition<Input, Output> {
    if (!this.definition.id) {
      throw new Error('Task ID is required');
    }

    if (!this.definition.implementation) {
      throw new Error('Task implementation is required');
    }

    return this.definition as TaskDefinition<Input, Output>;
  }
}

/**
 * Task factory for creating task definitions
 */
export const Task = {
  create: TaskBuilder.create
}; 