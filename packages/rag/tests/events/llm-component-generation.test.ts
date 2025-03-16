import { describe, it, expect, vi, beforeEach } from "vitest";
import { RAGEventHandler } from "../../src/events/rag-event-handler.js";
import { Component, ComponentType } from "../../src/models.js";

// Mock ReactiveEventBus
const mockEventBus = {
  subscribe: vi.fn(),
  publish: vi.fn(),
};

// Mock VectorDBConnector
const mockVectorDBConnector = {
  initialize: vi.fn().mockResolvedValue(undefined),
  addDocument: vi.fn().mockResolvedValue("doc1"),
  addDocuments: vi.fn().mockResolvedValue(["doc1", "doc2"]),
  search: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockImplementation((id: string) => {
    if (id === "doc1") {
      return Promise.resolve({
        id: "doc1",
        type: ComponentType.Function,
        name: "processPayment",
        content:
          "function processPayment(amount: number) { return amount * 1.1; }",
        metadata: {
          path: "src/functions/payment.ts",
          description: "Processes a payment transaction with a 10% fee",
        },
      });
    }
    return Promise.resolve(null);
  }),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
};

// Mock LLM Service
const mockLLMService = {
  generateComponent: vi
    .fn()
    .mockImplementation((request: string, componentType: ComponentType) => {
      // Generate a component based on the request and type
      const component: Component = {
        type: componentType,
        name:
          componentType === ComponentType.Function
            ? "calculateDiscount"
            : componentType === ComponentType.Extension
              ? "DiscountExtension"
              : "DiscountCommand",
        content:
          componentType === ComponentType.Function
            ? "function calculateDiscount(amount: number, discountPercent: number) { return amount * (1 - discountPercent / 100); }"
            : componentType === ComponentType.Extension
              ? "class DiscountExtension { applyDiscount(amount: number, discountPercent: number) { return amount * (1 - discountPercent / 100); } }"
              : "class DiscountCommand { execute(amount: number, discountPercent: number) { return amount * (1 - discountPercent / 100); } }",
        metadata: {
          path: "",
          description: `Generated ${componentType} for calculating discounts based on user request: "${request}"`,
          createdAt: Date.now(),
          author: "LLM",
        },
      };

      return Promise.resolve(component);
    }),
  generateFeedback: vi
    .fn()
    .mockImplementation((component: Component, userRequest: string) => {
      return Promise.resolve(`
# Educational Feedback for ${component.name}

## Component Overview
This ${component.type} was created to address your request: "${userRequest}".

## Implementation Details
The component implements a ${component.type === ComponentType.Function ? "function" : "class"} that:
- Takes numeric input parameters
- Performs calculations based on those parameters
- Returns a modified value

## Best Practices Applied
- Clear naming conventions
- Type safety with TypeScript
- Single responsibility principle

## How to Use This Component
\`\`\`typescript
// Example usage:
${
  component.type === ComponentType.Function
    ? `const result = ${component.name}(100, 20); // Apply 20% discount to $100`
    : `const instance = new ${component.name}();
const result = instance.${component.type === ComponentType.Extension ? "applyDiscount" : "execute"}(100, 20); // Apply 20% discount to $100`
}
\`\`\`

## How to Extend This Component
You can enhance this component by:
- Adding validation for input parameters
- Supporting additional discount types
- Adding logging or telemetry
    `);
    }),
};

describe("LLM Component Generation", () => {
  let eventHandler: RAGEventHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandler = new RAGEventHandler(
      mockEventBus,
      mockVectorDBConnector,
      mockLLMService,
    );
  });

  describe("GIVEN a RAG event handler with LLM capabilities", () => {
    describe("WHEN initializing", () => {
      it("THEN should subscribe to component generation and feedback events", async () => {
        await eventHandler.initialize();

        // Check for the standard subscriptions
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
          "component.created",
          expect.any(Function),
        );
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
          "component.updated",
          expect.any(Function),
        );
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
          "component.deleted",
          expect.any(Function),
        );
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
          "component.indexed",
          expect.any(Function),
        );

        // Check for the new subscriptions
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
          "component.generate",
          expect.any(Function),
        );
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
          "component.feedback",
          expect.any(Function),
        );
      });
    });

    describe("WHEN handling a component.generate event with no similar components", () => {
      it("THEN should generate a new component using LLM", async () => {
        // Mock the search to return empty results
        mockVectorDBConnector.search.mockResolvedValueOnce([]);

        // Set up the request
        const request = "Create a function to calculate discounts";
        const componentType = ComponentType.Function;
        const fallbackPath = "src/functions/discount.ts";

        // Handle the generate event
        await eventHandler.handleComponentGenerate({
          request,
          componentType,
          fallbackPath,
        });

        // Verify the LLM service was called
        expect(mockLLMService.generateComponent).toHaveBeenCalledWith(
          request,
          componentType,
        );

        // Verify the component was added to the database
        expect(mockVectorDBConnector.addDocument).toHaveBeenCalled();

        // Verify the generated event was published
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.generated",
          expect.objectContaining({
            request,
            component: expect.objectContaining({
              type: componentType,
              name: "calculateDiscount",
            }),
            id: "doc1",
          }),
        );
      });

      it("THEN should set the fallback path if none is provided", async () => {
        // Mock the search to return empty results
        mockVectorDBConnector.search.mockResolvedValueOnce([]);

        // Set up the request
        const request = "Create a function to calculate discounts";
        const componentType = ComponentType.Function;
        const fallbackPath = "src/functions/discount.ts";

        // Mock the LLM service to return a component without a path
        mockLLMService.generateComponent.mockResolvedValueOnce({
          type: componentType,
          name: "calculateDiscount",
          content:
            "function calculateDiscount(amount: number, discountPercent: number) { return amount * (1 - discountPercent / 100); }",
          metadata: {
            path: "", // Empty path
            description: "Generated function for calculating discounts",
          },
        });

        // Handle the generate event
        await eventHandler.handleComponentGenerate({
          request,
          componentType,
          fallbackPath,
        });

        // Verify the component was added with the fallback path
        expect(mockVectorDBConnector.addDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              path: fallbackPath,
            }),
          }),
        );
      });
    });

    describe("WHEN handling a component.generate event with similar components", () => {
      it("THEN should return the similar components instead of generating new ones", async () => {
        // Mock search results
        const mockResults = [
          {
            component: {
              id: "existing1",
              type: ComponentType.Function,
              name: "applyDiscount",
              content:
                "function applyDiscount(price: number, percent: number) { return price * (1 - percent / 100); }",
              metadata: {
                path: "src/functions/discount.ts",
                description: "Applies a percentage discount to a price",
              },
            },
            score: 0.95,
          },
        ];

        // Mock the search to return results
        mockVectorDBConnector.search.mockResolvedValueOnce(mockResults);

        // Set up the request
        const request = "Create a function to calculate discounts";
        const componentType = ComponentType.Function;

        // Handle the generate event
        await eventHandler.handleComponentGenerate({
          request,
          componentType,
        });

        // Verify the LLM service was NOT called
        expect(mockLLMService.generateComponent).not.toHaveBeenCalled();

        // Verify the similar components event was published
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.similar.found",
          expect.objectContaining({
            request,
            results: mockResults,
          }),
        );
      });
    });

    describe("WHEN handling a component.generate event with an error", () => {
      it("THEN should publish an error event", async () => {
        // Mock the LLM service to throw an error
        mockLLMService.generateComponent.mockRejectedValueOnce(
          new Error("Failed to generate component"),
        );

        // Set up the request
        const request = "Create a function to calculate discounts";
        const componentType = ComponentType.Function;

        // Handle the generate event
        await eventHandler.handleComponentGenerate({
          request,
          componentType,
        });

        // Verify the error event was published
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.generation.error",
          expect.objectContaining({
            request,
            error: "Failed to generate component",
          }),
        );
      });
    });

    describe("WHEN handling a component.feedback event", () => {
      it("THEN should generate educational feedback for the component", async () => {
        // Set up the request
        const componentId = "doc1";
        const userRequest = "I need a function to process payments";

        // Handle the feedback event
        await eventHandler.handleComponentFeedback({
          componentId,
          userRequest,
        });

        // Verify the component was retrieved
        expect(mockVectorDBConnector.getDocument).toHaveBeenCalledWith(
          componentId,
        );

        // Verify the LLM service was called
        expect(mockLLMService.generateFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            id: componentId,
            name: "processPayment",
          }),
          userRequest,
        );

        // Verify the feedback event was published
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.feedback.generated",
          expect.objectContaining({
            componentId,
            component: expect.objectContaining({
              id: componentId,
            }),
            feedback: expect.stringContaining("Educational Feedback"),
          }),
        );
      });

      it("THEN should publish an error if the component is not found", async () => {
        // Set up the request with a non-existent component
        const componentId = "nonexistent";
        const userRequest = "I need a function to process payments";

        // Mock getDocument to return null for this ID
        mockVectorDBConnector.getDocument.mockResolvedValueOnce(null);

        // Handle the feedback event
        await eventHandler.handleComponentFeedback({
          componentId,
          userRequest,
        });

        // Verify the error event was published
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.feedback.error",
          expect.objectContaining({
            componentId,
            error: `Component not found: ${componentId}`,
          }),
        );
      });

      it("THEN should publish an error if feedback generation fails", async () => {
        // Set up the request
        const componentId = "doc1";
        const userRequest = "I need a function to process payments";

        // Mock the LLM service to throw an error
        mockLLMService.generateFeedback.mockRejectedValueOnce(
          new Error("Failed to generate feedback"),
        );

        // Handle the feedback event
        await eventHandler.handleComponentFeedback({
          componentId,
          userRequest,
        });

        // Verify the error event was published
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.feedback.error",
          expect.objectContaining({
            componentId,
            error: "Failed to generate feedback",
          }),
        );
      });
    });

    describe("WHEN creating different types of components", () => {
      it("THEN should generate appropriate extensions", async () => {
        // Mock the search to return empty results
        mockVectorDBConnector.search.mockResolvedValueOnce([]);

        // Set up the request
        const request = "Create an extension for discount calculations";
        const componentType = ComponentType.Extension;

        // Handle the generate event
        await eventHandler.handleComponentGenerate({
          request,
          componentType,
        });

        // Verify the LLM service was called with the correct type
        expect(mockLLMService.generateComponent).toHaveBeenCalledWith(
          request,
          componentType,
        );

        // Verify the generated component has the correct type
        expect(mockVectorDBConnector.addDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            type: ComponentType.Extension,
            name: "DiscountExtension",
          }),
        );
      });

      it("THEN should generate appropriate commands", async () => {
        // Mock the search to return empty results
        mockVectorDBConnector.search.mockResolvedValueOnce([]);

        // Set up the request
        const request = "Create a command for applying discounts";
        const componentType = ComponentType.Command;

        // Handle the generate event
        await eventHandler.handleComponentGenerate({
          request,
          componentType,
        });

        // Verify the LLM service was called with the correct type
        expect(mockLLMService.generateComponent).toHaveBeenCalledWith(
          request,
          componentType,
        );

        // Verify the generated component has the correct type
        expect(mockVectorDBConnector.addDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            type: ComponentType.Command,
            name: "DiscountCommand",
          }),
        );
      });
    });
  });
});
