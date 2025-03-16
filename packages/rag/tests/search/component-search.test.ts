import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentSearch } from "../../src/search/component-search.js";
import {
  ComponentType,
  SearchOptions,
  SearchResult,
} from "../../src/models.js";

// Mock search results
const mockSearchResults: SearchResult[] = [
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
    distance: 0.1,
  },
  {
    component: {
      id: "doc2",
      type: ComponentType.Command,
      name: "ProcessPaymentCommand",
      content: "class ProcessPaymentCommand { /* ... */ }",
      metadata: {
        path: "src/commands/payment.ts",
        description: "Command to process a payment",
      },
    },
    score: 0.85,
    distance: 0.3,
  },
];

// Create a mock VectorDBConnector
const mockVectorDBConnector = {
  initialize: vi.fn().mockResolvedValue(undefined),
  addDocument: vi.fn().mockResolvedValue("doc1"),
  addDocuments: vi.fn().mockResolvedValue(["doc1", "doc2"]),
  search: vi.fn().mockResolvedValue(mockSearchResults),
  getDocument: vi.fn().mockImplementation((id: string) => {
    const result = mockSearchResults.find((r) => r.component.id === id);
    return result ? Promise.resolve(result.component) : Promise.resolve(null);
  }),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteAllDocuments: vi.fn().mockResolvedValue(undefined),
};

describe("ComponentSearch", () => {
  let search: ComponentSearch;

  beforeEach(() => {
    vi.clearAllMocks();
    search = new ComponentSearch(mockVectorDBConnector);
  });

  describe("GIVEN a component search", () => {
    describe("WHEN searching for components", () => {
      it("THEN should return matching components with scores", async () => {
        const query = "payment processing";
        const results = await search.searchComponents(query);

        expect(results).toEqual(mockSearchResults);
        expect(mockVectorDBConnector.search).toHaveBeenCalledWith(
          query,
          undefined,
        );
      });

      it("THEN should apply search options when provided", async () => {
        const query = "payment processing";
        const options: SearchOptions = {
          types: [ComponentType.Function],
          limit: 5,
          threshold: 0.8,
        };

        await search.searchComponents(query, options);

        expect(mockVectorDBConnector.search).toHaveBeenCalledWith(
          query,
          options,
        );
      });

      it("THEN should filter results by threshold", async () => {
        const query = "payment processing";
        const options: SearchOptions = {
          threshold: 0.9,
          limit: 10,
        };

        const results = await search.searchComponents(query, options);

        // Only results with score >= 0.9 should be returned
        expect(results.length).toBe(1);
        expect(results[0].component.name).toBe("processPayment");
      });
    });

    describe("WHEN searching for components by type", () => {
      it("THEN should return only components of the specified type", async () => {
        const query = "payment processing";
        const type = ComponentType.Function;

        const results = await search.searchComponentsByType(query, type);

        expect(mockVectorDBConnector.search).toHaveBeenCalledWith(
          query,
          expect.objectContaining({
            types: [type],
          }),
        );
      });
    });

    describe("WHEN getting a component by ID", () => {
      it("THEN should return the component if it exists", async () => {
        const id = "doc1";
        const component = await search.getComponentById(id);

        expect(component).toEqual(mockSearchResults[0].component);
        expect(mockVectorDBConnector.getDocument).toHaveBeenCalledWith(id);
      });

      it("THEN should return null if the component does not exist", async () => {
        const id = "non-existent-id";
        mockVectorDBConnector.getDocument.mockResolvedValueOnce(null);

        const component = await search.getComponentById(id);

        expect(component).toBeNull();
        expect(mockVectorDBConnector.getDocument).toHaveBeenCalledWith(id);
      });
    });

    describe("WHEN finding similar components", () => {
      it("THEN should return components similar to the provided component", async () => {
        const component = mockSearchResults[0].component;

        // Mock the search method to return the second component
        mockVectorDBConnector.search.mockResolvedValueOnce([
          mockSearchResults[1],
        ]);

        const results = await search.findSimilarComponents(component);

        expect(results).toEqual([mockSearchResults[1]]);
        expect(mockVectorDBConnector.search).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            types: [component.type],
          }),
        );
      });
    });
  });
});
