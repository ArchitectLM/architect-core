import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentType, ValidationResult } from "../../src/models.js";
import { LLMService } from "../../src/llm/llm-service.js";
import { CodeValidator } from "../../src/validation/code-validator.js";
import { CliCommandHandler } from "../../src/cli/cli-command-handler.js";

// Mock dependencies
vi.mock("../../src/llm/llm-service.js");
vi.mock("../../src/validation/code-validator.js");

describe("CliCommandHandler", () => {
  let cliCommandHandler: CliCommandHandler;
  let mockLlmService: LLMService;
  let mockCodeValidator: CodeValidator;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create mock instances
    mockLlmService = new LLMService() as vi.Mocked<LLMService>;
    mockCodeValidator = new CodeValidator() as vi.Mocked<CodeValidator>;

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

    // Create the handler with mocked dependencies
    cliCommandHandler = new CliCommandHandler(
      mockLlmService,
      mockCodeValidator,
    );
  });

  describe("GIVEN a user wants to add a new feature", () => {
    describe("WHEN they provide a prompt through the CLI", () => {
      it("THEN the system should process the command and return generated code", async () => {
        // Execute command
        const result = await cliCommandHandler.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        // Verify LLM service was called with correct parameters
        expect(mockLlmService.generateComponent).toHaveBeenCalledWith(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        // Verify result structure
        expect(result).toHaveProperty("component");
        expect(result).toHaveProperty("validationResult");
        expect(result.component.name).toBe("processUserJourney");
        expect(result.validationResult.isValid).toBe(true);
      });
    });
  });

  describe("GIVEN generated code has validation errors", () => {
    describe("WHEN the system detects the errors", () => {
      it("THEN it should retry with error context until validation passes", async () => {
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

        (mockCodeValidator.validateCode as any)
          .mockResolvedValueOnce(invalidResult)
          .mockResolvedValueOnce(validResult);

        // Setup LLM to generate different code on retry
        (mockLlmService.generateComponent as any)
          .mockResolvedValueOnce({
            type: ComponentType.Function,
            name: "processUserJourney",
            content: "function processUserJourney() { /* with errors */ }",
            metadata: {
              path: "src/functions/user-journey.ts",
              description:
                "Processes a user journey for US users with discount",
            },
          })
          .mockResolvedValueOnce({
            type: ComponentType.Function,
            name: "processUserJourney",
            content: "function processUserJourney() { /* fixed version */ }",
            metadata: {
              path: "src/functions/user-journey.ts",
              description:
                "Processes a user journey for US users with discount",
            },
          });

        // Execute command
        const result = await cliCommandHandler.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        // Verify LLM was called twice (initial + retry)
        expect(mockLlmService.generateComponent).toHaveBeenCalledTimes(2);

        // Verify validator was called twice
        expect(mockCodeValidator.validateCode).toHaveBeenCalledTimes(2);

        // Verify final result is valid
        expect(result.validationResult.isValid).toBe(true);
        expect(result.component.content).toContain("fixed version");
      });
    });
  });

  describe("GIVEN a user wants to commit a valid feature", () => {
    describe("WHEN they approve the generated code", () => {
      it("THEN the system should return a success status", async () => {
        // First generate the code
        const generationResult = await cliCommandHandler.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        // Then commit the code
        const commitResult = await cliCommandHandler.commitCode(
          generationResult.component,
        );

        // Verify result
        expect(commitResult.success).toBe(true);
        expect(commitResult.message).toContain("successfully committed");
      });
    });
  });

  describe("GIVEN a user wants to modify generated code", () => {
    describe("WHEN they provide feedback for improvement", () => {
      it("THEN the system should regenerate with the feedback", async () => {
        // Setup LLM to generate different code based on feedback
        (mockLlmService.generateComponent as any)
          .mockResolvedValueOnce({
            type: ComponentType.Function,
            name: "processUserJourney",
            content: "function processUserJourney() { /* initial version */ }",
            metadata: {
              path: "src/functions/user-journey.ts",
              description:
                "Processes a user journey for US users with discount",
            },
          })
          .mockResolvedValueOnce({
            type: ComponentType.Function,
            name: "processUserJourney",
            content: "function processUserJourney() { /* improved version */ }",
            metadata: {
              path: "src/functions/user-journey.ts",
              description:
                "Processes a user journey for US users with discount",
            },
          });

        // First generate the code
        const initialResult = await cliCommandHandler.processCommand(
          "Add a user journey: for US users only, after the first success order, give 5% discount for a next buy.",
          ComponentType.Function,
        );

        // Then provide feedback
        const feedbackResult = await cliCommandHandler.provideFeedback(
          initialResult.component,
          "Please add input validation for the user's country",
        );

        // Verify LLM was called with feedback
        expect(mockLlmService.generateComponent).toHaveBeenCalledTimes(2);
        expect(mockLlmService.generateComponent).toHaveBeenLastCalledWith(
          expect.stringContaining(
            "Please add input validation for the user's country",
          ),
          ComponentType.Function,
        );

        // Verify result contains improved version
        expect(feedbackResult.component.content).toContain("improved version");
      });
    });
  });
});
