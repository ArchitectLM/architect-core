/**
 * Command Handler Implementation
 *
 * This file implements the command handler pattern with middleware support.
 */

import { ReactiveEventBus } from './event-bus.js';

/**
 * Middleware interface for command processing pipeline
 */
export interface Middleware {
  execute: <T, R>(
    context: { command: T; result?: R },
    next: (context: { command: T; result?: R }) => Promise<{ command: T; result: R }>
  ) => Promise<{ command: T; result: R }>;
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
      (next, middleware) => async ctx => middleware.execute(ctx, next),
      async ctx => {
        ctx.result = await this.handleCommand(ctx.command);
        return ctx;
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
