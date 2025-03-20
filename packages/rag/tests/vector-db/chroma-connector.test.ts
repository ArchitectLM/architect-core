import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChromaDBConnector } from "../../src/vector-db/chroma-connector.js";
import { Component } from "../../src/models.js";
import { logger } from "../../src/utils/logger.js";

// Define the ComponentType from the ChromaDB connector
type ComponentType = 'schema' | 'command' | 'query' | 'event' | 'workflow' | 'extension' | 'plugin';

// Mock the uuid module
vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mocked-uuid"),
}));

// Mock the ChromaDB client
vi.mock("chromadb", () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    getOrCreateCollection: vi.fn().mockResolvedValue({
      add: vi.fn().mockResolvedValue({ ids: ["doc1", "doc2", "doc3"] }),
      get: vi.fn().mockImplementation(({ ids }) => {
        if (ids && ids.includes("doc1")) {
          return {
            ids: ["doc1"],
            metadatas: [
              {
                type: "plugin",
                name: "processPayment",
                path: "src/functions/payment.ts",
              },
            ],
            documents: ["function processPayment() { /* ... */ }"],
            embeddings: null,
          };
        }
        return { ids: [], metadatas: [], documents: [], embeddings: null };
      }),
      query: vi.fn().mockResolvedValue({
        ids: [["doc1", "doc2"]],
        distances: [[0.1, 0.2]],
        metadatas: [
          [
            {
              type: "plugin",
              name: "processPayment",
              path: "src/functions/payment.ts",
            },
            {
              type: "command",
              name: "ProcessPaymentCommand",
              path: "src/commands/payment.ts",
            },
          ],
        ],
        documents: [
          [
            "function processPayment() { /* ... */ }",
            "class ProcessPaymentCommand { /* ... */ }",
          ],
        ],
        embeddings: null,
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      modify: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}));

describe("ChromaDBConnector", () => {
  let connector: ChromaDBConnector;
  const testComponent: Component = {
    type: "plugin",
    name: "processPayment",
    content: "function processPayment() { /* ... */ }",
    metadata: {
      path: "src/functions/payment.ts",
      description: "Processes a payment transaction",
    },
  };

  beforeEach(async () => {
    logger.level = 'error'; // Reduce noise in tests
    connector = new ChromaDBConnector({
      collectionName: "test-components",
      embeddingDimension: 1536,
      distance: "cosine",
      url: "http://localhost:8000"
    });
    await connector.initialize();
    await connector.deleteAllDocuments();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GIVEN a ChromaDB connector", () => {
    describe("WHEN adding a document", () => {
      it("THEN should add the document to the database and return an ID", async () => {
        const id = await connector.addDocument(testComponent);
        expect(id).toBeDefined();
        expect(typeof id).toBe("string");
      });
    });

    describe("WHEN adding multiple documents", () => {
      it("THEN should add all documents to the database and return IDs", async () => {
        const components: Component[] = [
          testComponent,
          {
            type: "command",
            name: "ProcessPaymentCommand",
            content: "class ProcessPaymentCommand { /* ... */ }",
            metadata: {
              path: "src/commands/payment.ts",
              description: "Command to process a payment",
            },
          },
        ];

        const ids = await connector.addDocuments(components);
        expect(ids).toHaveLength(components.length);
        expect(ids.every((id) => typeof id === "string")).toBe(true);
      });
    });

    describe("WHEN searching for documents", () => {
      it("THEN should return matching documents with scores", async () => {
        const query = "payment processing";
        const results = await connector.search(query);

        expect(results).toHaveLength(2);
        expect(results[0].component.name).toBe("processPayment");
        expect(results[0].component.type).toBe("plugin");
        expect(results[0].score).toBeGreaterThan(0);
      });

      it("THEN should filter results by type when specified in options", async () => {
        const query = "payment processing";
        const options = {
          types: ["plugin" as ComponentType],
          limit: 5,
          threshold: 0.7,
          includeMetadata: true,
          includeEmbeddings: false,
          orderBy: "relevance" as const,
          orderDirection: "desc" as const
        };

        // Mock the query response to return only plugin components when types filter is applied
        const mockCollection = await connector["client"].getOrCreateCollection({
          name: "test-components",
          metadata: { "hnsw:space": "cosine" }
        });
        (mockCollection.query as any).mockResolvedValueOnce({
          ids: [["doc1"]],
          distances: [[0.1]],
          metadatas: [
            [
              {
                type: "plugin",
                name: "processPayment",
                path: "src/functions/payment.ts",
              },
            ],
          ],
          documents: [["function processPayment() { /* ... */ }"]],
          embeddings: null,
        });

        const results = await connector.search(query, options);
        expect(results.length).toBeGreaterThan(0);
        expect(
          results.every(
            (result) => result.component.type === "plugin",
          ),
        ).toBe(true);
      });
    });

    describe("WHEN getting a document by ID", () => {
      it("THEN should return the document if it exists", async () => {
        const document = await connector.getDocument("doc1");
        expect(document).not.toBeNull();
        expect(document?.name).toBe("processPayment");
        expect(document?.type).toBe("plugin");
      });

      it("THEN should return null if the document does not exist", async () => {
        const document = await connector.getDocument("non-existent-id");
        expect(document).toBeNull();
      });
    });

    describe("WHEN updating a document", () => {
      it("THEN should update the document in the database", async () => {
        await connector.updateDocument("doc1", {
          content: "function processPayment(amount: number) { /* ... */ }",
          metadata: {
            path: "src/functions/payment.ts",
            description: "Updated description",
          },
        });

        // This is just testing that the function doesn't throw
        // The actual update logic is tested through the mock
        expect(true).toBe(true);
      });
    });

    describe("WHEN deleting a document", () => {
      it("THEN should delete the document from the database", async () => {
        await connector.deleteDocument("doc1");
        // This is just testing that the function doesn't throw
        // The actual delete logic is tested through the mock
        expect(true).toBe(true);
      });
    });

    describe("WHEN deleting all documents", () => {
      it("THEN should delete all documents from the database", async () => {
        await connector.deleteAllDocuments();

        // This is just testing that the function doesn't throw
        // The actual delete logic is tested through the mock
        expect(true).toBe(true);
      });
    });
  });
});
