import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentIndexer } from "../../src/indexing/component-indexer.js";
import { ComponentType } from "../../src/models.js";

// Create a mock VectorDBConnector
const mockVectorDBConnector = {
  initialize: vi.fn().mockResolvedValue(undefined),
  addDocument: vi.fn().mockResolvedValue("doc1"),
  addDocuments: vi.fn().mockResolvedValue(["doc1", "doc2"]),
  search: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
};

describe("ComponentIndexer", () => {
  let indexer: ComponentIndexer;

  beforeEach(() => {
    vi.clearAllMocks();
    indexer = new ComponentIndexer(mockVectorDBConnector);
  });

  describe("GIVEN a component indexer", () => {
    describe("WHEN indexing a component", () => {
      it("THEN should add the component to the vector database", async () => {
        const component = {
          type: ComponentType.Function,
          name: "processPayment",
          content: "function processPayment() { /* ... */ }",
          metadata: {
            path: "src/functions/payment.ts",
            description: "Processes a payment transaction",
          },
        };

        const id = await indexer.indexComponent(component);

        expect(id).toBe("doc1");
        expect(mockVectorDBConnector.addDocument).toHaveBeenCalledWith(
          component,
        );
      });
    });

    describe("WHEN indexing multiple components", () => {
      it("THEN should add all components to the vector database", async () => {
        const components = [
          {
            type: ComponentType.Function,
            name: "processPayment",
            content: "function processPayment() { /* ... */ }",
            metadata: {
              path: "src/functions/payment.ts",
              description: "Processes a payment transaction",
            },
          },
          {
            type: ComponentType.Command,
            name: "ProcessPaymentCommand",
            content: "class ProcessPaymentCommand { /* ... */ }",
            metadata: {
              path: "src/commands/payment.ts",
              description: "Command to process a payment",
            },
          },
        ];

        const ids = await indexer.indexComponents(components);

        expect(ids).toEqual(["doc1", "doc2"]);
        expect(mockVectorDBConnector.addDocuments).toHaveBeenCalledWith(
          components,
        );
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

        const ids = await indexer.indexTypeScriptFile(filePath, fileContent);

        expect(ids).toHaveLength(2);
        expect(mockVectorDBConnector.addDocuments).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: ComponentType.Function,
              name: "processPayment",
              metadata: expect.objectContaining({
                path: filePath,
              }),
            }),
            expect.objectContaining({
              type: ComponentType.Function,
              name: "validatePayment",
              metadata: expect.objectContaining({
                path: filePath,
              }),
            }),
          ]),
        );
      });
    });

    describe("WHEN updating a component", () => {
      it("THEN should update the component in the vector database", async () => {
        const id = "doc1";
        const updates = {
          content: "function processPayment(amount: number) { /* ... */ }",
          metadata: {
            description: "Updated description",
          },
        };

        await indexer.updateComponent(id, updates);

        expect(mockVectorDBConnector.updateDocument).toHaveBeenCalledWith(
          id,
          updates,
        );
      });
    });

    describe("WHEN removing a component", () => {
      it("THEN should delete the component from the vector database", async () => {
        const id = "doc1";

        await indexer.removeComponent(id);

        expect(mockVectorDBConnector.deleteDocument).toHaveBeenCalledWith(id);
      });
    });

    describe("WHEN clearing all components", () => {
      it("THEN should delete all components from the vector database", async () => {
        await indexer.clearAllComponents();

        expect(mockVectorDBConnector.deleteAllDocuments).toHaveBeenCalled();
      });
    });
  });
});
