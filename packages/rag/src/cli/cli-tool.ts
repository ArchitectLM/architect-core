/**
 * @file CLI Tool implementation
 * @module @architectlm/rag
 */

import { Component, ComponentType, ValidationResult } from "../models.js";
import { LLMService } from "../llm/llm-service.js";
import { CodeValidator } from "../validation/code-validator.js";
import {
  CLICommandHandler,
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
interface WorkflowResult {
  success: boolean;
  message: string;
  component: Component | Component[];
  validationResult?: ValidationResult;
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
  private systemPrompt: string;

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
    systemPrompt: string,
  ) {
    this.llmService = llmService;
    this.codeValidator = codeValidator;
    this.sessionManager = sessionManager;
    this.vectorConfigStore = vectorConfigStore;
    this.errorFormatter = errorFormatter;
    this.componentSearch = componentSearch;
    this.maxRetries = maxRetries;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Execute a workflow from start to finish
   */
  async executeWorkflow(description: string, fullResponse?: string): Promise<WorkflowResult> {
    try {
      // Generate components using LLM
      const components = await this.llmService.generateComponent(description, 'command', this.systemPrompt);
      
      // Validate the generated code
      const validationResult = await this.codeValidator.validateCode(components.map(c => c.content).join('\n\n'), {
        relevantComponents: components,
        query: description,
        suggestedChanges: []
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          message: 'Code validation failed',
          component: components,
          validationResult
        };
      }

      // Save components to vector store
      for (const component of components) {
        await this.vectorConfigStore.saveConfiguration(component.name, component.content, "v1");
      }

      return {
        success: true,
        message: 'Components generated and saved successfully',
        component: components,
        validationResult
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        component: [],
        validationResult: undefined
      };
    }
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

    // Commit the component(s)
    const commitResult = await this.sessionManager.commitCurrentComponent();

    // Save to vector database
    if (commitResult.success) {
      const components = Array.isArray(result.component) ? result.component : [result.component];
      
      // Save each component with its actual name
      for (const component of components) {
        await this.vectorConfigStore.saveConfiguration(
          component.name,
          component.content,
          "v1"
        );
      }
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
