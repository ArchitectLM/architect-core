import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentVersioningSystem } from "../../src/versioning/component-versioning.js";
import { ChromaDBConnector } from "../../src/vector-db/chroma-connector.js";
import {
  Component,
  ComponentType,
  ComponentVersion,
} from "../../src/models.js";

describe("Component Versioning System", () => {
  let versioningSystem: ComponentVersioningSystem;
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
      createComponentVersion: vi.fn().mockResolvedValue("version-id-1"),
      getComponentVersions: vi.fn().mockResolvedValue([]),
      getComponentVersionDiff: vi
        .fn()
        .mockResolvedValue({ additions: [], deletions: [] }),
    } as unknown as ChromaDBConnector;

    versioningSystem = new ComponentVersioningSystem(mockVectorDB);
  });

  describe("GIVEN a component versioning system", () => {
    describe("WHEN creating a new version of a component", () => {
      it("THEN should store the version in the vector database", async () => {
        // Arrange
        const component: Component = {
          id: "component-id-1",
          type: ComponentType.Function,
          name: "processPayment",
          content: "function processPayment() { /* new code */ }",
          metadata: {
            path: "src/functions/payment.ts",
            description: "Processes a payment transaction",
          },
        };

        const previousContent = "function processPayment() { /* old code */ }";
        const changeDescription = "Added error handling for null values";
        const author = "user-123";

        const version: ComponentVersion = {
          componentId: "component-id-1",
          versionNumber: 2,
          content: component.content,
          previousContent,
          changeDescription,
          author,
          timestamp: Date.now(),
        };

        // Act
        await versioningSystem.createVersion(
          component,
          previousContent,
          changeDescription,
          author,
        );

        // Assert
        expect(mockVectorDB.createComponentVersion).toHaveBeenCalledWith(
          expect.objectContaining({
            componentId: "component-id-1",
            content: component.content,
            previousContent,
            changeDescription,
            author,
          }),
        );
      });
    });

    describe("WHEN retrieving version history for a component", () => {
      it("THEN should return all versions in chronological order", async () => {
        // Arrange
        const componentId = "component-id-1";
        const mockVersions = [
          {
            id: "version-id-1",
            componentId,
            versionNumber: 1,
            content: "function processPayment() { return true; }",
            previousContent: "",
            changeDescription: "Initial implementation",
            author: "user-123",
            timestamp: Date.now() - 2000,
          },
          {
            id: "version-id-2",
            componentId,
            versionNumber: 2,
            content:
              "function processPayment() { try { return true; } catch (e) { return false; } }",
            previousContent: "function processPayment() { return true; }",
            changeDescription: "Added error handling",
            author: "user-456",
            timestamp: Date.now() - 1000,
          },
          {
            id: "version-id-3",
            componentId,
            versionNumber: 3,
            content:
              "function processPayment() { try { return processPaymentInternal(); } catch (e) { return false; } }",
            previousContent:
              "function processPayment() { try { return true; } catch (e) { return false; } }",
            changeDescription: "Refactored to use internal function",
            author: "user-789",
            timestamp: Date.now(),
          },
        ];

        mockVectorDB.getComponentVersions = vi
          .fn()
          .mockResolvedValue(mockVersions);

        // Act
        const versions = await versioningSystem.getVersionHistory(componentId);

        // Assert
        expect(mockVectorDB.getComponentVersions).toHaveBeenCalledWith(
          componentId,
        );
        expect(versions).toEqual(mockVersions);
        expect(versions[0].versionNumber).toBeLessThan(
          versions[1].versionNumber,
        );
        expect(versions[1].versionNumber).toBeLessThan(
          versions[2].versionNumber,
        );
      });
    });

    describe("WHEN comparing two versions of a component", () => {
      it("THEN should return the differences between them", async () => {
        // Arrange
        const componentId = "component-id-1";
        const versionId1 = "version-id-1";
        const versionId2 = "version-id-2";
        const mockDiff = {
          additions: [
            { line: 2, content: "  try {" },
            { line: 4, content: "  } catch (e) {" },
            { line: 5, content: "    return false;" },
            { line: 6, content: "  }" },
          ],
          deletions: [{ line: 2, content: "  return true;" }],
        };

        mockVectorDB.getComponentVersionDiff = vi
          .fn()
          .mockResolvedValue(mockDiff);

        // Act
        const diff = await versioningSystem.compareVersions(
          componentId,
          versionId1,
          versionId2,
        );

        // Assert
        expect(mockVectorDB.getComponentVersionDiff).toHaveBeenCalledWith(
          componentId,
          versionId1,
          versionId2,
        );
        expect(diff).toEqual(mockDiff);
        expect(diff.additions.length).toBe(4);
        expect(diff.deletions.length).toBe(1);
      });
    });

    describe("WHEN analyzing the evolution of a component", () => {
      it("THEN should return insights about how the component has changed over time", async () => {
        // Arrange
        const componentId = "component-id-1";
        const mockVersions = [
          {
            id: "version-id-1",
            componentId,
            versionNumber: 1,
            content: "function processPayment() { return true; }",
            previousContent: "",
            changeDescription: "Initial implementation",
            author: "user-123",
            timestamp: Date.now() - 3000,
          },
          {
            id: "version-id-2",
            componentId,
            versionNumber: 2,
            content:
              "function processPayment() { try { return true; } catch (e) { return false; } }",
            previousContent: "function processPayment() { return true; }",
            changeDescription: "Added error handling",
            author: "user-456",
            timestamp: Date.now() - 2000,
          },
          {
            id: "version-id-3",
            componentId,
            versionNumber: 3,
            content:
              "function processPayment() { try { return processPaymentInternal(); } catch (e) { return false; } }",
            previousContent:
              "function processPayment() { try { return true; } catch (e) { return false; } }",
            changeDescription: "Refactored to use internal function",
            author: "user-789",
            timestamp: Date.now() - 1000,
          },
        ];

        mockVectorDB.getComponentVersions = vi
          .fn()
          .mockResolvedValue(mockVersions);

        // Act
        const evolution =
          await versioningSystem.analyzeComponentEvolution(componentId);

        // Assert
        expect(evolution).toBeDefined();
        expect(evolution.totalVersions).toBe(3);
        expect(evolution.changeFrequency).toBeGreaterThan(0);
        expect(evolution.commonAuthors).toContain("user-123");
        expect(evolution.commonChanges).toContain("error handling");
        expect(evolution.complexity).toBeDefined();
        expect(evolution.complexity.trend).toBe("increasing");
      });
    });
  });
});
