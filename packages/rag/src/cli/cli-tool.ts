/**
 * @file CLI Tool implementation
 * @module @architectlm/rag
 */

import { Component, ComponentType } from "../models.js";
import { LLMService } from "../llm/llm-service.js";
import { CodeValidator } from "../validation/code-validator.js";
import {
  CliCommandHandler,
  CommandResult,
  CommitResult,
} from "./cli-command-handler.js";
import { SessionManager } from "./session-manager.js";
import { VectorConfigStore } from "./vector-config-store.js";
import { ErrorFormatter } from "./error-formatter.js";
import { ComponentSearch } from "../search/component-search.js";

/**
 * Result of executing a workflow
 */
export interface WorkflowResult {
  success: boolean;
  message: string;
  component: Component;
}

/**
 * CLI Tool for RAG Agent interaction
 */
export class CliTool {
  private llmService: LLMService;
  private codeValidator: CodeValidator;
  private sessionManager: SessionManager;
  private vectorConfigStore: VectorConfigStore;
  private errorFormatter: ErrorFormatter;
  private componentSearch: ComponentSearch;
  private maxRetries: number;

  /**
   * Create a new CLI Tool
   */
  constructor(
    llmService: LLMService,
    codeValidator: CodeValidator,
    sessionManager: SessionManager,
    vectorConfigStore: VectorConfigStore,
    errorFormatter: ErrorFormatter,
    componentSearch: ComponentSearch,
    maxRetries = 3,
  ) {
    this.llmService = llmService;
    this.codeValidator = codeValidator;
    this.sessionManager = sessionManager;
    this.vectorConfigStore = vectorConfigStore;
    this.errorFormatter = errorFormatter;
    this.componentSearch = componentSearch;
    this.maxRetries = maxRetries;
  }

  /**
   * Execute a workflow from start to finish
   */
  async executeWorkflow(command: string): Promise<WorkflowResult> {
    // Determine the component type based on the command
    const componentType = this.determineComponentType(command);

    // Search for similar components first
    const similarResults = await this.componentSearch.searchComponents(command, {
      types: [componentType],
      limit: 3,
      threshold: 0.7
    });

    // Process the command with similar components as context
    let result = await this.sessionManager.processCommand(
      command,
      componentType,
      similarResults.map(r => r.component)
    );

    // If validation fails, retry with error feedback
    let retryCount = 0;
    while (!result.validationResult.isValid && retryCount < this.maxRetries) {
      console.log(
        `Validation failed. Retrying (${retryCount + 1}/${this.maxRetries})...`,
      );

      // Format errors for display
      const errorMessage = this.errorFormatter.format(result.validationResult);
      console.log(errorMessage);

      // Create a new command with error feedback
      const feedbackCommand = `${command}\n\nPrevious attempt had errors:\n${errorMessage}\n\nPlease fix and try again.`;

      // Retry with error feedback
      result = await this.sessionManager.processCommand(
        feedbackCommand,
        componentType,
        similarResults.map(r => r.component)
      );

      retryCount++;
    }

    // If validation still fails after retries, return error
    if (!result.validationResult.isValid) {
      return {
        success: false,
        message: `Failed to generate valid code after ${this.maxRetries} attempts.`,
        component: result.component,
      };
    }

    // Commit the component
    const commitResult = await this.sessionManager.commitCurrentComponent();

    // Save to vector database
    if (commitResult.success) {
      const configName = this.generateConfigName(result.component);
      const version = "v1"; // In a real implementation, this would be determined dynamically

      await this.vectorConfigStore.saveConfiguration(
        configName,
        result.component.content,
        version,
      );
    }

    // Return success
    return {
      success: commitResult.success,
      message: commitResult.message,
      component: result.component,
    };
  }

  /**
   * Execute a workflow with user feedback
   */
  async executeWorkflowWithFeedback(
    command: string,
    feedback: string,
  ): Promise<WorkflowResult> {
    // Determine the component type based on the command
    const componentType = this.determineComponentType(command);

    // Process the initial command
    let result = await this.sessionManager.processCommand(
      command,
      componentType,
    );

    // If validation fails, return error
    if (!result.validationResult.isValid) {
      const errorMessage = this.errorFormatter.format(result.validationResult);

      return {
        success: false,
        message: `Initial generation failed validation:\n${errorMessage}`,
        component: result.component,
      };
    }

    // Apply user feedback
    result = await this.sessionManager.provideFeedback(feedback);

    // If validation fails after feedback, return error
    if (!result.validationResult.isValid) {
      const errorMessage = this.errorFormatter.format(result.validationResult);

      return {
        success: false,
        message: `Feedback application failed validation:\n${errorMessage}`,
        component: result.component,
      };
    }

    // Commit the component
    const commitResult = await this.sessionManager.commitCurrentComponent();

    // Save to vector database
    if (commitResult.success) {
      const configName = this.generateConfigName(result.component);
      const version = "v1"; // In a real implementation, this would be determined dynamically

      await this.vectorConfigStore.saveConfiguration(
        configName,
        result.component.content,
        version,
      );
    }

    // Return success
    return {
      success: commitResult.success,
      message: commitResult.message,
      component: result.component,
    };
  }

  /**
   * Get a configuration from the vector database
   */
  async getConfiguration(
    configName: string,
    version: string,
  ): Promise<string | null> {
    return this.vectorConfigStore.getConfiguration(configName, version);
  }

  /**
   * Determine the component type based on the command
   */
  private determineComponentType(command: string): ComponentType {
    // In a real implementation, this would use NLP or heuristics to determine the component type
    // For now, we'll use simple keyword matching

    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes("function") || lowerCommand.includes("method")) {
      return ComponentType.Function;
    } else if (
      lowerCommand.includes("command") ||
      lowerCommand.includes("action")
    ) {
      return ComponentType.Command;
    } else if (
      lowerCommand.includes("event") ||
      lowerCommand.includes("trigger")
    ) {
      return ComponentType.Event;
    } else if (
      lowerCommand.includes("query") ||
      lowerCommand.includes("fetch")
    ) {
      return ComponentType.Query;
    } else if (
      lowerCommand.includes("schema") ||
      lowerCommand.includes("model")
    ) {
      return ComponentType.Schema;
    } else if (
      lowerCommand.includes("pipeline") ||
      lowerCommand.includes("workflow")
    ) {
      return ComponentType.Pipeline;
    } else if (
      lowerCommand.includes("extension") ||
      lowerCommand.includes("plugin")
    ) {
      return ComponentType.Extension;
    }

    // Default to Function
    return ComponentType.Function;
  }

  /**
   * Generate a configuration name from a component
   */
  private generateConfigName(component: Component): string {
    // In a real implementation, this would generate a meaningful name
    // For now, we'll use the component name
    return component.name
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");
  }
}
