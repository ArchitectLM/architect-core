import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Component,
  ComponentType,
  VectorDBConnector,
} from "../../src/models.js";
import { VectorConfigStore } from "../../src/cli/vector-config-store.js";

// Mock dependencies
vi.mock("../../src/vector-db/chroma-connector.js");

describe("VectorConfigStore", () => {
  let vectorConfigStore: VectorConfigStore;
  let mockVectorDB: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create mock instances
    mockVectorDB = {
      addDocument: vi.fn(),
      getDocument: vi.fn(),
      updateDocument: vi.fn(),
      deleteDocument: vi.fn(),
      search: vi.fn(),
    };

    // Setup mock implementations
    mockVectorDB.addDocument.mockResolvedValue("config-1");

    mockVectorDB.getDocument.mockImplementation((id: string) => {
      if (id === "config-1") {
        return Promise.resolve({
          id: "config-1",
          type: ComponentType.Function,
          name: "userJourneyConfig",
          content: "function processUserJourney() { /* implementation */ }",
          metadata: {
            path: "src/functions/user-journey.ts",
            description: "User journey configuration",
            version: "v1",
          },
        });
      }
      return Promise.resolve(null);
    });

    mockVectorDB.search.mockResolvedValue([
      {
        component: {
          id: "config-1",
          type: ComponentType.Function,
          name: "userJourneyConfig",
          content: "function processUserJourney() { /* implementation */ }",
          metadata: {
            path: "src/functions/user-journey.ts",
            description: "User journey configuration",
            version: "v1",
          },
        },
        score: 0.95,
      },
    ]);

    // Create the vector config store with mocked dependencies
    vectorConfigStore = new VectorConfigStore(mockVectorDB);
  });

  describe("GIVEN a DSL configuration", () => {
    describe("WHEN saving it to the vector database", () => {
      it("THEN the configuration should be stored successfully", async () => {
        // Configuration to save
        const configName = "userJourney";
        const configContent =
          "function processUserJourney() { /* implementation */ }";
        const version = "v1";

        // Save configuration
        const id = await vectorConfigStore.saveConfiguration(
          configName,
          configContent,
          version,
        );

        // Verify vector DB was called
        expect(mockVectorDB.addDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            type: ComponentType.Function,
            name: "userJourneyConfig",
            content: configContent,
            metadata: expect.objectContaining({
              version: "v1",
            }),
          }),
        );

        // Verify result
        expect(id).toBe("config-1");
      });
    });

    describe("WHEN retrieving it from the vector database", () => {
      it("THEN the configuration should be returned correctly", async () => {
        // Retrieve configuration
        const config = await vectorConfigStore.getConfiguration(
          "userJourney",
          "v1",
        );

        // Verify vector DB was called
        expect(mockVectorDB.search).toHaveBeenCalledWith(
          expect.stringContaining("userJourney"),
          expect.objectContaining({
            limit: 1,
          }),
        );

        // Verify result
        expect(config).toBe(
          "function processUserJourney() { /* implementation */ }",
        );
      });

      it("THEN should return null if configuration doesn't exist", async () => {
        // Setup mock to return empty results
        mockVectorDB.search.mockResolvedValueOnce([]);

        // Retrieve non-existent configuration
        const config = await vectorConfigStore.getConfiguration(
          "nonExistent",
          "v1",
        );

        // Verify result
        expect(config).toBeNull();
      });
    });
  });

  describe("GIVEN multiple versions of a configuration", () => {
    describe("WHEN retrieving all versions", () => {
      it("THEN should return all versions sorted by version", async () => {
        // Setup mock to return multiple versions
        mockVectorDB.search.mockResolvedValueOnce([
          {
            component: {
              id: "config-2",
              type: ComponentType.Function,
              name: "userJourneyConfig",
              content:
                "function processUserJourney() { /* v2 implementation */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description: "User journey configuration",
                version: "v2",
              },
            },
            score: 0.95,
          },
          {
            component: {
              id: "config-1",
              type: ComponentType.Function,
              name: "userJourneyConfig",
              content:
                "function processUserJourney() { /* v1 implementation */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description: "User journey configuration",
                version: "v1",
              },
            },
            score: 0.9,
          },
        ]);

        // Retrieve all versions
        const versions = await vectorConfigStore.getAllVersions("userJourney");

        // Verify vector DB was called
        expect(mockVectorDB.search).toHaveBeenCalledWith(
          expect.stringContaining("userJourney"),
          expect.any(Object),
        );

        // Verify result
        expect(versions).toHaveLength(2);
        expect(versions[0].version).toBe("v1");
        expect(versions[1].version).toBe("v2");
      });
    });

    describe("WHEN comparing two versions", () => {
      it("THEN should return the differences between them", async () => {
        // Setup mock for search to return version IDs
        mockVectorDB.search.mockResolvedValueOnce([
          {
            component: {
              id: "config-1",
              type: ComponentType.Function,
              name: "userJourneyConfig",
              content:
                "function processUserJourney() { /* v1 implementation */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description: "User journey configuration",
                version: "v1",
              },
            },
            score: 0.9,
          },
          {
            component: {
              id: "config-2",
              type: ComponentType.Function,
              name: "userJourneyConfig",
              content:
                "function processUserJourney() { /* v2 implementation */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description: "User journey configuration",
                version: "v2",
              },
            },
            score: 0.95,
          },
        ]);

        // Setup mocks for getDocument calls
        mockVectorDB.getDocument.mockImplementation((id: string) => {
          if (id === "config-1") {
            return Promise.resolve({
              id: "config-1",
              type: ComponentType.Function,
              name: "userJourneyConfig",
              content:
                "function processUserJourney() { /* v1 implementation */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description: "User journey configuration",
                version: "v1",
              },
            });
          } else if (id === "config-2") {
            return Promise.resolve({
              id: "config-2",
              type: ComponentType.Function,
              name: "userJourneyConfig",
              content:
                "function processUserJourney() { /* v2 implementation */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description: "User journey configuration",
                version: "v2",
              },
            });
          }
          return Promise.resolve(null);
        });

        // Compare versions
        const diff = await vectorConfigStore.compareVersions(
          "userJourney",
          "v1",
          "v2",
        );

        // Verify vector DB was called
        expect(mockVectorDB.search).toHaveBeenCalledTimes(1);
        expect(mockVectorDB.getDocument).toHaveBeenCalledTimes(2);

        // Verify result contains differences
        expect(diff).toContain("-");
        expect(diff).toContain("+");
        expect(diff).toContain("v1 implementation");
        expect(diff).toContain("v2 implementation");
      });
    });
  });

  describe("GIVEN a configuration needs to be updated", () => {
    describe("WHEN updating an existing configuration", () => {
      it("THEN should update the configuration in the vector database", async () => {
        // Setup mock to find existing configuration
        mockVectorDB.search.mockResolvedValueOnce([
          {
            component: {
              id: "config-1",
              type: ComponentType.Function,
              name: "userJourneyConfig",
              content:
                "function processUserJourney() { /* old implementation */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description: "User journey configuration",
                version: "v1",
              },
            },
            score: 0.95,
          },
        ]);

        // Update configuration
        const updated = await vectorConfigStore.updateConfiguration(
          "userJourney",
          "function processUserJourney() { /* new implementation */ }",
          "v1",
        );

        // Verify vector DB was called
        expect(mockVectorDB.updateDocument).toHaveBeenCalledWith(
          "config-1",
          expect.objectContaining({
            content:
              "function processUserJourney() { /* new implementation */ }",
          }),
        );

        // Verify result
        expect(updated).toBe(true);
      });

      it("THEN should return false if configuration doesn't exist", async () => {
        // Setup mock to return empty results
        mockVectorDB.search.mockResolvedValueOnce([]);

        // Update non-existent configuration
        const updated = await vectorConfigStore.updateConfiguration(
          "nonExistent",
          "function processUserJourney() { /* new implementation */ }",
          "v1",
        );

        // Verify result
        expect(updated).toBe(false);
      });
    });
  });
});
