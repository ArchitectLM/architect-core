/**
 * Task builder
 */
export class TaskBuilder<TInput = any, TOutput = any> {
  private id: string;
  private name: string;
  private description?: string;
  private implementation?: (input: TInput, context: any) => Promise<TOutput>;
  private errorHandler?: (error: any, input: TInput, context: any) => Promise<TOutput>;
  private metadata: Record<string, any> = {};

  constructor(id: string) {
    this.id = id;
    this.name = id;
  }

  /**
   * Create a new task builder
   */
  static create<TInput = any, TOutput = any>(id: string): TaskBuilder<TInput, TOutput> {
    return new TaskBuilder<TInput, TOutput>(id);
  }

  /**
   * Set the name of the task
   */
  withName(name: string): TaskBuilder<TInput, TOutput> {
    this.name = name;
    return this;
  }

  /**
   * Set the description of the task
   */
  withDescription(description: string): TaskBuilder<TInput, TOutput> {
    this.description = description;
    return this;
  }

  /**
   * Set the implementation of the task
   */
  withImplementation(implementation: (input: TInput, context: any) => Promise<TOutput>): TaskBuilder<TInput, TOutput> {
    this.implementation = implementation;
    return this;
  }

  /**
   * Set the error handler of the task
   */
  withErrorHandler(errorHandler: (error: any, input: TInput, context: any) => Promise<TOutput>): TaskBuilder<TInput, TOutput> {
    this.errorHandler = errorHandler;
    return this;
  }

  /**
   * Build the task
   */
  build(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      implementation: this.implementation,
      errorHandler: this.errorHandler,
      metadata: this.metadata
    };
  }
}
