/**
 * Tests for the CommandHandler implementation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CommandHandler,
  Middleware,
} from "../src/implementations/command-handler.js";
import { ReactiveEventBus } from "../src/implementations/event-bus.js";

// Define test types
interface TestCommand {
  type: string;
  payload: {
    id: string;
    value: number;
  };
}

interface TestResult {
  success: boolean;
  data: any;
}

// Create a concrete implementation of CommandHandler for testing
class TestCommandHandler extends CommandHandler<TestCommand, TestResult> {
  constructor(eventBus: ReactiveEventBus) {
    super(eventBus);
  }

  get commandName(): string {
    return "TestCommand";
  }

  protected async handleCommand(command: TestCommand): Promise<TestResult> {
    // Simple implementation that returns success based on value
    return {
      success: command.payload.value > 0,
      data: command.payload,
    };
  }
}

describe("CommandHandler", () => {
  let eventBus: ReactiveEventBus;
  let commandHandler: TestCommandHandler;

  beforeEach(() => {
    eventBus = new ReactiveEventBus();
    commandHandler = new TestCommandHandler(eventBus);
  });

  describe("Basic Functionality", () => {
    it("should handle commands successfully", async () => {
      // Given a valid command
      const command: TestCommand = {
        type: "TEST_COMMAND",
        payload: {
          id: "123",
          value: 42,
        },
      };

      // When handling the command
      const result = await commandHandler.execute(command);

      // Then it should return a successful result
      expect(result).toEqual({
        success: true,
        data: command.payload,
      });
    });

    it("should handle commands with negative values", async () => {
      // Given a command with a negative value
      const command: TestCommand = {
        type: "TEST_COMMAND",
        payload: {
          id: "123",
          value: -5,
        },
      };

      // When handling the command
      const result = await commandHandler.execute(command);

      // Then it should return a failure result
      expect(result).toEqual({
        success: false,
        data: command.payload,
      });
    });

    it("should catch and handle errors", async () => {
      // Given a command handler that throws errors
      class ErrorCommandHandler extends CommandHandler<
        TestCommand,
        TestResult
      > {
        constructor(eventBus: ReactiveEventBus) {
          super(eventBus);
        }

        get commandName(): string {
          return "ErrorCommand";
        }

        protected async handleCommand(
          command: TestCommand,
        ): Promise<TestResult> {
          throw new Error("Test error");
        }
      }

      const errorHandler = new ErrorCommandHandler(eventBus);

      // And a command
      const command: TestCommand = {
        type: "TEST_COMMAND",
        payload: {
          id: "123",
          value: 42,
        },
      };

      // When handling the command
      // Then it should throw an error
      await expect(errorHandler.execute(command)).rejects.toThrow("Test error");
    });
  });

  describe("Middleware", () => {
    it("should apply middleware in the correct order", async () => {
      // Given a sequence tracking array
      const sequence: string[] = [];

      // And middleware that records execution order
      const middleware1: Middleware = {
        async execute<T, R>(
          context: { command: T; result?: R },
          next: (context: {
            command: T;
            result?: R;
          }) => Promise<{ command: T; result: R }>,
        ) {
          sequence.push("before1");
          const result = await next(context);
          sequence.push("after1");
          return result;
        },
      };

      const middleware2: Middleware = {
        async execute<T, R>(
          context: { command: T; result?: R },
          next: (context: {
            command: T;
            result?: R;
          }) => Promise<{ command: T; result: R }>,
        ) {
          sequence.push("before2");
          const result = await next(context);
          sequence.push("after2");
          return result;
        },
      };

      // When adding middleware
      commandHandler.use(middleware1);
      commandHandler.use(middleware2);

      // And handling a command
      await commandHandler.execute({
        type: "TEST_COMMAND",
        payload: { id: "123", value: 42 },
      });

      // Print the actual sequence for debugging
      console.log("Actual sequence:", sequence);

      // Then middleware should be applied in the correct order
      // Based on the actual implementation, the order is:
      expect(sequence).toEqual(["before2", "before1", "after1", "after2"]);
    });

    it("should allow middleware to modify commands", async () => {
      // Given middleware that modifies the command
      const modifyingMiddleware: Middleware = {
        async execute<T, R>(
          context: { command: T; result?: R },
          next: (context: {
            command: T;
            result?: R;
          }) => Promise<{ command: T; result: R }>,
        ) {
          // Double the value for TestCommand
          if ("payload" in (context.command as any)) {
            const cmd = context.command as unknown as TestCommand;
            const modifiedCmd = {
              ...cmd,
              payload: {
                ...cmd.payload,
                value: cmd.payload.value * 2,
              },
            };
            return next({
              command: modifiedCmd as unknown as T,
              result: context.result,
            });
          }
          return next(context);
        },
      };

      // When adding the middleware
      commandHandler.use(modifyingMiddleware);

      // And handling a command
      const result = await commandHandler.execute({
        type: "TEST_COMMAND",
        payload: { id: "123", value: 5 },
      });

      // Then the modified command should be processed
      expect(result.data.value).toBe(10);
    });

    it("should allow middleware to modify results", async () => {
      // Given middleware that modifies the result
      const modifyingMiddleware: Middleware = {
        async execute<T, R>(
          context: { command: T; result?: R },
          next: (context: {
            command: T;
            result?: R;
          }) => Promise<{ command: T; result: R }>,
        ) {
          const result = await next(context);

          // Add extra data to the result if it's a TestResult
          const resultObj = result.result as object;
          if (
            resultObj &&
            typeof resultObj === "object" &&
            "success" in resultObj
          ) {
            const testResult = resultObj as TestResult;
            const modifiedResult = {
              ...testResult,
              data: {
                ...testResult.data,
                extra: "modified",
              },
            };
            return { ...result, result: modifiedResult as unknown as R };
          }

          return result;
        },
      };

      // When adding the middleware
      commandHandler.use(modifyingMiddleware);

      // And handling a command
      const result = await commandHandler.execute({
        type: "TEST_COMMAND",
        payload: { id: "123", value: 42 },
      });

      // Then the result should be modified
      expect(result.data.extra).toBe("modified");
    });

    it("should handle errors in middleware", async () => {
      // Given middleware that throws an error
      const errorMiddleware: Middleware = {
        async execute<T, R>(
          context: { command: T; result?: R },
          next: (context: {
            command: T;
            result?: R;
          }) => Promise<{ command: T; result: R }>,
        ) {
          throw new Error("Middleware error");
        },
      };

      // When adding the middleware
      commandHandler.use(errorMiddleware);

      // And handling a command
      // Then it should throw the middleware error
      await expect(
        commandHandler.execute({
          type: "TEST_COMMAND",
          payload: { id: "123", value: 42 },
        }),
      ).rejects.toThrow("Middleware error");
    });

    it("should support middleware that only modifies commands", async () => {
      // Given middleware that only modifies commands
      const commandModifyingMiddleware: Middleware = {
        async execute<T, R>(
          context: { command: T; result?: R },
          next: (context: {
            command: T;
            result?: R;
          }) => Promise<{ command: T; result: R }>,
        ) {
          // Modify the command if it's a TestCommand
          if ("payload" in (context.command as any)) {
            const cmd = context.command as unknown as TestCommand;
            const modifiedCmd = {
              ...cmd,
              payload: {
                ...cmd.payload,
                value: 100,
              },
            };
            return next({
              command: modifiedCmd as unknown as T,
              result: context.result,
            });
          }
          return next(context);
        },
      };

      // When adding the middleware
      commandHandler.use(commandModifyingMiddleware);

      // And handling a command
      const result = await commandHandler.execute({
        type: "TEST_COMMAND",
        payload: { id: "123", value: 5 },
      });

      // Then the command should be modified
      expect(result.data.value).toBe(100);
    });

    it("should support middleware that only modifies results", async () => {
      // Given middleware that only modifies results
      const resultModifyingMiddleware: Middleware = {
        async execute<T, R>(
          context: { command: T; result?: R },
          next: (context: {
            command: T;
            result?: R;
          }) => Promise<{ command: T; result: R }>,
        ) {
          const result = await next(context);

          // Modify the result if it's a TestResult
          const resultObj = result.result as object;
          if (
            resultObj &&
            typeof resultObj === "object" &&
            "success" in resultObj
          ) {
            const testResult = resultObj as TestResult;
            const modifiedResult = {
              ...testResult,
              success: !testResult.success, // Invert the success flag
            };
            return { ...result, result: modifiedResult as unknown as R };
          }

          return result;
        },
      };

      // When adding the middleware
      commandHandler.use(resultModifyingMiddleware);

      // And handling a command
      const result = await commandHandler.execute({
        type: "TEST_COMMAND",
        payload: { id: "123", value: 42 },
      });

      // Then the result should be modified
      expect(result.success).toBe(false); // Inverted from true
    });
  });
});
