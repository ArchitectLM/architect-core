import { describe, it, expect } from "vitest";
import { parseDSLConfig } from "../src/parser.js";
import {
  DSLConfig,
  Schema,
  Function,
  Pipeline,
  ExtensionPoint,
} from "../src/models.js";

describe("DSL Configuration Parser", () => {
  describe("GIVEN a valid DSL configuration", () => {
    const validConfig = {
      meta: {
        name: "Payment Processing System",
        version: "1.0.0",
        description: "Handles payment transactions with multiple providers",
      },
      schemas: {
        PaymentRequest: {
          type: "object",
          required: ["amount", "currency", "paymentMethod"],
          properties: {
            amount: { type: "number", minimum: 0.01 },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            paymentMethod: {
              type: "object",
              required: ["type"],
              discriminator: { propertyName: "type" },
              oneOf: [
                {
                  title: "Card",
                  properties: {
                    type: { enum: ["card"] },
                    cardNumber: { type: "string", pattern: "^[0-9]{16}$" },
                  },
                },
              ],
            },
          },
        },
        PaymentResult: {
          type: "object",
          required: ["success"],
          properties: {
            success: { type: "boolean" },
            transactionId: { type: "string" },
          },
        },
      },
      functions: {
        validatePayment: {
          meta: {
            purpose: "Validate payment request data",
            domain: "payment",
            tags: ["validation", "payment"],
          },
          implementation: () => true, // Mock implementation for testing
        },
        handlePaymentError: {
          meta: {
            purpose: "Handle payment errors",
            domain: "payment",
            tags: ["error", "payment"],
          },
          implementation: () => ({ success: false }), // Mock implementation for testing
        },
      },
      commands: {
        processPayment: {
          meta: {
            purpose: "Process a payment transaction",
            domain: "payment",
            tags: ["payment", "transaction", "core"],
          },
          input: "PaymentRequest",
          output: "PaymentResult",
          implementation: () => ({ success: true }), // Mock implementation
          resilience: {
            circuitBreaker: { failureThreshold: 5, resetTimeout: 30000 },
            retry: { maxAttempts: 3, backoff: "exponential" },
          },
        },
      },
      pipelines: {
        paymentProcessing: {
          description: "End-to-end payment processing flow",
          input: "PaymentRequest",
          output: "PaymentResult",
          steps: [
            { name: "validate", function: "validatePayment" },
            { name: "process", function: "processPayment" },
          ],
          errorHandling: {
            fallback: "handlePaymentError",
            retryable: ["process"],
          },
        },
      },
      extensionPoints: {
        beforePaymentProcessing: {
          description: "Called before processing a payment",
          parameters: ["request", "context"],
        },
      },
    };

    describe("WHEN the configuration is parsed", () => {
      it("THEN it should return a valid DSLConfig object", () => {
        const result = parseDSLConfig(validConfig);
        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(Object);
        expect(result.meta).toEqual(validConfig.meta);
      });

      it("THEN it should correctly parse schemas", () => {
        const result = parseDSLConfig(validConfig);
        expect(result.schemas).toBeDefined();
        expect(Object.keys(result.schemas).length).toBe(2);
        expect(result.schemas.PaymentRequest).toBeDefined();
        expect(result.schemas.PaymentRequest.type).toBe("object");
        expect(result.schemas.PaymentResult).toBeDefined();
        expect(result.schemas.PaymentResult.type).toBe("object");
      });

      it("THEN it should correctly parse functions", () => {
        const result = parseDSLConfig(validConfig);
        expect(result.functions).toBeDefined();
        expect(Object.keys(result.functions).length).toBe(2);
        expect(result.functions.validatePayment).toBeDefined();
        expect(result.functions.validatePayment.meta.purpose).toBe(
          "Validate payment request data",
        );
        expect(typeof result.functions.validatePayment.implementation).toBe(
          "function",
        );
        expect(result.functions.handlePaymentError).toBeDefined();
        expect(result.functions.handlePaymentError.meta.purpose).toBe(
          "Handle payment errors",
        );
        expect(typeof result.functions.handlePaymentError.implementation).toBe(
          "function",
        );
      });

      it("THEN it should correctly parse commands", () => {
        const result = parseDSLConfig(validConfig);
        expect(result.commands).toBeDefined();
        expect(Object.keys(result.commands).length).toBe(1);
        expect(result.commands.processPayment).toBeDefined();
        expect(result.commands.processPayment.input).toBe("PaymentRequest");

        // Check resilience configuration with null checks
        expect(result.commands.processPayment.resilience).toBeDefined();
        if (result.commands.processPayment.resilience) {
          expect(result.commands.processPayment.resilience.retry).toBeDefined();
          if (result.commands.processPayment.resilience.retry) {
            expect(
              result.commands.processPayment.resilience.retry.maxAttempts,
            ).toBe(3);
          }
        }
      });

      it("THEN it should correctly parse pipelines", () => {
        const result = parseDSLConfig(validConfig);
        expect(result.pipelines).toBeDefined();
        expect(Object.keys(result.pipelines).length).toBe(1);
        expect(result.pipelines.paymentProcessing).toBeDefined();
        expect(result.pipelines.paymentProcessing.steps.length).toBe(2);

        // Check error handling with null checks
        expect(result.pipelines.paymentProcessing.errorHandling).toBeDefined();
        if (result.pipelines.paymentProcessing.errorHandling) {
          expect(
            result.pipelines.paymentProcessing.errorHandling.retryable,
          ).toContain("process");
        }
      });

      it("THEN it should correctly parse extension points", () => {
        const result = parseDSLConfig(validConfig);
        expect(result.extensionPoints).toBeDefined();
        expect(Object.keys(result.extensionPoints).length).toBe(1);
        expect(result.extensionPoints.beforePaymentProcessing).toBeDefined();
        expect(
          result.extensionPoints.beforePaymentProcessing.parameters,
        ).toContain("request");
      });
    });
  });

  describe("GIVEN an invalid DSL configuration", () => {
    describe("WHEN the configuration is missing required fields", () => {
      it("THEN it should throw a validation error", () => {
        const invalidConfig = {
          // Missing meta and other required sections
          schemas: {},
        };

        expect(() => parseDSLConfig(invalidConfig)).toThrow();
      });
    });

    describe("WHEN a schema references an undefined type", () => {
      it("THEN it should throw a validation error", () => {
        const invalidConfig = {
          meta: { name: "Test", version: "1.0.0" },
          schemas: {
            TestType: { type: "object" },
          },
          functions: {
            testFunction: {
              meta: { purpose: "Test function" },
              implementation: () => {},
            },
          },
          commands: {
            testCommand: {
              meta: { purpose: "Test command" },
              input: "UndefinedType", // This type doesn't exist
              output: "TestType",
              implementation: () => ({}),
            },
          },
          pipelines: {
            testPipeline: {
              input: "TestType",
              output: "TestType",
              steps: [{ name: "step1", function: "testFunction" }],
            },
          },
          extensionPoints: {
            testExtensionPoint: {
              description: "Test extension point",
              parameters: [],
            },
          },
        };

        expect(() => parseDSLConfig(invalidConfig)).toThrow(/undefined type/i);
      });
    });

    describe("WHEN a pipeline references an undefined function", () => {
      it("THEN it should throw a validation error", () => {
        const invalidConfig = {
          meta: { name: "Test", version: "1.0.0" },
          schemas: {
            TestType: { type: "object" },
          },
          functions: {},
          commands: {},
          pipelines: {
            testPipeline: {
              input: "TestType",
              output: "TestType",
              steps: [
                { name: "step1", function: "undefinedFunction" }, // This function doesn't exist
              ],
            },
          },
          extensionPoints: {},
        };

        expect(() => parseDSLConfig(invalidConfig)).toThrow(
          /undefined function/i,
        );
      });
    });
  });
});
