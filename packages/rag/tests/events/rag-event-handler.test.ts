import { describe, it, expect, vi, beforeEach } from "vitest";
import { RAGEventHandler } from "../../src/events/rag-event-handler.js";
import { ComponentType } from "../../src/models.js";

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
        content: "function processPayment() { /* ... */ }",
        metadata: {
          path: "src/functions/payment.ts",
          description: "Processes a payment transaction",
        },
      });
    }
    return Promise.resolve(null);
  }),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
};

describe("RAGEventHandler", () => {
  let eventHandler: RAGEventHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandler = new RAGEventHandler(mockEventBus, mockVectorDBConnector);
  });

  describe("GIVEN a RAG event handler", () => {
    describe("WHEN initializing", () => {
      it("THEN should subscribe to component events", async () => {
        await eventHandler.initialize();

        expect(mockEventBus.subscribe).toHaveBeenCalledTimes(6);
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

    describe("WHEN handling a component.created event", () => {
      it("THEN should index the component", async () => {
        const component = {
          type: ComponentType.Function,
          name: "processPayment",
          content: "function processPayment() { /* ... */ }",
          metadata: {
            path: "src/functions/payment.ts",
            description: "Processes a payment transaction",
          },
        };

        await eventHandler.handleComponentCreated({ component });

        expect(mockVectorDBConnector.addDocument).toHaveBeenCalledWith(
          component,
        );
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.indexed",
          expect.objectContaining({
            component,
            id: "doc1",
          }),
        );
      });
    });

    describe("WHEN handling a component.updated event", () => {
      it("THEN should update the component in the index", async () => {
        const component = {
          id: "doc1",
          type: ComponentType.Function,
          name: "processPayment",
          content: "function processPayment(amount: number) { /* ... */ }",
          metadata: {
            path: "src/functions/payment.ts",
            description: "Updated description",
          },
        };

        await eventHandler.handleComponentUpdated({ component });

        expect(mockVectorDBConnector.updateDocument).toHaveBeenCalledWith(
          "doc1",
          component,
        );
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "component.indexed",
          expect.objectContaining({
            component,
            id: "doc1",
          }),
        );
      });

      it("THEN should throw an error if the component has no ID", async () => {
        const component = {
          type: ComponentType.Function,
          name: "processPayment",
          content: "function processPayment() { /* ... */ }",
          metadata: {
            path: "src/functions/payment.ts",
            description: "Processes a payment transaction",
          },
        };

        await expect(
          eventHandler.handleComponentUpdated({ component }),
        ).rejects.toThrow(/Component ID is required/);
      });
    });

    describe("WHEN handling a component.deleted event", () => {
      it("THEN should delete the component from the index", async () => {
        const id = "doc1";

        await eventHandler.handleComponentDeleted({ id });

        expect(mockVectorDBConnector.deleteDocument).toHaveBeenCalledWith(id);
      });
    });

    describe("WHEN indexing a TypeScript file", () => {
      it("THEN should extract and index components from the file", async () => {
        const filePath = "src/functions/payment.ts";
        const fileContent = `
          /**
           * Processes a payment transaction
           */
          export function processPayment(amount: number, currency: string) {
            // Implementation
          }

          /**
           * Validates payment data
           */
          export function validatePayment(data: any) {
            // Implementation
          }
        `;

        // Mock the addDocuments method to return IDs
        mockVectorDBConnector.addDocuments.mockResolvedValueOnce([
          "doc1",
          "doc2",
        ]);

        await eventHandler.indexTypeScriptFile(filePath, fileContent);

        expect(mockVectorDBConnector.addDocuments).toHaveBeenCalled();
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "file.indexed",
          expect.objectContaining({
            filePath,
            componentIds: ["doc1", "doc2"],
          }),
        );
      });
    });

    describe("WHEN searching for components", () => {
      it("THEN should search the vector database", async () => {
        const query = "payment processing";
        const mockResults = [
          {
            component: {
              id: "doc1",
              type: ComponentType.Function,
              name: "processPayment",
              content: "function processPayment() { /* ... */ }",
              metadata: {
                path: "src/functions/payment.ts",
                description: "Processes a payment transaction",
              },
            },
            score: 0.95,
          },
        ];

        mockVectorDBConnector.search.mockResolvedValueOnce(mockResults);

        const results = await eventHandler.searchComponents(query);

        expect(mockVectorDBConnector.search).toHaveBeenCalledWith(
          query,
          undefined,
        );
        expect(results).toEqual(mockResults);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          "search.completed",
          expect.objectContaining({
            query,
            results: mockResults,
          }),
        );
      });
    });
  });
});
