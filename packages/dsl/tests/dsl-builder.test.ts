import { describe, it, expect } from "vitest";
import {
  createDSLConfig,
  createSchema,
  createFunction,
  createCommand,
  createPipeline,
  createExtensionPoint,
  createExtension,
} from "../src/builder.js";
import { parseDSLConfig } from "../src/parser.js";

describe("DSL Builder", () => {
  describe("GIVEN a DSL builder", () => {
    describe("WHEN building a complete configuration", () => {
      it("THEN it should create a valid DSL configuration", () => {
        // Create a test implementation function
        const validatePaymentImpl = (payment: any) => true;

        // Build the configuration using the builder pattern
        const config = createDSLConfig()
          .withMeta({
            name: "Payment Processing System",
            version: "1.0.0",
            description: "Handles payment transactions with multiple providers",
          })
          .withSchema("PaymentRequest", {
            type: "object",
            required: ["amount", "currency"],
            properties: {
              amount: { type: "number", minimum: 0.01 },
              currency: { type: "string", minLength: 3, maxLength: 3 },
            },
          })
          .withSchema("PaymentResult", {
            type: "object",
            required: ["success"],
            properties: {
              success: { type: "boolean" },
              transactionId: { type: "string" },
            },
          })
          .withFunction("validatePayment", {
            meta: {
              purpose: "Validate payment request data",
              domain: "payment",
              tags: ["validation", "payment"],
            },
            implementation: validatePaymentImpl,
          })
          .withCommand("processPayment", {
            meta: {
              purpose: "Process a payment transaction",
              domain: "payment",
              tags: ["payment", "transaction"],
            },
            input: "PaymentRequest",
            output: "PaymentResult",
            implementation: () => ({ success: true }),
            resilience: {
              retry: {
                maxAttempts: 3,
                backoff: "exponential",
              },
            },
          })
          .withPipeline("paymentProcessing", {
            description: "Payment processing pipeline",
            input: "PaymentRequest",
            output: "PaymentResult",
            steps: [
              { name: "validate", function: "validatePayment" },
              { name: "process", function: "processPayment" },
            ],
            errorHandling: {
              retryable: ["process"],
            },
          })
          .withExtensionPoint("beforePaymentProcessing", {
            description: "Called before processing a payment",
            parameters: ["request", "context"],
          })
          .build();

        // Verify the built configuration
        expect(config).toBeDefined();
        expect(config.meta.name).toBe("Payment Processing System");
        expect(Object.keys(config.schemas)).toHaveLength(2);
        expect(Object.keys(config.functions)).toHaveLength(1);
        expect(Object.keys(config.commands)).toHaveLength(1);
        expect(Object.keys(config.pipelines)).toHaveLength(1);
        expect(Object.keys(config.extensionPoints)).toHaveLength(1);

        // Verify that the built configuration can be parsed
        const parsedConfig = parseDSLConfig(config);
        expect(parsedConfig).toBeDefined();
      });
    });

    describe("WHEN using helper functions", () => {
      it("THEN it should create valid components", () => {
        // Create schema
        const schema = createSchema({
          type: "object",
          properties: {
            test: { type: "string" },
          },
        });
        expect(schema.type).toBe("object");

        // Create function
        const func = createFunction({ purpose: "Test function" }, () => true);
        expect(func.meta.purpose).toBe("Test function");
        expect(typeof func.implementation).toBe("function");

        // Create command
        const command = createCommand(
          { purpose: "Test command" },
          "InputType",
          "OutputType",
          () => ({ result: true }),
        );
        expect(command.meta.purpose).toBe("Test command");
        expect(command.input).toBe("InputType");
        expect(command.output).toBe("OutputType");

        // Create pipeline
        const pipeline = createPipeline("InputType", "OutputType", [
          { name: "step1", function: "testFunction" },
        ]);
        expect(pipeline.input).toBe("InputType");
        expect(pipeline.output).toBe("OutputType");
        expect(pipeline.steps).toHaveLength(1);

        // Create extension point
        const extensionPoint = createExtensionPoint("Test extension point", [
          "param1",
          "param2",
        ]);
        expect(extensionPoint.description).toBe("Test extension point");
        expect(extensionPoint.parameters).toContain("param1");

        // Create extension
        const extension = createExtension(
          { name: "Test Extension" },
          {
            beforeTest: () => console.log("Before test"),
            afterTest: () => console.log("After test"),
          },
        );
        expect(extension.meta.name).toBe("Test Extension");
        expect(Object.keys(extension.hooks)).toHaveLength(2);
        expect(typeof extension.hooks.beforeTest.implementation).toBe(
          "function",
        );
      });
    });

    describe("WHEN building an incomplete configuration", () => {
      it("THEN it should throw an error", () => {
        // Create a builder with only metadata but missing other required sections
        const incompleteBuilder = createDSLConfig().withMeta({
          name: "Incomplete Config",
        });

        // We need to add empty objects for all required sections to test the empty check
        const builder = incompleteBuilder
          .withSchema("EmptySchema", { type: "object" })
          .withFunction("emptyFunction", {
            meta: { purpose: "Empty function" },
            implementation: () => {},
          })
          .withCommand("emptyCommand", {
            meta: { purpose: "Empty command" },
            input: "EmptySchema",
            output: "EmptySchema",
            implementation: () => {},
          });

        // This should still throw because we're missing pipelines and extensionPoints
        expect(() => builder.build()).toThrow(/incomplete/i);
      });
    });
  });
});
