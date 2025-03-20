import { describe, it, expect, vi, beforeEach } from "vitest";
import { RetrievalLearningSystem } from "../../src/learning/retrieval-learning.js";
import { ChromaDBConnector } from "../../src/vector-db/chroma-connector.js";
import {
  Component,
  ComponentType,
  RetrievalRecord,
  RetrievalOutcome,
} from "../../src/models.js";

describe("Retrieval Learning System", () => {
  let learningSystem: RetrievalLearningSystem;
  let mockVectorDB: ChromaDBConnector;

  beforeEach(() => {
    // Mock the vector database
    mockVectorDB = {
      initialize: vi.fn().mockResolvedValue(undefined),
      addDocument: vi.fn().mockResolvedValue("doc-id-1"),
      addDocuments: vi.fn().mockResolvedValue(["doc-id-1", "doc-id-2"]),
      search: vi.fn().mockResolvedValue([]),
      getDocument: vi.fn().mockResolvedValue(null),
      updateDocument: vi.fn().mockResolvedValue(undefined),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
      deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
      recordRetrieval: vi.fn().mockResolvedValue("retrieval-id-1"),
      updateRetrievalOutcome: vi.fn().mockResolvedValue(undefined),
      getRetrievalsByQuery: vi.fn().mockResolvedValue([]),
      getSuccessfulRetrievals: vi.fn().mockResolvedValue([]),
    } as unknown as ChromaDBConnector;

    learningSystem = new RetrievalLearningSystem(mockVectorDB);
  });

  describe("GIVEN a retrieval learning system", () => {
    describe("WHEN recording a retrieval", () => {
      it("THEN should store the retrieval record in the vector database", async () => {
        // Arrange
        const query = "payment processing error handling";
        const retrievedComponents = [
          {
            id: "component-id-1",
            type: ComponentType.Function,
            name: "processPayment",
            content: "function processPayment() { /* ... */ }",
            metadata: {
              path: "src/functions/payment.ts",
              description: "Processes a payment transaction",
            },
          },
          {
            id: "component-id-2",
            type: ComponentType.Function,
            name: "handlePaymentError",
            content: "function handlePaymentError() { /* ... */ }",
            metadata: {
              path: "src/functions/payment-error.ts",
              description: "Handles payment processing errors",
            },
          },
        ];

        const retrievalRecord: RetrievalRecord = {
          query,
          timestamp: Date.now(),
          retrievedComponentIds: ["component-id-1", "component-id-2"],
          sessionId: "session-123",
          userId: "user-123",
        };

        // Act
        await learningSystem.recordRetrieval(retrievalRecord);

        // Assert
        expect(mockVectorDB.recordRetrieval).toHaveBeenCalledWith(
          retrievalRecord,
        );
      });
    });

    describe("WHEN updating a retrieval outcome", () => {
      it("THEN should update the retrieval record with the outcome", async () => {
        // Arrange
        const retrievalId = "retrieval-id-1";
        const outcome: RetrievalOutcome = {
          successful: true,
          usedComponentIds: ["component-id-1"],
          feedback: "The retrieved component was helpful for fixing the issue",
          timestamp: Date.now(),
        };

        // Act
        await learningSystem.updateRetrievalOutcome(retrievalId, outcome);

        // Assert
        expect(mockVectorDB.updateRetrievalOutcome).toHaveBeenCalledWith(
          retrievalId,
          outcome,
        );
      });
    });

    describe("WHEN getting similar successful queries", () => {
      it("THEN should return similar queries that led to successful outcomes", async () => {
        // Arrange
        const query = "payment processing error";
        const mockRetrievals = [
          {
            id: "retrieval-id-1",
            query: "payment error handling",
            timestamp: Date.now() - 1000,
            retrievedComponentIds: ["component-id-1", "component-id-2"],
            outcome: {
              successful: true,
              usedComponentIds: ["component-id-1"],
              timestamp: Date.now() - 500,
            },
            similarity: 0.85,
          },
          {
            id: "retrieval-id-2",
            query: "process payment failure",
            timestamp: Date.now() - 2000,
            retrievedComponentIds: ["component-id-3", "component-id-4"],
            outcome: {
              successful: true,
              usedComponentIds: ["component-id-3"],
              timestamp: Date.now() - 1500,
            },
            similarity: 0.75,
          },
        ];

        mockVectorDB.getSuccessfulRetrievals = vi
          .fn()
          .mockResolvedValue(mockRetrievals);

        // Act
        const result = await learningSystem.getSimilarSuccessfulQueries(query);

        // Assert
        expect(mockVectorDB.getSuccessfulRetrievals).toHaveBeenCalledWith(
          query,
        );
        expect(result).toEqual(mockRetrievals);
      });
    });

    describe("WHEN optimizing a search query", () => {
      it("THEN should enhance the query based on past successful retrievals", async () => {
        // Arrange
        const originalQuery = "payment error";
        const mockRetrievals = [
          {
            id: "retrieval-id-1",
            query: "payment error handling",
            timestamp: Date.now() - 1000,
            retrievedComponentIds: ["component-id-1", "component-id-2"],
            outcome: {
              successful: true,
              usedComponentIds: ["component-id-1"],
              timestamp: Date.now() - 500,
            },
            similarity: 0.85,
          },
          {
            id: "retrieval-id-2",
            query: "process payment failure exception",
            timestamp: Date.now() - 2000,
            retrievedComponentIds: ["component-id-3", "component-id-4"],
            outcome: {
              successful: true,
              usedComponentIds: ["component-id-3"],
              timestamp: Date.now() - 1500,
            },
            similarity: 0.75,
          },
        ];

        mockVectorDB.getSuccessfulRetrievals = vi
          .fn()
          .mockResolvedValue(mockRetrievals);

        // Act
        const enhancedQuery =
          await learningSystem.optimizeSearchQuery(originalQuery);

        // Assert
        expect(enhancedQuery).not.toEqual(originalQuery);
        expect(enhancedQuery).toContain("handling");
        expect(enhancedQuery).toContain("exception");
      });
    });
  });
});
