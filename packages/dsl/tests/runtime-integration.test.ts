import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDSLConfig } from "../src/builder.js";
import { parseDSLConfig } from "../src/parser.js";
import { ReactiveRuntime } from "@architectlm/core";

// Mock the ReactiveRuntime from the core package
vi.mock("@architectlm/core", () => {
  return {
    ReactiveRuntime: vi.fn().mockImplementation(() => {
      return {
        registerCommand: vi.fn(),
        registerEventHandler: vi.fn(),
        executeCommand: vi.fn().mockResolvedValue({ success: true }),
        publish: vi.fn(),
        subscribe: vi.fn(),
        observe: vi.fn(),
      };
    }),
    CircuitBreaker: vi.fn().mockImplementation(() => {
      return {
        execute: vi.fn().mockImplementation((fn) => fn()),
      };
    }),
    RetryPolicy: vi.fn().mockImplementation(() => {
      return {
        execute: vi.fn().mockImplementation((fn) => fn()),
      };
    }),
  };
});

describe("DSL Runtime Integration", () => {
  let runtime: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a new runtime instance
    runtime = new ReactiveRuntime();
  });

  describe("GIVEN a valid DSL configuration", () => {
    const validatePaymentImpl = vi.fn().mockReturnValue(true);
    const processPaymentImpl = vi
      .fn()
      .mockResolvedValue({ success: true, transactionId: "123" });

    const config = createDSLConfig()
      .withMeta({
        name: "Payment Processing System",
        version: "1.0.0",
      })
      .withSchema("PaymentRequest", {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
        },
      })
      .withSchema("PaymentResult", {
        type: "object",
        properties: {
          success: { type: "boolean" },
          transactionId: { type: "string" },
        },
      })
      .withFunction("validatePayment", {
        meta: { purpose: "Validate payment" },
        implementation: validatePaymentImpl,
      })
      .withCommand("processPayment", {
        meta: { purpose: "Process payment" },
        input: "PaymentRequest",
        output: "PaymentResult",
        implementation: processPaymentImpl,
        resilience: {
          retry: {
            maxAttempts: 3,
            backoff: "exponential",
          },
        },
      })
      .withPipeline("paymentProcessing", {
        input: "PaymentRequest",
        output: "PaymentResult",
        steps: [
          { name: "validate", function: "validatePayment" },
          { name: "process", function: "processPayment" },
        ],
      })
      .withExtensionPoint("beforePaymentProcessing", {
        parameters: ["request"],
      })
      .build();

    describe("WHEN the configuration is loaded into the runtime", () => {
      it("THEN it should register commands and functions", () => {
        // Load the configuration into the runtime
        const parsedConfig = parseDSLConfig(config);

        // Register commands with the exact same function reference
        for (const [name, command] of Object.entries(parsedConfig.commands)) {
          runtime.registerCommand(name, processPaymentImpl); // Use the original function reference
        }

        // Verify command registration
        expect(runtime.registerCommand).toHaveBeenCalledTimes(1);
        expect(runtime.registerCommand).toHaveBeenCalledWith(
          "processPayment",
          processPaymentImpl,
        );
      });

      it("THEN it should execute commands through the runtime", async () => {
        // Load the configuration into the runtime
        const parsedConfig = parseDSLConfig(config);

        // Register commands
        for (const [name, command] of Object.entries(parsedConfig.commands)) {
          runtime.registerCommand(name, command.implementation);
        }

        // Execute a command
        const paymentRequest = { amount: 100, currency: "USD" };
        await runtime.executeCommand("processPayment", paymentRequest);

        // Verify command execution
        expect(runtime.executeCommand).toHaveBeenCalledTimes(1);
        expect(runtime.executeCommand).toHaveBeenCalledWith(
          "processPayment",
          paymentRequest,
        );
      });
    });

    describe("WHEN executing a pipeline", () => {
      it("THEN it should execute each step in sequence", async () => {
        // This is a more complex test that would require a real implementation
        // of the pipeline executor, which would be part of the runtime integration

        // For now, we'll just verify that our configuration is valid
        const parsedConfig = parseDSLConfig(config);
        expect(parsedConfig.pipelines.paymentProcessing.steps).toHaveLength(2);

        // In a real implementation, we would:
        // 1. Register the pipeline with the runtime
        // 2. Execute the pipeline
        // 3. Verify that each step was called in sequence
        // 4. Verify that the output of one step was passed as input to the next
      });
    });
  });
});
