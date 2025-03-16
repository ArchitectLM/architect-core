import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentType, ValidationResult } from "../../src/models.js";
import { LLMService } from "../../src/llm/llm-service.js";
import { CodeValidator } from "../../src/validation/code-validator.js";
import { CliCommandHandler } from "../../src/cli/cli-command-handler.js";
import { SessionManager } from "../../src/cli/session-manager.js";
import { VectorConfigStore } from "../../src/cli/vector-config-store.js";
import { ErrorFormatter } from "../../src/cli/error-formatter.js";
import { CliTool } from "../../src/cli/cli-tool.js";

// Mock dependencies
vi.mock("../../src/llm/llm-service.js");
vi.mock("../../src/validation/code-validator.js");
vi.mock("../../src/cli/cli-command-handler.js");
vi.mock("../../src/cli/session-manager.js");
vi.mock("../../src/cli/vector-config-store.js");
vi.mock("../../src/cli/error-formatter.js");

describe("CLI Integration", () => {
  let cliTool: CliTool;
  let mockLlmService: any;
  let mockCodeValidator: any;
  let mockCliCommandHandler: any;
  let mockSessionManager: any;
  let mockVectorConfigStore: any;
  let mockErrorFormatter: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create mock instances
    mockLlmService = new LLMService() as any;
    mockCodeValidator = new CodeValidator() as any;
    mockCliCommandHandler = new CliCommandHandler(
      mockLlmService,
      mockCodeValidator,
    ) as any;
    mockSessionManager = new SessionManager(mockCliCommandHandler) as any;
    mockVectorConfigStore = new VectorConfigStore({} as any) as any;
    mockErrorFormatter = new ErrorFormatter() as any;

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
      mockCliCommandHandler,
      mockSessionManager,
      mockVectorConfigStore,
      mockErrorFormatter,
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
