/**
 * @file CLI Command Handler implementation
 * @module @architectlm/rag
 */

import {
  Component,
  ComponentType,
  EditContext,
  ValidationResult,
} from "../models.js";
import { LLMService } from "../llm/llm-service.js";
import { CodeValidator } from "../validation/code-validator.js";

/**
 * Result of processing a command
 */
export interface CommandResult {
  component: Component;
  validationResult: ValidationResult;
}

/**
 * Result of committing code
 */
export interface CommitResult {
  success: boolean;
  message: string;
}

/**
 * CLI Command Handler for processing user commands
 */
export class CliCommandHandler {
  private llmService: LLMService;
  private codeValidator: CodeValidator;
  private maxRetries: number = 3;
  private systemPrompt: string;

  /**
   * Create a new CLI Command Handler
   */
  constructor(llmService: LLMService, codeValidator: CodeValidator, systemPrompt: string) {
    this.llmService = llmService;
    this.codeValidator = codeValidator;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Process a command from the user
   */
  async processCommand(
    command: string,
    componentType: ComponentType,
    similarComponents: Component[] = []
  ): Promise<CommandResult> {
    // Generate component using LLM
    let component = await this.llmService.generateComponent(
      command,
      componentType,
      this.systemPrompt
    );

    // Create a simple edit context for validation
    const context: EditContext = {
      query: command,
      relevantComponents: [component, ...similarComponents],
      suggestedChanges: [
        {
          componentId: component.id || "new-component",
          originalContent: component.content,
          reason: "Generated from user command",
        },
        ...similarComponents.map(c => ({
          componentId: c.id || "similar-component",
          originalContent: c.content,
          reason: "Similar existing component"
        }))
      ],
    };

    // Validate the generated code
    let validationResult = await this.codeValidator.validateCode(
      component.content,
      context,
    );

    // If validation fails, retry with error feedback
    let retryCount = 0;
    while (!validationResult.isValid && retryCount < this.maxRetries) {
      // Create error feedback for LLM
      const errorFeedback = this.createErrorFeedback(command, validationResult);

      // Regenerate with error feedback
      component = await this.llmService.generateComponent(
        errorFeedback,
        componentType,
        this.systemPrompt
      );

      // Validate again
      validationResult = await this.codeValidator.validateCode(
        component.content,
        context,
      );

      retryCount++;
    }

    // Return the result
    return {
      component,
      validationResult,
    };
  }

  /**
   * Commit code to the system
   */
  async commitCode(component: Component): Promise<CommitResult> {
    // In a real implementation, this would persist the component to a database or file system
    // For now, we'll just return a success message

    return {
      success: true,
      message: `Component ${component.name} successfully committed`,
    };
  }

  /**
   * Provide feedback to improve a component
   */
  async provideFeedback(
    component: Component,
    feedback: string,
  ): Promise<CommandResult> {
    // Create a prompt that includes the original component and the feedback
    const prompt = `
Original component:
${component.content}

User feedback:
${feedback}

Please improve the component based on the feedback.
`;

    // Generate improved component
    const improvedComponent = await this.llmService.generateComponent(
      prompt,
      component.type,
      this.systemPrompt
    );

    // Preserve the original component's metadata and ID
    improvedComponent.id = component.id;
    improvedComponent.metadata = {
      ...component.metadata,
      description: `${component.metadata.description} (improved with feedback)`,
    };

    // Create a simple edit context for validation
    const context: EditContext = {
      query: feedback,
      relevantComponents: [component],
      suggestedChanges: [
        {
          componentId: component.id || "existing-component",
          originalContent: component.content,
          reason: "Improved based on user feedback",
        },
      ],
    };

    // Validate the improved code
    const validationResult = await this.codeValidator.validateCode(
      improvedComponent.content,
      context,
    );

    // Return the result
    return {
      component: improvedComponent,
      validationResult,
    };
  }

  /**
   * Create error feedback for LLM
   */
  private createErrorFeedback(
    command: string,
    validationResult: ValidationResult,
  ): string {
    // Extract error messages
    const errorMessages =
      validationResult.errors
        ?.map((error) => {
          const location = error.location
            ? `Line ${error.location.line}, Column ${error.location.column}: `
            : "";
          return `${location}${error.message}`;
        })
        .join("\n") || "Unknown errors";

    // Create a prompt that includes the original command and the errors
    return `
Original request:
${command}

The generated code has the following errors:
${errorMessages}

Please fix these errors and regenerate the code.
`;
  }
}
