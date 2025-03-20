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
  component: Component | Component[];
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
export class CLICommandHandler {
  private maxRetries = 3;
  private systemPrompt: string;

  constructor(
    private llmService: LLMService,
    private codeValidator: CodeValidator,
    systemPrompt?: string
  ) {
    this.systemPrompt = systemPrompt || '';
  }

  /**
   * Process a command from the user
   */
  async processCommand(
    command: string,
    componentType: ComponentType,
    similarComponents: Component[] = []
  ): Promise<CommandResult> {
    // Generate components using LLM
    let components: Component[] = await this.llmService.generateComponent(
      command,
      componentType,
      this.systemPrompt
    );

    // Create a simple edit context for validation
    const context: EditContext = {
      query: command,
      relevantComponents: components,
      suggestedChanges: [
        ...components.map((c: Component) => ({
          componentId: c.id || "new-component",
          originalContent: c.content,
          reason: "Generated from user command",
        })),
        ...similarComponents.map((c: Component) => ({
          componentId: c.id || "similar-component",
          originalContent: c.content,
          reason: "Similar existing component"
        }))
      ],
    };

    // Validate all components
    let validationResult = await this.codeValidator.validateCode(
      components.map((c: Component) => c.content).join('\n\n'),
      context,
    );

    // If validation fails, retry with error feedback
    let retryCount = 0;
    while (!validationResult.isValid && retryCount < this.maxRetries) {
      // Create error feedback for LLM
      const errorFeedback = this.createErrorFeedback(command, validationResult);

      // Regenerate with error feedback
      components = await this.llmService.generateComponent(
        errorFeedback,
        componentType,
        this.systemPrompt
      );

      // Validate again
      validationResult = await this.codeValidator.validateCode(
        components.map((c: Component) => c.content).join('\n\n'),
        context,
      );

      retryCount++;
    }

    // Return the result
    return {
      component: components,
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

    // Generate improved components
    const improvedComponents = await this.llmService.generateComponent(
      prompt,
      component.type,
      this.systemPrompt
    );

    // Preserve the original component's metadata and ID for the first component
    if (improvedComponents.length > 0) {
      improvedComponents[0] = {
        ...improvedComponents[0],
        id: component.id,
        metadata: {
          ...component.metadata,
          description: `${component.metadata.description} (improved with feedback)`,
        }
      };
    }

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
      improvedComponents.map(c => c.content).join('\n\n'),
      context,
    );

    // Return the result
    return {
      component: improvedComponents,
      validationResult,
    };
  }

  /**
   * Create error feedback for the LLM
   */
  private createErrorFeedback(command: string, validationResult: ValidationResult): string {
    const errors = validationResult.errors?.map(e => e.message).join('\n') || '';
    const warnings = validationResult.warnings?.map(w => w.message).join('\n') || '';
    const suggestions = validationResult.suggestions?.join('\n') || '';

    return `The previous response had validation issues. Please fix the following:

${errors ? `Errors:\n${errors}\n` : ''}
${warnings ? `Warnings:\n${warnings}\n` : ''}
${suggestions ? `Suggestions:\n${suggestions}\n` : ''}

Original command: ${command}

Please provide a corrected version that addresses these issues.`;
  }
}
