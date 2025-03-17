import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ComponentType,
  ValidationResult,
  VectorDBConnector,
  Component,
  SearchOptions,
  SearchResult,
  FeedbackRecord,
  RetrievalRecord,
  RetrievalOutcome,
  ComponentVersion,
  VersionDiff,
  LearningTask,
  ExemplarSolution,
  TaskDifficulty
} from "../../src/models.js";
import { LLMService } from "../../src/llm/llm-service.js";
import { CodeValidator } from "../../src/validation/code-validator.js";
import { CliCommandHandler } from "../../src/cli/cli-command-handler.js";
import { SessionManager } from "../../src/cli/session-manager.js";
import { VectorConfigStore } from "../../src/cli/vector-config-store.js";
import { ErrorFormatter } from "../../src/cli/error-formatter.js";
import { CliTool } from "../../src/cli/cli-tool.js";
import { ComponentSearch } from "../../src/search/component-search.js";

// Mock dependencies
vi.mock("../../src/llm/llm-service.js");
vi.mock("../../src/validation/code-validator.js");
vi.mock("../../src/cli/cli-command-handler.js");
vi.mock("../../src/cli/session-manager.js");
vi.mock("../../src/cli/vector-config-store.js");
vi.mock("../../src/cli/error-formatter.js");

class MockLLMService {
  generateComponent = vi.fn();
  generateFeedback = vi.fn();
}

class MockCodeValidator {
  validateCode = vi.fn();
}

class MockCliCommandHandler {
  processCommand = vi.fn();
  commitCode = vi.fn();
  provideFeedback = vi.fn();
}

class MockSessionManager {
  processCommand = vi.fn();
  commitCurrentComponent = vi.fn();
  provideFeedback = vi.fn();
}

class MockVectorConfigStore {
  saveConfiguration = vi.fn();
  getConfiguration = vi.fn();
}

class MockVectorDBConnector implements VectorDBConnector {
  initialize = vi.fn().mockResolvedValue(undefined);
  addDocument = vi.fn().mockResolvedValue("mock-id");
  addDocuments = vi.fn().mockResolvedValue(["mock-id"]);
  search = vi.fn().mockResolvedValue([]);
  getDocument = vi.fn().mockResolvedValue(null);
  updateDocument = vi.fn().mockResolvedValue(undefined);
  deleteDocument = vi.fn().mockResolvedValue(undefined);
  deleteAllDocuments = vi.fn().mockResolvedValue(undefined);
  addFeedback = vi.fn().mockResolvedValue("mock-feedback-id");
  getFeedbackForComponent = vi.fn().mockResolvedValue([]);
  searchFeedback = vi.fn().mockResolvedValue([]);
  recordRetrieval = vi.fn().mockResolvedValue("mock-retrieval-id");
  updateRetrievalOutcome = vi.fn().mockResolvedValue(undefined);
  getRetrievalsByQuery = vi.fn().mockResolvedValue([]);
  getSuccessfulRetrievals = vi.fn().mockResolvedValue([]);
  createComponentVersion = vi.fn().mockResolvedValue("mock-version-id");
  getComponentVersions = vi.fn().mockResolvedValue([]);
  getComponentVersionDiff = vi.fn().mockResolvedValue({ changes: [] });
  addLearningTask = vi.fn().mockResolvedValue("mock-task-id");
  getLearningTasks = vi.fn().mockResolvedValue([]);
  addExemplarSolution = vi.fn().mockResolvedValue("mock-solution-id");
  getExemplarSolutions = vi.fn().mockResolvedValue([]);
  getTasksByDifficulty = vi.fn().mockResolvedValue([]);
  getNextRecommendedTask = vi.fn().mockResolvedValue(null);
}

class MockComponentSearch extends ComponentSearch {
  constructor() {
    super(new MockVectorDBConnector());
  }

  async searchComponents(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByType(query: string, type: ComponentType, options?: Omit<SearchOptions, "types">): Promise<SearchResult[]> {
    return [];
  }

  async getComponentById(id: string): Promise<Component | null> {
    return null;
  }

  async findSimilarComponents(component: Component, options?: Omit<SearchOptions, "types">): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByName(name: string, options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByPath(path: string, options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async searchComponentsByTags(tags: string[], options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async getAllComponentsByType(type: ComponentType): Promise<Component[]> {
    return [];
  }
}

describe("CLI Integration", () => {
  let cliTool: CliTool;
  let mockLlmService: any;
  let mockCodeValidator: any;
  let mockCliCommandHandler: any;
  let mockSessionManager: any;
  let mockVectorConfigStore: any;
  let mockErrorFormatter: any;
  let componentSearch: MockComponentSearch;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create mock instances
    mockLlmService = new MockLLMService() as any;
    mockCodeValidator = new MockCodeValidator() as any;
    mockCliCommandHandler = new MockCliCommandHandler() as any;
    mockSessionManager = new MockSessionManager() as any;
    mockVectorConfigStore = new MockVectorConfigStore() as any;
    mockErrorFormatter = new ErrorFormatter() as any;
    componentSearch = new MockComponentSearch() as any;

    // Setup mock implementations
    (mockLlmService.generateComponent as any).mockResolvedValue({
      type: ComponentType.Function,
      name: "processUserJourney",
      content: "function processUserJourney() { /* implementation */ }",
      metadata: {
        path: "src/functions/user-journey.ts",
        description: "Processes a user journey for US users with discount",
      },
    });

    (mockCodeValidator.validateCode as any).mockResolvedValue({
      isValid: true,
      errors: undefined,
      warnings: undefined,
    });

    (mockCliCommandHandler.processCommand as any).mockResolvedValue({
      component: {
        id: "component-1",
        type: ComponentType.Function,
        name: "processUserJourney",
        content: "function processUserJourney() { /* implementation */ }",
        metadata: {
          path: "src/functions/user-journey.ts",
          description: "Processes a user journey for US users with discount",
        },
      },
      validationResult: {
        isValid: true,
      },
    });

    (mockSessionManager.processCommand as any).mockResolvedValue({
      component: {
        id: "component-1",
        type: ComponentType.Function,
        name: "processUserJourney",
        content: "function processUserJourney() { /* implementation */ }",
        metadata: {
          path: "src/functions/user-journey.ts",
          description: "Processes a user journey for US users with discount",
        },
      },
      validationResult: {
        isValid: true,
      },
    });

    (mockSessionManager.commitCurrentComponent as any).mockResolvedValue({
      success: true,
      message: "Component successfully committed",
    });

    (mockVectorConfigStore.saveConfiguration as any).mockResolvedValue(
      "config-1",
    );
    (mockVectorConfigStore.getConfiguration as any).mockResolvedValue(
      "function processUserJourney() { /* implementation */ }",
    );

    (mockErrorFormatter.format as any).mockReturnValue(
      "Please fix the following errors:\nLine 2, Column 10: Missing semicolon",
    );
    (mockErrorFormatter.formatWithContext as any).mockReturnValue(
      "Context:\n  const discount = 0.05\n                      ^\nLine 2, Column 22: Missing semicolon",
    );

    // Create the CLI tool with mocked dependencies
    cliTool = new CliTool(
      mockLlmService,
      mockCodeValidator,
      mockSessionManager,
      mockVectorConfigStore,
      mockErrorFormatter,
      componentSearch
    );
  });

  describe("GIVEN a user wants to add a new feature", () => {
    describe("WHEN they execute the full workflow", () => {
      it("THEN the system should generate, validate, and commit the code", async () => {
        // Execute the full workflow
        const result = await cliTool.executeWorkflow(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
        );

        // Verify session manager was called
        expect(mockSessionManager.processCommand).toHaveBeenCalledWith(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          expect.any(String), // ComponentType
          expect.any(Array) // similarComponents
        );

        // Verify commit was called
        expect(mockSessionManager.commitCurrentComponent).toHaveBeenCalled();

        // Verify vector config store was called
        expect(mockVectorConfigStore.saveConfiguration).toHaveBeenCalledWith(
          expect.any(String), // configName
          expect.stringContaining("processUserJourney"), // content
          expect.any(String), // version
        );

        // Verify result
        expect(result.success).toBe(true);
        expect(result.component).toBeDefined();
        expect(result.message).toContain("successfully");
      });
    });
  });

  describe("GIVEN generated code has validation errors", () => {
    describe("WHEN the system detects and fixes the errors", () => {
      it("THEN it should retry until validation passes and then commit", async () => {
        // Setup validation to fail once then succeed
        const invalidResult: ValidationResult = {
          isValid: false,
          errors: [
            {
              message: "Missing semicolon",
              location: { line: 2, column: 10 },
            },
          ],
        };

        const validResult: ValidationResult = {
          isValid: true,
        };

        // Mock session manager to simulate error then success
        (mockSessionManager.processCommand as any)
          .mockResolvedValueOnce({
            component: {
              id: "component-1",
              type: ComponentType.Function,
              name: "processUserJourney",
              content: "function processUserJourney() { /* with errors */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description:
                  "Processes a user journey for US users with discount",
              },
            },
            validationResult: invalidResult,
          })
          .mockResolvedValueOnce({
            component: {
              id: "component-1",
              type: ComponentType.Function,
              name: "processUserJourney",
              content: "function processUserJourney() { /* fixed version */ }",
              metadata: {
                path: "src/functions/user-journey.ts",
                description:
                  "Processes a user journey for US users with discount",
              },
            },
            validationResult: validResult,
          });

        // Execute workflow
        const result = await cliTool.executeWorkflow(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
        );

        // Verify session manager was called twice (initial + retry)
        expect(mockSessionManager.processCommand).toHaveBeenCalledTimes(2);

        // Verify error formatter was called
        expect(mockErrorFormatter.format).toHaveBeenCalledWith(invalidResult);

        // Verify commit was called after successful validation
        expect(mockSessionManager.commitCurrentComponent).toHaveBeenCalled();

        // Verify result
        expect(result.success).toBe(true);
        expect(result.component.content).toContain("fixed version");
      });
    });
  });

  describe("GIVEN a user wants to modify generated code", () => {
    describe("WHEN they provide feedback before committing", () => {
      it("THEN the system should incorporate the feedback and then commit", async () => {
        // Mock session manager for feedback
        (mockSessionManager.provideFeedback as any).mockResolvedValue({
          component: {
            id: "component-1",
            type: ComponentType.Function,
            name: "processUserJourney",
            content: "function processUserJourney() { /* improved version */ }",
            metadata: {
              path: "src/functions/user-journey.ts",
              description:
                "Processes a user journey for US users with discount",
            },
          },
          validationResult: {
            isValid: true,
          },
        });

        // Execute workflow with feedback
        const result = await cliTool.executeWorkflowWithFeedback(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          "Please add input validation for the user's country",
        );

        // Verify session manager was called for initial command
        expect(mockSessionManager.processCommand).toHaveBeenCalledWith(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          expect.any(String),
        );

        // Verify feedback was provided
        expect(mockSessionManager.provideFeedback).toHaveBeenCalledWith(
          "Please add input validation for the user's country",
        );

        // Verify commit was called after feedback
        expect(mockSessionManager.commitCurrentComponent).toHaveBeenCalled();

        // Verify result
        expect(result.success).toBe(true);
        expect(result.component.content).toContain("improved version");
      });
    });
  });

  describe("GIVEN a user wants to retrieve a previously saved configuration", () => {
    describe("WHEN they request it by name and version", () => {
      it("THEN the system should retrieve it from the vector database", async () => {
        // Retrieve configuration
        const config = await cliTool.getConfiguration("userJourney", "v1");

        // Verify vector config store was called
        expect(mockVectorConfigStore.getConfiguration).toHaveBeenCalledWith(
          "userJourney",
          "v1",
        );

        // Verify result
        expect(config).toContain("processUserJourney");
      });
    });
  });
});
