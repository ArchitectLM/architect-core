import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditContextGenerator } from "../../src/context/edit-context-generator.js";
import { ComponentType, SearchResult } from "../../src/models.js";

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

// Create a mock ComponentSearch
const mockComponentSearch = {
  searchComponents: vi.fn().mockResolvedValue(mockSearchResults),
  searchComponentsByType: vi.fn().mockResolvedValue([mockSearchResults[0]]),
  getComponentById: vi.fn().mockImplementation((id: string) => {
    const result = mockSearchResults.find((r) => r.component.id === id);
    return result ? Promise.resolve(result.component) : Promise.resolve(null);
  }),
  findSimilarComponents: vi.fn().mockResolvedValue([mockSearchResults[1]]),
  getAllComponentsByType: vi.fn().mockImplementation((type: ComponentType) => {
    return Promise.resolve(
      mockSearchResults
        .filter((r) => r.component.type === type)
        .map((r) => r.component),
    );
  }),
};

describe("EditContextGenerator", () => {
  let contextGenerator: EditContextGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    contextGenerator = new EditContextGenerator(mockComponentSearch);
  });

  describe("GIVEN an edit context generator", () => {
    describe("WHEN generating context for a query", () => {
      it("THEN should search for relevant components", async () => {
        const query = "Add validation to payment processing";

        await contextGenerator.generateContext(query);

        expect(mockComponentSearch.searchComponents).toHaveBeenCalledWith(
          query,
          expect.objectContaining({
            limit: expect.any(Number),
          }),
        );
      });

      it("THEN should include the query and relevant components in the context", async () => {
        const query = "Add validation to payment processing";

        const context = await contextGenerator.generateContext(query);

        expect(context.query).toBe(query);
        expect(context.relevantComponents).toEqual(
          mockSearchResults.map((r) => r.component),
        );
      });

      it("THEN should generate suggested changes for components", async () => {
        const query = "Add validation to payment processing";

        const context = await contextGenerator.generateContext(query);

        expect(context.suggestedChanges).toHaveLength(mockSearchResults.length);
        expect(context.suggestedChanges[0].componentId).toBe(
          mockSearchResults[0].component.id,
        );
        expect(context.suggestedChanges[0].originalContent).toBe(
          mockSearchResults[0].component.content,
        );
      });
    });

    describe("WHEN generating context with specific component types", () => {
      it("THEN should filter components by type", async () => {
        const query = "Add validation to payment processing";
        const types = [ComponentType.Function];

        await contextGenerator.generateContextByTypes(query, types);

        expect(mockComponentSearch.searchComponents).toHaveBeenCalledWith(
          query,
          expect.objectContaining({
            types,
          }),
        );
      });
    });

    describe("WHEN generating context for a specific component", () => {
      it("THEN should include the component and similar components", async () => {
        const componentId = "doc1";

        const context = await contextGenerator.generateContextForComponent(
          componentId,
          "Add validation",
        );

        expect(mockComponentSearch.getComponentById).toHaveBeenCalledWith(
          componentId,
        );
        expect(mockComponentSearch.findSimilarComponents).toHaveBeenCalled();
        expect(context.relevantComponents).toContainEqual(
          mockSearchResults[0].component,
        );
      });

      it("THEN should throw an error if the component does not exist", async () => {
        const componentId = "non-existent-id";
        mockComponentSearch.getComponentById.mockResolvedValueOnce(null);

        await expect(
          contextGenerator.generateContextForComponent(
            componentId,
            "Add validation",
          ),
        ).rejects.toThrow(/Component not found/);
      });
    });

    describe("WHEN enriching context with global information", () => {
      it("THEN should add global context information", async () => {
        const query = "Add validation to payment processing";

        const context = await contextGenerator.generateContext(query, true);

        expect(context.globalContext).toBeDefined();
        expect(typeof context.globalContext).toBe("string");
        expect(context.globalContext?.length).toBeGreaterThan(0);
      });
    });
  });
});
