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
    // Search for similar components first
    const similarResults = await this.componentSearch.searchComponents(command, {
      types: ['schema', 'command', 'query', 'event', 'workflow', 'extension', 'plugin'],
      limit: 3,
      threshold: 0.7,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });

    // Process the command with similar components as context
    let result = await this.sessionManager.processCommand(
      command,
      'workflow',
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
        'workflow',
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
    // Process the initial command
    let result = await this.sessionManager.processCommand(
      command,
      'workflow'
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
