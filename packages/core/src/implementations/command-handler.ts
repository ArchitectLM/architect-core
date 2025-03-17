/**
 * Command Handler Implementation
 *
 * This file implements the command handler pattern with middleware support.
 */

import { ReactiveEventBus } from './event-bus.js';

/**
 * Middleware interface for command processing pipeline
 */
export type Middleware = {
  execute: <T, R>(
    context: { command: T; result?: R },
    next: (context: { command: T; result?: R }) => Promise<{ command: T; result: R }>
  ) => Promise<{ command: T; result: R }>;
};

// Also export a class to ensure it's preserved in JavaScript
export class MiddlewareImpl implements Middleware {
  constructor(
    private executeFn: <T, R>(
      context: { command: T; result?: R },
      next: (context: { command: T; result?: R }) => Promise<{ command: T; result: R }>
    ) => Promise<{ command: T; result: R }>
  ) {}

  execute<T, R>(
    context: { command: T; result?: R },
    next: (context: { command: T; result?: R }) => Promise<{ command: T; result: R }>
  ): Promise<{ command: T; result: R }> {
    return this.executeFn(context, next);
  }
}

/**
 * Abstract CommandHandler class with middleware support
 */
export abstract class CommandHandler<TCommand, TResult> {
  private middleware: Middleware[] = [];

  constructor(private eventBus: ReactiveEventBus) {}

  /**
   * Register middleware to be executed in the pipeline
   */
  use(middleware: Middleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Execute the command with the middleware pipeline
   */
  async execute(command: TCommand): Promise<TResult> {
    let context = { command, result: undefined as unknown as TResult };

    // Create middleware pipeline (functional composition)
    const pipeline = this.middleware.reduce(
      (next, middleware) => async (ctx: { command: TCommand; result?: TResult }) => 
        middleware.execute<TCommand, TResult>(ctx, next as any),
      async (ctx: { command: TCommand; result?: TResult }) => {
        ctx.result = await this.handleCommand(ctx.command);
        return ctx as { command: TCommand; result: TResult };
      }
    );

    // Execute pipeline
    context = await pipeline(context);

    // Emit result event
    this.eventBus.publish(`${this.commandName}Completed`, {
      command,
      result: context.result,
    });

    return context.result;
  }

  /**
   * Command name (used for event naming)
   */
  abstract get commandName(): string;

  /**
   * Actual command implementation (template method pattern)
   */
  protected abstract handleCommand(command: TCommand): Promise<TResult>;
}
