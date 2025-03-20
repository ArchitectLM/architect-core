import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeedbackSystem } from "../../src/feedback/feedback-system.js";
import { ChromaDBConnector } from "../../src/vector-db/chroma-connector.js";
import {
  Component,
  ComponentType,
  FeedbackRecord,
  FeedbackType,
} from "../../src/models.js";

describe("Feedback System", () => {
  let feedbackSystem: FeedbackSystem;
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
      addFeedback: vi.fn().mockResolvedValue("feedback-id-1"),
      getFeedbackForComponent: vi.fn().mockResolvedValue([]),
      searchFeedback: vi.fn().mockResolvedValue([]),
    } as unknown as ChromaDBConnector;

    feedbackSystem = new FeedbackSystem(mockVectorDB);
  });

  describe("GIVEN a feedback system", () => {
    describe("WHEN recording feedback for a component change", () => {
      it("THEN should store the feedback in the vector database", async () => {
        // Arrange
        const component: Component = {
          id: "component-id-1",
          type: ComponentType.Function,
          name: "processPayment",
          content: "function processPayment() { /* ... */ }",
          metadata: {
            path: "src/functions/payment.ts",
            description: "Processes a payment transaction",
          },
        };

        const feedback: FeedbackRecord = {
          componentId: "component-id-1",
          type: FeedbackType.Success,
          message: "The change successfully fixed the payment processing issue",
          originalContent: "function processPayment() { /* old code */ }",
          newContent: "function processPayment() { /* new code */ }",
          timestamp: Date.now(),
          userId: "user-123",
          metrics: {
            executionTime: 120,
            memoryUsage: 256,
          },
        };

        // Act
        await feedbackSystem.recordFeedback(feedback);

        // Assert
        expect(mockVectorDB.addFeedback).toHaveBeenCalledWith(feedback);
      });
    });

    describe("WHEN retrieving feedback for a component", () => {
      it("THEN should return all feedback records for that component", async () => {
        // Arrange
        const componentId = "component-id-1";
        const mockFeedback = [
          {
            id: "feedback-id-1",
            componentId,
            type: FeedbackType.Success,
            message: "Good change",
            timestamp: Date.now(),
          },
          {
            id: "feedback-id-2",
            componentId,
            type: FeedbackType.Failure,
            message: "Bad change",
            timestamp: Date.now() - 1000,
          },
        ];

        mockVectorDB.getFeedbackForComponent = vi
          .fn()
          .mockResolvedValue(mockFeedback);

        // Act
        const result =
          await feedbackSystem.getFeedbackForComponent(componentId);

        // Assert
        expect(mockVectorDB.getFeedbackForComponent).toHaveBeenCalledWith(
          componentId,
        );
        expect(result).toEqual(mockFeedback);
      });
    });

    describe("WHEN analyzing feedback patterns", () => {
      it("THEN should return insights about successful and failed changes", async () => {
        // Arrange
        const componentId = "component-id-1";
        const mockFeedback = [
          {
            id: "feedback-id-1",
            componentId,
            type: FeedbackType.Success,
            message: "Fixed null check",
            originalContent: "function process(data) { return data.value; }",
            newContent: "function process(data) { return data?.value; }",
            timestamp: Date.now(),
          },
          {
            id: "feedback-id-2",
            componentId,
            type: FeedbackType.Failure,
            message: "Broke the API contract",
            originalContent:
              "function process(data) { return { result: data.value }; }",
            newContent: "function process(data) { return data?.value; }",
            timestamp: Date.now() - 1000,
          },
          {
            id: "feedback-id-3",
            componentId,
            type: FeedbackType.Success,
            message: "Improved error handling",
            originalContent: "function process(data) { return data.value; }",
            newContent:
              "function process(data) { try { return data.value; } catch (e) { return null; } }",
            timestamp: Date.now() - 2000,
          },
        ];

        mockVectorDB.getFeedbackForComponent = vi
          .fn()
          .mockResolvedValue(mockFeedback);

        // Act
        const insights =
          await feedbackSystem.analyzeFeedbackPatterns(componentId);

        // Assert
        expect(insights).toBeDefined();
        expect(insights.successRate).toBeCloseTo(0.67, 2); // 2/3 success rate
        expect(insights.commonPatterns).toContain("null check");
        expect(insights.commonPatterns).toContain("error handling");
        expect(insights.riskFactors).toContain("API contract");
      });
    });
  });
});
